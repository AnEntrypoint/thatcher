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
