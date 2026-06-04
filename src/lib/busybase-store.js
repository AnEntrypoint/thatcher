/**
 * BusyBase data store — async replacement for the better-sqlite3 query engine.
 *
 * busybase is a Supabase-style async document store (LanceDB) with no SQL joins or
 * foreign keys, so the relational behaviours of the old query-engine are reimplemented
 * here in JS:
 *   - ref "display" fields (old LEFT JOIN) -> client-side lookup of the referenced row
 *   - soft-delete / archive filtering       -> in-memory predicate on the result set
 *   - sort / limit / offset                  -> busybase order()/range()
 *
 * Every export is async (busybase is async); callers are the already-async API route
 * handlers and crud-handlers, so the await ripple terminates at an existing boundary.
 *
 * Requires Bun (busybase embedded uses Bun.password + the vectordb native binding).
 */

import { getSpec } from '../config/spec-helpers.js';
import { RECORD_STATUS } from '../config/constants.js';
import { genId, now } from './id-helpers.js';

let _client = null;

/** Set the initialised busybase client (embedded or remote). Called once at bootstrap. */
export function setBusyBaseClient(client) {
  _client = client;
}

function client() {
  if (!_client) throw new Error('BusyBase store not initialised. Call setBusyBaseClient() first.');
  return _client;
}

/** busybase uses the entity name as the table; map the special `user` -> `users`. */
function tableName(entity) {
  return entity === 'user' ? 'users' : entity;
}

function unwrap({ data, error }, op) {
  if (error) throw new Error(`BusyBase ${op} failed: ${error.message || error}`);
  return data;
}

/**
 * Resolve ref "display" fields for a set of rows the way the old LEFT JOIN did:
 * for every ref field with a `display` spec, fetch the referenced rows and attach
 * `<field>_display`. Batched per ref-table to avoid N+1 within a single field.
 */
async function attachRefDisplays(entity, rows) {
  if (!rows.length) return rows;
  const spec = getSpec(entity);
  const refFields = Object.entries(spec.fields || {}).filter(([, f]) => f.type === 'ref' && f.display);
  if (!refFields.length) return rows;

  for (const [key, f] of refFields) {
    const refTable = tableName(f.ref);
    const displayField = (f.display.split('.')[1]) || 'name';
    const ids = [...new Set(rows.map(r => r[key]).filter(v => v != null))];
    if (!ids.length) continue;
    const refRows = unwrap(await client().from(refTable).select('*').in('id', ids), 'ref-resolve');
    const byId = new Map(refRows.map(r => [String(r.id), r]));
    for (const r of rows) {
      const ref = r[key] != null ? byId.get(String(r[key])) : null;
      if (ref) r[`${key}_display`] = ref[displayField];
    }
  }
  return rows;
}

/** Apply soft-delete / archive default filtering in memory (no SQL WHERE). */
function applyVisibility(spec, rows, where, options) {
  let out = rows;
  if (spec.fields?.status && !('status' in where) && !options.includeDeleted) {
    out = out.filter(r => r.status !== RECORD_STATUS.DELETED);
  }
  if (spec.fields?.archived && !('archived' in where) && !options.includeArchived) {
    out = out.filter(r => !r.archived || r.archived === 0);
  }
  return out;
}

function applyWhere(builder, where) {
  for (const [k, v] of Object.entries(where)) {
    if (v !== undefined && v !== null) builder = builder.eq(k, v);
  }
  return builder;
}

/** List records (optionally filtered), with ref-display + visibility + sort/limit. */
export async function list(entity, where = {}, options = {}) {
  const spec = getSpec(entity);
  const tbl = tableName(entity);
  let rows = unwrap(await applyWhere(client().from(tbl).select('*'), where), 'list');
  rows = applyVisibility(spec, rows, where, options);

  const sort = options.sort || spec.list?.defaultSort;
  if (sort && sort.field && spec.fields?.[sort.field]) {
    const desc = (sort.dir || 'ASC').toUpperCase() === 'DESC';
    rows.sort((a, b) => {
      const av = a[sort.field], bv = b[sort.field];
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (desc ? -1 : 1);
    });
  }
  if (options.offset || options.limit) {
    const off = parseInt(options.offset || 0, 10);
    const lim = options.limit ? parseInt(options.limit, 10) : rows.length;
    rows = rows.slice(off, off + lim);
  }
  return attachRefDisplays(entity, rows);
}

/** Count records matching `where` (after visibility filtering). */
export async function count(entity, where = {}, options = {}) {
  const spec = getSpec(entity);
  const tbl = tableName(entity);
  let rows = unwrap(await applyWhere(client().from(tbl).select('*'), where), 'count');
  rows = applyVisibility(spec, rows, where, options);
  return rows.length;
}

export async function listWithPagination(entity, where = {}, page = 1, pageSize = 50) {
  const finalPage = Math.max(1, page);
  const total = await count(entity, where);
  const items = await list(entity, where, { offset: (finalPage - 1) * pageSize, limit: pageSize });
  return { items, pagination: { page: finalPage, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function get(entity, id) {
  const tbl = tableName(entity);
  const row = unwrap(await client().from(tbl).select('*').eq('id', id).maybeSingle(), 'get');
  if (!row) return null;
  const [withDisplay] = await attachRefDisplays(entity, [row]);
  return withDisplay;
}

export async function getBy(entity, field, value) {
  const tbl = tableName(entity);
  return unwrap(await client().from(tbl).select('*').eq(field, value).maybeSingle(), 'getBy');
}

export async function create(entity, data, user) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);
  const tbl = tableName(entity);

  const record = {
    ...data,
    id: data.id || genId(),
    created_by: user?.id || '',
    created_at: now(),
    updated_at: 0,
    status: data.status || RECORD_STATUS.ACTIVE,
  };
  for (const [key, field] of Object.entries(spec.fields || {})) {
    if (field.auto === 'uuid' && !record[key]) record[key] = genId();
    if (field.auto === 'timestamp' && !record[key]) record[key] = now();
  }
  // LanceDB cannot infer a column's type from a null on first insert; coerce any
  // null/undefined to a typed sentinel ('' for strings) so the insert schema is stable.
  for (const k of Object.keys(record)) {
    if (record[k] === null || record[k] === undefined) record[k] = '';
  }
  const [created] = unwrap(await client().from(tbl).insert(record), 'create');
  return created || record;
}

export async function update(entity, id, data) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);
  const tbl = tableName(entity);

  const existing = await get(entity, id);
  if (!existing) throw new Error(`${entity} with id ${id} not found`);

  const patch = { ...data, updated_at: now() };
  unwrap(await client().from(tbl).update(patch).eq('id', id), 'update');
  return get(entity, id);
}

export async function remove(entity, id) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);
  const tbl = tableName(entity);

  const existing = await get(entity, id);
  if (!existing) throw new Error(`${entity} with id ${id} not found`);

  if (spec.fields && 'status' in spec.fields) {
    unwrap(await client().from(tbl).update({ status: RECORD_STATUS.DELETED, updated_at: now() }).eq('id', id), 'soft-delete');
    return { ...existing, status: RECORD_STATUS.DELETED };
  }
  if (spec.fields && 'archived' in spec.fields) {
    unwrap(await client().from(tbl).update({ archived: 1, updated_at: now() }).eq('id', id), 'archive');
    return { ...existing, archived: 1 };
  }
  unwrap(await client().from(tbl).delete().eq('id', id), 'delete');
  return existing;
}

export async function bulkCreate(entity, records, user) {
  const out = [];
  for (const data of records) out.push(await create(entity, data, user));
  return out;
}

/**
 * Substring search across the entity's text-ish fields (busybase has no FTS, so this
 * is the in-memory equivalent of the old LIKE fallback). Returns visible rows only.
 */
export async function search(entity, query, where = {}, options = {}) {
  const spec = getSpec(entity);
  const rows = await list(entity, where, { ...options, limit: undefined, offset: undefined });
  const q = String(query || '').toLowerCase();
  if (!q) return rows;
  const fields = Object.keys(spec.fields || {}).filter(
    f => ['text', 'textarea', 'email'].includes(spec.fields[f].type)
  );
  let matched = rows.filter(r => fields.some(f => String(r[f] ?? '').toLowerCase().includes(q)));
  if (options.offset || options.limit) {
    const off = parseInt(options.offset || 0, 10);
    const lim = options.limit ? parseInt(options.limit, 10) : matched.length;
    matched = matched.slice(off, off + lim);
  }
  return matched;
}

export async function searchWithPagination(entity, query, where = {}, page = 1, pageSize = null) {
  const spec = getSpec(entity);
  const finalPageSize = pageSize || spec.list?.pageSize || 50;
  const finalPage = Math.max(1, page);
  const all = await search(entity, query, where);
  const total = all.length;
  const items = all.slice((finalPage - 1) * finalPageSize, finalPage * finalPageSize);
  return { items, pagination: { page: finalPage, pageSize: finalPageSize, total, totalPages: Math.ceil(total / finalPageSize) } };
}

/** Children of a parent via foreign-key field (old: WHERE fk = ? AND status != deleted). */
export async function getChildren(parentEntity, parentId, childDef) {
  const fk = childDef.fk || childDef.foreignKey || `${parentEntity}_id`;
  return list(childDef.entity, { [fk]: parentId });
}

/** Batch-fetch children for several child definitions. */
export async function batchGetChildren(parentEntity, parentId, childSpecs) {
  const defs = Array.isArray(childSpecs)
    ? childSpecs.map(e => [e, { entity: e }])
    : Object.entries(childSpecs);
  const out = {};
  for (const [key, def] of defs) {
    out[key] = await getChildren(parentEntity, parentId, def.entity ? def : { entity: key, ...def });
  }
  return out;
}
