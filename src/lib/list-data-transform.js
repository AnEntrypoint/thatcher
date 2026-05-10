export function filterByQuery(data, query, searchFields = ['name', 'title', 'description']) {
  if (!query) return data;
  const lower = query.toLowerCase();
  return data.filter(row =>
    searchFields.some(field =>
      String(row[field] || '').toLowerCase().includes(lower)
    )
  );
}

export function groupByField(data, field) {
  if (!field) return { '': data };
  return data.reduce((acc, row) => {
    const g = row[field] || 'Other';
    (acc[g] = acc[g] || []).push(row);
    return acc;
  }, {});
}

export function compareValues(a, b, dir = 'asc') {
  if (a == null && b == null) return 0;
  if (a == null) return dir === 'asc' ? 1 : -1;
  if (b == null) return dir === 'asc' ? -1 : 1;
  const cmp = a < b ? -1 : a > b ? 1 : 0;
  return dir === 'asc' ? cmp : -cmp;
}

export function sortByField(rows, field, dir) {
  if (!field) return rows;
  return [...rows].sort((a, b) => compareValues(a[field], b[field], dir));
}

export function sortGroups(grouped, field, dir) {
  const result = {};
  for (const [group, rows] of Object.entries(grouped)) {
    result[group] = sortByField(rows, field, dir);
  }
  return result;
}
