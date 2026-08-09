import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { emptyState } from '@/ui/format-helpers.js';
import { getEntityLabel } from '@/config/spec-helpers.js';

const MAX_BUCKETS = 15;

function bucketLabel(spec, field, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return '(empty)';
  const fieldDef = spec.fields?.[field];
  if (fieldDef?.type === 'enum' && Array.isArray(fieldDef.options)) {
    const opt = fieldDef.options.find(o => String(o.value ?? o) === String(rawValue));
    return opt ? String(opt.label || opt.value || opt) : String(rawValue);
  }
  return String(rawValue);
}

export function countByField(records, spec, field) {
  const counts = new Map();
  for (const r of records) {
    const label = bucketLabel(spec, field, r[field]);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= MAX_BUCKETS) return sorted;
  const top = sorted.slice(0, MAX_BUCKETS - 1);
  const otherCount = sorted.slice(MAX_BUCKETS - 1).reduce((sum, [, c]) => sum + c, 0);
  return [...top, ['(other)', otherCount]];
}

function barChart(buckets) {
  if (!buckets.length) return emptyState('No data to report on', 'bar-chart');
  const max = Math.max(...buckets.map(([, c]) => c), 1);
  const rows = buckets.map(([label, count]) => {
    const pct = Math.round((count / max) * 100);
    return `<div class="report-bar-row" style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <div style="min-width:140px;max-width:220px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</div>
      <div style="flex:1;height:20px;background:var(--color-border,#eee);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--color-primary,#3b82f6);border-radius:4px"></div>
      </div>
      <div style="min-width:40px;text-align:right;font-size:13px;font-weight:600">${count}</div>
    </div>`;
  }).join('');
  return `<div class="report-bar-chart">${rows}</div>`;
}

function bucketDateKey(dateValue, granularity) {
  if (dateValue === null || dateValue === undefined || dateValue === '') return null;
  const num = Number(dateValue);
  const d = !isNaN(num) && num > 0 ? new Date(num * 1000) : new Date(dateValue);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (granularity === 'day') return `${y}-${m}-${day}`;
  if (granularity === 'week') {
    const onejan = new Date(y, 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  }
  return `${y}-${m}`;
}

export function countOverTime(records, dateField, granularity = 'month') {
  const counts = new Map();
  let unresolved = 0;
  for (const r of records) {
    const key = bucketDateKey(r[dateField], granularity);
    if (key === null) { unresolved++; continue; }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return { buckets: sorted.length > MAX_BUCKETS ? sorted.slice(-MAX_BUCKETS) : sorted, unresolved, truncated: sorted.length > MAX_BUCKETS };
}

export function renderCountByFieldReport(user, entityName, spec, records, field) {
  const label = getEntityLabel(spec, true) || entityName;
  const fieldDef = spec.fields?.[field];
  if (!fieldDef) {
    return page(user, `${label} | Report`, null,
      `<div class="page-header"><h1 class="page-title">${esc(label)}</h1></div>
      <div class="report-empty-state">Unknown field "${esc(field)}" for this entity.</div>`);
  }
  const buckets = countByField(records, spec, field);
  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)} by ${esc(fieldDef.label || field)}</h1><p class="page-subtitle">${records.length} total records</p></div>
    </div>
    ${barChart(buckets)}`;
  return page(user, `${label} Report | Thatcher`, null, content);
}

export function sumByField(records, spec, field, groupBy) {
  const sums = new Map();
  for (const r of records) {
    const raw = r[field];
    const num = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof num !== 'number' || isNaN(num)) continue;
    const label = bucketLabel(spec, groupBy, r[groupBy]);
    sums.set(label, (sums.get(label) || 0) + num);
  }
  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= MAX_BUCKETS) return sorted;
  const top = sorted.slice(0, MAX_BUCKETS - 1);
  const otherSum = sorted.slice(MAX_BUCKETS - 1).reduce((sum, [, v]) => sum + v, 0);
  return [...top, ['(other)', otherSum]];
}

function formatSumValue(value, fieldDef) {
  if (fieldDef?.type === 'currency') return (fieldDef.currency_symbol || '$') + (value / 100).toFixed(2);
  return String(Math.round(value * 100) / 100);
}

function sumBarChart(buckets, fieldDef) {
  if (!buckets.length) return emptyState('No data to report on', 'bar-chart');
  const max = Math.max(...buckets.map(([, v]) => Math.abs(v)), 1);
  const rows = buckets.map(([label, value]) => {
    const pct = Math.round((Math.abs(value) / max) * 100);
    return `<div class="report-bar-row" style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <div style="min-width:140px;max-width:220px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</div>
      <div style="flex:1;height:20px;background:var(--color-border,#eee);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--color-primary,#3b82f6);border-radius:4px"></div>
      </div>
      <div style="min-width:80px;text-align:right;font-size:13px;font-weight:600">${esc(formatSumValue(value, fieldDef))}</div>
    </div>`;
  }).join('');
  return `<div class="report-bar-chart">${rows}</div>`;
}

export function renderSumByFieldReport(user, entityName, spec, records, field, groupBy) {
  const label = getEntityLabel(spec, true) || entityName;
  const fieldDef = spec.fields?.[field];
  const groupByDef = spec.fields?.[groupBy];
  if (!fieldDef || !groupByDef) {
    return page(user, `${label} | Report`, null,
      `<div class="page-header"><h1 class="page-title">${esc(label)}</h1></div>
      <div class="report-empty-state">Unknown field "${esc(!fieldDef ? field : groupBy)}" for this entity.</div>`);
  }
  const buckets = sumByField(records, spec, field, groupBy);
  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)}: ${esc(fieldDef.label || field)} by ${esc(groupByDef.label || groupBy)}</h1><p class="page-subtitle">${records.length} total records</p></div>
    </div>
    ${sumBarChart(buckets, fieldDef)}`;
  return page(user, `${label} Report | Thatcher`, null, content);
}

// Cross-entity rollup: entity A's records are grouped by a field on related
// entity B, joined through A's ref field. relatedRecords must already be the
// CALLER's row/org-scoped list() result for B -- this function only joins
// and counts, it enforces no access itself (the access decision -- can this
// user list B at all -- is made by the caller before relatedRecords exists).
export function rollupByRelatedField(records, refField, relatedRecords, relatedSpec, rollupField) {
  const relatedById = new Map(relatedRecords.map(r => [String(r.id), r]));
  const counts = new Map();
  let unmatched = 0;
  for (const r of records) {
    const refId = r[refField];
    const related = refId != null ? relatedById.get(String(refId)) : null;
    if (!related) { unmatched++; continue; }
    const label = bucketLabel(relatedSpec, rollupField, related[rollupField]);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { buckets: sorted.length > MAX_BUCKETS ? sorted.slice(0, MAX_BUCKETS) : sorted, unmatched };
}

export function renderRollupReport(user, entityName, spec, records, refField, relatedEntity, relatedSpec, relatedRecords, rollupField) {
  const label = getEntityLabel(spec, true) || entityName;
  const relatedLabel = getEntityLabel(relatedSpec, true) || relatedEntity;
  const rollupFieldDef = relatedSpec?.fields?.[rollupField];
  if (!spec.fields?.[refField] || !rollupFieldDef) {
    return page(user, `${label} | Report`, null,
      `<div class="page-header"><h1 class="page-title">${esc(label)}</h1></div>
      <div class="report-empty-state">Unknown field for this rollup.</div>`);
  }
  const { buckets, unmatched } = rollupByRelatedField(records, refField, relatedRecords, relatedSpec, rollupField);
  const notice = unmatched
    ? `<div class="report-notice">${unmatched} record${unmatched === 1 ? '' : 's'} without a resolvable ${esc(relatedLabel)} excluded</div>`
    : '';
  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)} by ${esc(relatedLabel)}.${esc(rollupFieldDef.label || rollupField)}</h1><p class="page-subtitle">${records.length} total records</p></div>
    </div>
    ${notice}
    ${barChart(buckets)}`;
  return page(user, `${label} Report | Thatcher`, null, content);
}

export function renderCountOverTimeReport(user, entityName, spec, records, dateField, granularity) {
  const label = getEntityLabel(spec, true) || entityName;
  const fieldDef = spec.fields?.[dateField];
  if (!fieldDef) {
    return page(user, `${label} | Report`, null,
      `<div class="page-header"><h1 class="page-title">${esc(label)}</h1></div>
      <div class="report-empty-state">Unknown date field "${esc(dateField)}" for this entity.</div>`);
  }
  const { buckets, unresolved, truncated } = countOverTime(records, dateField, granularity);
  const notice = unresolved
    ? `<div class="report-notice">${unresolved} record${unresolved === 1 ? '' : 's'} without a resolvable date excluded</div>`
    : '';
  const truncatedNotice = truncated
    ? `<div class="report-notice">Showing the most recent ${buckets.length} periods only</div>`
    : '';
  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)} over time</h1><p class="page-subtitle">${records.length} total records, grouped by ${esc(granularity)}</p></div>
    </div>
    ${notice}${truncatedNotice}
    ${barChart(buckets)}`;
  return page(user, `${label} Report | Thatcher`, null, content);
}

// One table per-product rather than a bar chart: unlike count-by-field/
// sum-by-field's single grouped metric, a forecast is inherently multiple
// values per row (stock, consumption rate, days-out, reorder date) -- a bar
// chart of any single one of those would discard the others, so a table is
// the correct shape here, reusing the same page()/esc() rendering discipline
// as every other report rather than inventing a new chart type.
export function renderInventoryForecastReport(user, spec, forecastRows) {
  const label = getEntityLabel(spec, true) || 'Products';
  const rows = forecastRows.map(p => {
    const daysLabel = p.days_until_stockout == null ? 'Unknown' : String(Math.round(p.days_until_stockout))
    const reorderLabel = p.reorder_date == null ? '-' : new Date(p.reorder_date * 1000).toISOString().slice(0, 10)
    const rowCls = p.reorder_due ? 'style="background:var(--color-danger-bg,#fee2e2)"' : ''
    return `<tr ${rowCls}>
      <td>${esc(p.name || p.id)}</td>
      <td>${esc(String(p.current_stock))}</td>
      <td>${esc((p.avg_daily_consumption || 0).toFixed(2))}</td>
      <td>${esc(daysLabel)}</td>
      <td>${esc(reorderLabel)}${p.reorder_due ? ' <span class="pill pill-danger">Reorder Now</span>' : ''}</td>
    </tr>`;
  }).join('') || emptyState('No products to forecast', 'bar-chart');

  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)}: Inventory Forecast</h1><p class="page-subtitle">${forecastRows.length} products</p></div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Product</th><th>Current Stock</th><th>Avg Daily Use</th><th>Days Until Stockout</th><th>Suggested Reorder</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  return page(user, `Inventory Forecast | Thatcher`, null, content);
}

// Reuses sumBarChart (already built for sum-by-field's currency-aware bar
// rendering) rather than inventing a third chart type -- a demand-by-month
// bucket is the exact same [label, numericValue] shape sum-by-field already
// renders, just currency-formatted since weighted_value derives from a
// currency field.
// Two-dimensional cross-tab: row_field x col_field, cell = aggregated
// value_field. Distinct from countByField/sumByField (single-dimension
// group-bys) -- this is the only report shape that can answer "how does X
// break down by Y AND Z simultaneously". Both axes independently collapse
// past MAX_BUCKETS into an '(other)' bucket the same way countByField does,
// so a high-cardinality field on either axis can't blow up the table.
const PIVOT_AGGREGATORS = {
  sum: (values) => values.reduce((a, b) => a + b, 0),
  count: (values) => values.length,
  avg: (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
};

function topBucketLabels(records, spec, field) {
  const counts = new Map();
  for (const r of records) {
    const label = bucketLabel(spec, field, r[field]);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
  if (sorted.length <= MAX_BUCKETS) return new Set(sorted);
  return new Set(sorted.slice(0, MAX_BUCKETS - 1));
}

export function pivotByFields(records, spec, rowField, colField, valueField, agg = 'count') {
  const aggregator = PIVOT_AGGREGATORS[agg] || PIVOT_AGGREGATORS.count;
  const rowKeep = topBucketLabels(records, spec, rowField);
  const colKeep = topBucketLabels(records, spec, colField);
  const cellValues = new Map();
  const rowLabels = new Set();
  const colLabels = new Set();

  for (const r of records) {
    const rawRow = bucketLabel(spec, rowField, r[rowField]);
    const rawCol = bucketLabel(spec, colField, r[colField]);
    const rowLabel = rowKeep.has(rawRow) ? rawRow : '(other)';
    const colLabel = colKeep.has(rawCol) ? rawCol : '(other)';
    rowLabels.add(rowLabel);
    colLabels.add(colLabel);
    const key = rowLabel + ' ' + colLabel;
    const raw = agg === 'count' ? 1 : (typeof r[valueField] === 'string' ? Number(r[valueField]) : r[valueField]);
    if (agg !== 'count' && (typeof raw !== 'number' || isNaN(raw))) continue;
    if (!cellValues.has(key)) cellValues.set(key, []);
    cellValues.get(key).push(agg === 'count' ? 1 : raw);
  }

  const rows = [...rowLabels].sort((a, b) => a === '(other)' ? 1 : b === '(other)' ? -1 : a.localeCompare(b));
  const cols = [...colLabels].sort((a, b) => a === '(other)' ? 1 : b === '(other)' ? -1 : a.localeCompare(b));
  const cells = rows.map(rowLabel =>
    cols.map(colLabel => {
      const values = cellValues.get(rowLabel + ' ' + colLabel);
      return values ? aggregator(values) : 0;
    })
  );

  return { rows, cols, cells };
}

export function renderPivotReport(user, entityName, spec, records, rowField, colField, valueField, agg) {
  const label = getEntityLabel(spec, true) || entityName;
  const rowFieldDef = spec.fields?.[rowField];
  const colFieldDef = spec.fields?.[colField];
  const validAgg = PIVOT_AGGREGATORS[agg] ? agg : 'count';
  const valueFieldDef = validAgg === 'count' ? null : spec.fields?.[valueField];
  if (!rowFieldDef || !colFieldDef || (validAgg !== 'count' && !valueFieldDef)) {
    const badField = !rowFieldDef ? rowField : !colFieldDef ? colField : valueField;
    return page(user, `${label} | Report`, null,
      `<div class="page-header"><h1 class="page-title">${esc(label)}</h1></div>
      <div class="report-empty-state">Unknown field "${esc(badField)}" for this entity.</div>`);
  }
  const { rows, cols, cells } = pivotByFields(records, spec, rowField, colField, valueField, validAgg);
  const formatCell = (v) => validAgg === 'avg' ? String(Math.round(v * 100) / 100) : (valueFieldDef ? formatSumValue(v, valueFieldDef) : String(v));
  const headerCells = cols.map(c => `<th>${esc(c)}</th>`).join('');
  const bodyRows = rows.map((r, i) => {
    const dataCells = cells[i].map(v => `<td style="text-align:right">${esc(formatCell(v))}</td>`).join('');
    return `<tr><td>${esc(r)}</td>${dataCells}</tr>`;
  }).join('') || emptyState('No data to report on', 'bar-chart');
  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)}: ${esc(rowFieldDef.label || rowField)} &times; ${esc(colFieldDef.label || colField)} (${esc(validAgg)}${valueFieldDef ? ' of ' + esc(valueFieldDef.label || valueField) : ''})</h1><p class="page-subtitle">${records.length} total records</p></div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th></th>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table></div>`;
  return page(user, `${label} Report | Thatcher`, null, content);
}

export function renderDemandForecastReport(user, spec, buckets, totalOpportunities) {
  const label = getEntityLabel(spec, true) || 'Opportunities';
  const valueFieldDef = spec.fields?.value || { type: 'currency' };
  const totalProjected = buckets.reduce((sum, [, v]) => sum + v, 0);
  const notice = !buckets.length
    ? `<div class="report-notice">No open opportunities with a future expected close date</div>`
    : '';
  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)}: Demand Forecast</h1><p class="page-subtitle">${totalOpportunities} total opportunities, ${esc(formatSumValue(totalProjected, valueFieldDef))} projected across ${buckets.length} future month${buckets.length === 1 ? '' : 's'}</p></div>
    </div>
    ${notice}
    ${sumBarChart(buckets, valueFieldDef)}`;
  return page(user, `Demand Forecast | Thatcher`, null, content);
}
