import { page } from '@/ui/layout.js';
import { esc, fmtVal, TABLE_SCRIPT, emptyRow } from '@/ui/render-helpers.js';
import { getDefaultSort, getAvailableFilters, getPageSize, getEntityLabel } from '@/config/spec-helpers.js';

const EMBEDDED_TYPES = new Set(['json', 'embedded']);

function getColumns(spec) {
  const fields = spec?.fields || {};
  const override = spec?.list?.columns;
  if (Array.isArray(override) && override.length) {
    return override
      .filter(key => fields[key])
      .map(key => [key, fields[key]]);
  }
  return Object.entries(fields).filter(([, f]) =>
    !f.hidden && !EMBEDDED_TYPES.has(f.type)
  );
}

function isEditable(field) {
  return field && field.readonly !== true;
}

function gridRow(entityName, item, columns) {
  const cells = columns.map(([key, field]) => {
    const value = item[key];
    const rendered = fmtVal(value, key, item);
    const editableAttr = isEditable(field) ? ` data-editable="${esc(key)}"` : '';
    return `<td data-col="${esc(key)}"${editableAttr}>${rendered}</td>`;
  }).join('');
  return `<tr data-row data-navigate="/${esc(entityName)}/${esc(item.id)}" style="cursor:pointer">${cells}</tr>`;
}

export function renderGridView(user, entityName, spec, records, options = {}) {
  const label = getEntityLabel(spec, true) || entityName;
  const columns = getColumns(spec);
  const defaultSort = getDefaultSort(spec);
  const filters = getAvailableFilters(spec);
  const pageSize = getPageSize(spec);

  const headerCells = columns.map(([key, field]) => {
    const colLabel = esc(field?.label || key);
    const isDefaultSort = key === defaultSort.field;
    return `<th data-sort="${esc(key)}" aria-label="Sort by ${colLabel}"${isDefaultSort ? ` class="sort-${esc(defaultSort.dir)}"` : ''}>${colLabel}</th>`;
  }).join('');

  const filterControls = filters.map(f => {
    const fieldKey = typeof f === 'string' ? f : f.field;
    const fieldSpec = spec.fields?.[fieldKey];
    const filterLabel = esc(fieldSpec?.label || fieldKey);
    const opts = (fieldSpec?.options || f.options || []).map(o => {
      const value = typeof o === 'string' ? o : o.value;
      const optLabel = typeof o === 'string' ? o : (o.label || o.value);
      return `<option value="${esc(value)}">${esc(optLabel)}</option>`;
    }).join('');
    return `<div class="table-filter"><select data-filter="${esc(fieldKey)}" id="filter-${esc(fieldKey)}" aria-label="Filter by ${filterLabel}"><option value="">All ${filterLabel}</option>${opts}</select></div>`;
  }).join('');

  const rows = records.map(item => gridRow(entityName, item, columns)).join('') ||
    emptyRow(columns.length || 1, `No ${esc(label.toLowerCase())} found`);

  const content = `<div class="page-header">
        <div><h1 class="page-title">${esc(label)}</h1><p class="page-subtitle">${records.length} total ${esc(label.toLowerCase())}</p></div>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="table-search"><input id="search-input" type="text" placeholder="Search ${esc(label.toLowerCase())}..."></div>
          ${filterControls}
          <span class="table-count" id="row-count">${records.length} items</span>
        </div>
        <table class="data-table" role="grid" data-page-size="${esc(pageSize)}">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  return page(user, `${label} | Thatcher`, null, content, [TABLE_SCRIPT]);
}
