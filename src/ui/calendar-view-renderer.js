import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { getEntityLabel } from '@/config/spec-helpers.js';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function calendarDateField(spec) {
  if (spec.list?.dateField) return spec.list.dateField;
  const entries = Object.entries(spec.fields || {});
  const found = entries.find(([, f]) => f.type === 'date' || f.type === 'timestamp');
  return found ? found[0] : null;
}

function toDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!isNaN(num) && num > 0) return new Date(num * 1000);
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function calendarChip(entityName, record, titleField) {
  const title = esc(record[titleField] ?? record.id);
  return `<div class="calendar-chip" data-navigate="/${esc(entityName)}/${esc(record.id)}">${title}</div>`;
}

function calendarTitleField(spec) {
  if (spec.list?.titleField) return spec.list.titleField;
  const candidates = ['name', 'title', 'label'];
  for (const c of candidates) if (spec.fields?.[c]) return c;
  const first = Object.keys(spec.fields || {}).find(k => spec.fields[k]?.type === 'text');
  return first || 'id';
}

export function renderCalendarView(user, entityName, spec, records, options = {}) {
  const label = getEntityLabel(spec, true) || entityName;
  const dateField = calendarDateField(spec);
  const titleField = calendarTitleField(spec);

  const now = new Date();
  const year = Number(options.year) || now.getFullYear();
  const month = options.month !== undefined ? Number(options.month) : now.getMonth();

  const byDay = {};
  const undated = [];

  for (const r of records) {
    const d = dateField ? toDateOrNull(r[dateField]) : null;
    if (!d) { undated.push(r); continue; }
    const key = dayKey(d);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(r);
  }

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push('<div class="calendar-cell calendar-cell-empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${month}-${day}`;
    const dayRecords = byDay[key] || [];
    const chips = dayRecords.map(r => calendarChip(entityName, r, titleField)).join('');
    const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
    cells.push(`<div class="calendar-cell${isToday ? ' calendar-cell-today' : ''}">
      <div class="calendar-cell-date">${day}</div>
      <div class="calendar-cell-chips">${chips}</div>
    </div>`);
  }

  const totalCells = startWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells.push('<div class="calendar-cell calendar-cell-empty"></div>');

  const dayHeaders = DAY_NAMES.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  let prevMonth = month - 1, prevYear = year;
  if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
  let nextMonth = month + 1, nextYear = year;
  if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }

  const undatedSection = undated.length
    ? `<div class="calendar-undated">
        <h3>Undated (${undated.length})</h3>
        <div class="calendar-undated-list">${undated.map(r => calendarChip(entityName, r, titleField)).join('')}</div>
      </div>`
    : '';

  const noDateFieldNotice = !dateField
    ? `<div class="calendar-empty-state">This entity has no date field configured; all records are shown as undated.</div>`
    : '';

  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)}</h1><p class="page-subtitle">${records.length} items</p></div>
    </div>
    ${noDateFieldNotice}
    <div class="calendar-toolbar">
      <a class="calendar-nav-link" href="?month=${prevMonth}&year=${prevYear}">&laquo; Prev</a>
      <span class="calendar-month-label">${MONTH_NAMES[month]} ${year}</span>
      <a class="calendar-nav-link" href="?month=${nextMonth}&year=${nextYear}">Next &raquo;</a>
    </div>
    <div class="calendar-grid">
      ${dayHeaders}
      ${cells.join('')}
    </div>
    ${undatedSection}`;

  return page(user, `${label} | Calendar`, null, content);
}

function timelineFields(spec) {
  if (spec.list?.timelineStart && spec.list?.timelineEnd) {
    return [spec.list.timelineStart, spec.list.timelineEnd];
  }
  const fields = spec.fields || {};
  const startCandidates = ['start_date', 'start'];
  const endCandidates = ['end_date', 'due_date', 'end', 'deadline'];
  const start = startCandidates.find(k => fields[k]) || null;
  const end = endCandidates.find(k => fields[k]) || null;
  return [start, end];
}

function timelineTitleField(spec) {
  if (spec.list?.titleField) return spec.list.titleField;
  const candidates = ['name', 'title', 'label'];
  for (const c of candidates) if (spec.fields?.[c]) return c;
  const first = Object.keys(spec.fields || {}).find(k => spec.fields[k]?.type === 'text');
  return first || 'id';
}

export function renderTimelineView(user, entityName, spec, records, options = {}) {
  const label = getEntityLabel(spec, true) || entityName;
  const [startField, endField] = timelineFields(spec);
  const titleField = timelineTitleField(spec);

  const plotted = [];
  let missing = 0;

  for (const r of records) {
    const start = startField ? toDateOrNull(r[startField]) : null;
    const end = endField ? toDateOrNull(r[endField]) : null;
    if (!start || !end) { missing++; continue; }
    plotted.push({ record: r, start, end });
  }

  if (!startField || !endField) {
    return page(user, `${label} | Timeline`, null,
      `<div class="page-header">
        <div><h1 class="page-title">${esc(label)}</h1><p class="page-subtitle">${records.length} items</p></div>
      </div>
      <div class="timeline-empty-state">This entity has no start/end date fields configured; timeline view requires <code>list.timelineStart</code>/<code>list.timelineEnd</code> or matching field names.</div>`);
  }

  const missingNotice = missing
    ? `<div class="timeline-missing-notice">${missing} item${missing === 1 ? '' : 's'} without dates not shown</div>`
    : '';

  if (!plotted.length) {
    const content = `<div class="page-header">
        <div><h1 class="page-title">${esc(label)}</h1><p class="page-subtitle">${records.length} items</p></div>
      </div>
      ${missingNotice}
      <div class="timeline-empty-state">No items have both a start and end date.</div>`;
    return page(user, `${label} | Timeline`, null, content);
  }

  const minTime = Math.min(...plotted.map(p => p.start.getTime()));
  const maxTime = Math.max(...plotted.map(p => p.end.getTime()));
  const span = Math.max(1, maxTime - minTime);

  const rows = plotted.map(({ record, start, end }) => {
    const title = esc(record[titleField] ?? record.id);
    const offsetPct = ((start.getTime() - minTime) / span) * 100;
    const widthPct = Math.max(1, ((end.getTime() - start.getTime()) / span) * 100);
    return `<div class="timeline-row">
      <div class="timeline-row-label">${title}</div>
      <div class="timeline-row-track">
        <div class="timeline-bar" data-navigate="/${esc(entityName)}/${esc(record.id)}" style="margin-left:${offsetPct}%;width:${widthPct}%"></div>
      </div>
    </div>`;
  }).join('');

  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(label)}</h1><p class="page-subtitle">${records.length} items</p></div>
    </div>
    ${missingNotice}
    <div class="timeline-view">${rows}</div>`;

  return page(user, `${label} | Timeline`, null, content);
}
