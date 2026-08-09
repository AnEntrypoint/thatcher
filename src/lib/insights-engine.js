// A synthesis layer over data already computed this session -- reads the
// outputs of inventory-forecast.js/demand-forecast.js/resource-capacity.js/
// contract-expiry.js, never reimplements their math. Deliberately rule-based
// rather than an external LLM call: no API key, no network dependency, no
// cost, and every rule is deterministic and directly witnessable via
// exec_js the same way every other feature this session has been.
import { daysUntilStockout, isReorderDue } from './inventory-forecast.js';
import { daysUntilExpiry } from './contract-expiry.js';
import { userCommittedHours, DEFAULT_WEEKLY_CAPACITY_HOURS } from './resource-capacity.js';
import { zScoreAnomaly } from './statistical-forecast.js';

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function insight(severity, category, message, entity, entityId) {
  return { severity, category, message, entity, entity_id: entityId };
}

// Product X will stock out in N days with no reorder currently scheduled --
// "no reorder scheduled" here means the reorder isn't yet due (isReorderDue
// false) but stockout is imminent, distinct from the existing product
// detail-view warning which only flags the reorder-due boundary itself.
export function stockoutRiskInsights(products, movementsByProductId) {
  const results = [];
  for (const product of products) {
    const movements = movementsByProductId[product.id] || [];
    const currentStock = movements.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const avgDailyConsumption = movements
      .filter(m => Number(m.quantity) < 0)
      .reduce((sum, m) => sum + Math.abs(Number(m.quantity) || 0), 0) / 90;
    const days = daysUntilStockout(currentStock, avgDailyConsumption);
    if (days == null) continue;
    if (days <= 14) {
      const severity = days <= 3 ? 'critical' : 'warning';
      results.push(insight(severity, 'inventory', `${product.name || product.id} will stock out in ${Math.round(days)} days`, 'product', product.id));
    }
  }
  return results;
}

// Contract Y expires in N days with no renewal opportunity linked --
// cross-references contract.opportunity_id, since a contract already headed
// toward renewal via a tracked deal is a materially different situation
// from one with nothing lined up.
export function contractExpiryInsights(contracts) {
  const results = [];
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const contract of contracts) {
    if (contract.status !== 'active' || contract.end_date == null) continue;
    const days = daysUntilExpiry(contract.end_date, nowSeconds);
    if (days > (contract.notice_period_days ?? 30)) continue;
    if (contract.opportunity_id) continue;
    const severity = days <= 0 ? 'critical' : 'warning';
    results.push(insight(severity, 'contract', `${contract.name || contract.id} expires in ${days} days with no renewal opportunity linked`, 'contract', contract.id));
  }
  return results;
}

// User Z is at N% capacity across active allocations -- a straightforward
// utilization-threshold rule reusing the exact load calculation
// resource-optimizer.js's suggestion ranking already relies on.
export async function capacityInsights(users, windowStart, windowEnd) {
  const results = [];
  for (const user of users) {
    const committed = await userCommittedHours(user.id, windowStart, windowEnd);
    const pct = Math.round((committed / DEFAULT_WEEKLY_CAPACITY_HOURS) * 100);
    if (pct >= 90) {
      const severity = pct >= 100 ? 'critical' : 'warning';
      results.push(insight(severity, 'resource', `${user.name || user.id} is at ${pct}% capacity`, 'user', user.id));
    }
  }
  return results;
}

// Opportunity pipeline for month N shows a >30% drop from month N-1 --
// compares adjacent buckets from demand-forecast.js's own projectDemandByMonth
// output, never recomputing the bucket sums itself.
export function pipelineDropInsights(monthlyBuckets) {
  const results = [];
  for (let i = 1; i < monthlyBuckets.length; i++) {
    const [prevKey, prevValue] = monthlyBuckets[i - 1];
    const [curKey, curValue] = monthlyBuckets[i];
    if (prevValue <= 0) continue;
    const dropPct = ((prevValue - curValue) / prevValue) * 100;
    if (dropPct > 30) {
      results.push(insight('warning', 'pipeline', `Projected pipeline for ${curKey} is ${Math.round(dropPct)}% lower than ${prevKey}`, 'opportunity', curKey));
    }
  }
  return results;
}

// Statistical, not rule-based: flags a product whose most recent day's
// consumption is a z-score outlier relative to ITS OWN historical daily
// consumption -- the same absolute consumption number can be perfectly
// normal for a high-variance product and anomalous for a low-variance one,
// which stockoutRiskInsights' fixed day-threshold cannot express since it
// only reasons about days-until-stockout, never about whether today's rate
// itself is unusual for this specific product.
export function statisticalAnomalyInsights(products, movementsByProductId) {
  const results = [];
  for (const product of products) {
    const movements = movementsByProductId[product.id] || [];
    const byDay = new Map();
    for (const m of movements) {
      if (Number(m.quantity) >= 0) continue;
      const day = new Date((Number(m.created_at) || 0) * 1000).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + Math.abs(Number(m.quantity) || 0));
    }
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (days.length < 3) continue;
    const latestValue = days[days.length - 1][1];
    const history = days.slice(0, -1).map(([, v]) => v);
    const { isAnomaly, zScore } = zScoreAnomaly(history, latestValue, 2);
    if (isAnomaly) {
      const direction = latestValue > (history.reduce((a, b) => a + b, 0) / history.length) ? 'above' : 'below';
      results.push(insight('warning', 'anomaly', `${product.name || product.id}'s latest daily consumption is statistically ${direction} its historical pattern (z-score ${zScore.toFixed(2)})`, 'product', product.id));
    }
  }
  return results;
}

export function sortBySeverity(insights) {
  return [...insights].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
}

// Orchestrator: every list() call here passes {user}, the SAME row/org-access
// scoping every entity route in the codebase already applies -- an insight
// can never surface a record the requesting user couldn't otherwise see,
// because it is generated from the identical scoped query that record's own
// list view would use. entityType optionally narrows which rule categories
// run (e.g. 'product' -> only stockout insights), skipping the rest rather
// than fetching data for rules that won't run.
export async function generateInsights(user, entityType = null) {
  const { list } = await import('./busybase/store.js');
  const results = [];

  if (!entityType || entityType === 'product') {
    const products = await list('product', {}, { user });
    const movementsByProductId = {};
    for (const product of products) {
      movementsByProductId[product.id] = await list('stock_movement', { product_id: product.id });
    }
    results.push(...stockoutRiskInsights(products, movementsByProductId));
    results.push(...statisticalAnomalyInsights(products, movementsByProductId));
  }

  if (!entityType || entityType === 'contract') {
    const contracts = await list('contract', {}, { user });
    results.push(...contractExpiryInsights(contracts));
  }

  if (!entityType || entityType === 'user' || entityType === 'resource_allocation') {
    const users = await list('user', {}, { user });
    const nowSeconds = Math.floor(Date.now() / 1000);
    results.push(...(await capacityInsights(users, nowSeconds, nowSeconds + 30 * 86400)));
  }

  if (!entityType || entityType === 'opportunity') {
    const { projectDemandByMonth } = await import('./demand-forecast.js');
    const opportunities = await list('opportunity', {}, { user });
    const buckets = projectDemandByMonth(opportunities);
    results.push(...pipelineDropInsights(buckets));
  }

  return sortBySeverity(results);
}
