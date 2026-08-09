import { getColumns } from '@/ui/grid-view-renderer.js';
import { validateEntity, sanitizeData } from '@/lib/validation/index.js';
import { create } from '@/lib/busybase/store.js';

const MAX_IMPORT_ROWS = 10000;

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return { header: [], records: [] };
  const [header, ...dataRows] = rows;
  const malformedRows = [];
  const records = dataRows.map((cells, idx) => {
    if (cells.length !== header.length) {
      malformedRows.push({ row: idx + 2, error: `Expected ${header.length} columns, got ${cells.length}` });
      return null;
    }
    const obj = {};
    header.forEach((key, i) => { obj[key] = cells[i]; });
    return obj;
  });
  return { header, records, malformedRows };
}

export async function importCsv(entityName, spec, csvText, user) {
  if (csvText.length > 5 * 1024 * 1024) {
    return { ok: false, error: 'CSV exceeds 5MB import limit' };
  }
  const columns = getColumns(spec);
  const labelToKey = {};
  columns.forEach(([key, field]) => { labelToKey[field?.label || key] = key; });

  const { header, records, malformedRows } = parseCsv(csvText);
  if (!header.length) return { ok: false, error: 'CSV has no header row' };
  if (records.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `CSV exceeds ${MAX_IMPORT_ROWS}-row import limit` };
  }

  const results = malformedRows.map(m => ({ row: m.row, success: false, error: m.error }));
  let rowNum = 1;
  for (const raw of records) {
    rowNum++;
    if (raw === null) continue;
    const mapped = {};
    for (const [csvKey, value] of Object.entries(raw)) {
      const fieldKey = labelToKey[csvKey] || csvKey;
      mapped[fieldKey] = value;
    }
    try {
      const errors = await validateEntity(entityName, mapped);
      if (Object.keys(errors).length > 0) {
        results.push({ row: rowNum, success: false, error: JSON.stringify(errors) });
        continue;
      }
      const sanitized = sanitizeData(entityName, mapped, spec);
      const record = await create(entityName, sanitized, user);
      results.push({ row: rowNum, success: true, id: record.id });
    } catch (err) {
      results.push({ row: rowNum, success: false, error: err.message });
    }
  }

  results.sort((a, b) => a.row - b.row);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.length - succeeded;
  return { ok: true, total: results.length, succeeded, failed, results };
}
