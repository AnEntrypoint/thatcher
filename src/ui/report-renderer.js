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
