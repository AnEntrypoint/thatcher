import { getColumns } from '@/ui/grid-view-renderer.js';

const FORMULA_PREFIXES = ['=', '+', '-', '@'];

function neutralizeFormula(str) {
  if (str.length && FORMULA_PREFIXES.includes(str[0])) return `'${str}`;
  return str;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  str = neutralizeFormula(str);
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildCsv(entityName, spec, records) {
  const columns = getColumns(spec);
  const header = columns.map(([key, field]) => csvCell(field?.label || key)).join(',');
  const rows = records.map(item =>
    columns.map(([key]) => csvCell(item[key])).join(',')
  );
  return [header, ...rows].join('\r\n');
}

export function csvFilename(entityName) {
  return `${entityName}-export-${Date.now()}.csv`;
}
