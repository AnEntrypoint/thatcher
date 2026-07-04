/*
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

export function setBusyBaseClient(client) {
  _client = client;
}

function client() {
  if (!_client) throw new Error('BusyBase store not initialised. Call setBusyBaseClient() first.');
  return _client;
}

// busybase uses the entity name as the table; map the special `user` -> `users`.
function tableName(entity) {
  return entity === 'user' ? 'users' : entity;
}

function unwrap({ data, error }, op) {
  if (error) throw new Error(`BusyBase ${op} failed: ${error.message || error}`);
  return data;
}

// Resolve ref "display" fields for a set of rows the way the old LEFT JOIN did:
// for every ref field with a `display` spec, fetch the referenced rows and attach
// `<field>_display`. Batched per ref-table to avoid N+1 within a single field.
//
// getSpec returns null for raw infra tables (sessions, audit_logs, structured_logs,
// password_reset_tokens, mwr_bridge_tokens, email, activity_log, ...) that aren't
// config entities. Treat those as plain document tables: no ref-display, no
// soft-delete, hard CRUD. specOf() guarantees a usable shape.
function specOf(entity) {
  return getSpec(entity) || { fields: {}, raw: true };
}

async function attachRefDisplays(entity, rows) {
  if (!rows.length) return rows;
  const spec = specOf(entity);
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

// Apply soft-delete / archive default filtering in memory (no SQL WHERE).
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

// Compile a where-object onto the busybase query builder. A scalar value is an
// equality (the original behaviour); an operator object opens range/set/negation
// filters the builder already supports (sdk.js eq/neq/gt/gte/lt/lte/in/like/ilike,
// and a top-level $or clause). This lets a config-driven query express "today"
// (created_at between), "near me" (a lat/lon bounding box), and "open" (status in
// the non-terminal set) without the caller hand-rolling JS filters. Operators are a
// small fixed allowlist; an unknown operator key throws rather than silently
// matching everything (a wrong filter must fail loud, not leak rows).
const WHERE_OPS = {
  $eq: (b, k, v) => b.eq(k, v),
  $ne: (b, k, v) => b.neq(k, v),
  $gt: (b, k, v) => b.gt(k, v),
  $gte: (b, k, v) => b.gte(k, v),
  $lt: (b, k, v) => b.lt(k, v),
  $lte: (b, k, v) => b.lte(k, v),
  $in: (b, k, v) => b.in(k, Array.isArray(v) ? v : [v]),
  $like: (b, k, v) => b.like(k, v),
  $ilike: (b, k, v) => b.ilike(k, v),
};
function applyWhere(builder, where) {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined || v === null) continue;
    // Top-level $or: an array of {field: value|operator-object} sub-clauses,
    // OR-joined (e.g. find a case the worker reported OR is assigned to).
    // LIMITATION: busybase's or() parser splits the compiled clause string on
    // ',' (between sub-filters) and '.' (between field/op/value), and there is
    // no escaping mechanism -- a value containing either character (e.g.
    // 'Underberg, KZN' or '1.5') cannot be represented and would corrupt the
    // clause into bogus sub-filters that silently leak or miss rows. Fail loud
    // instead: reject such values here. Callers needing them must use a
    // non-$or filter (eq/like) or restructure the query.
    if (k === '$or' && Array.isArray(v)) {
      const assertOrSafe = (val) => {
        const s = String(val);
        if (s.includes(',') || s.includes('.')) {
          throw new Error(
            `busybase applyWhere: $or sub-clause value ${JSON.stringify(s)} contains ',' or '.', ` +
            `which busybase's or() delimiter syntax cannot escape; use a non-$or filter for this value`
          );
        }
        return s;
      };
      // busybase's or() parser reads PostgREST order: field.op.value (NOT
      // op.field.value -- a mismatched sub-clause parses to null and is
      // silently dropped, making the $or match everything).
      const clause = v.map(sub => Object.entries(sub).map(([sk, sv]) => {
        if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
          const [op, ov] = Object.entries(sv)[0];
          const bare = op.replace(/^\$/, '');
          return `${sk}.${bare}.${Array.isArray(ov) ? ov.map(assertOrSafe).join(',') : assertOrSafe(ov)}`;
        }
        return `${sk}.eq.${assertOrSafe(sv)}`;
      }).join(',')).join(',');
      builder = builder.or(clause);
      continue;
    }
    // An operator object: { $gte: x, $lt: y } applies each supported operator.
    if (typeof v === 'object' && !Array.isArray(v)) {
      for (const [op, ov] of Object.entries(v)) {
        const fn = WHERE_OPS[op];
        if (!fn) throw new Error(`busybase applyWhere: unsupported operator ${op} on field ${k}`);
        builder = fn(builder, k, ov);
      }
      continue;
    }
    // A bare array value is an IN set; a scalar is equality.
    builder = Array.isArray(v) ? builder.in(k, v) : builder.eq(k, v);
  }
  return builder;
}

export async function list(entity, where = {}, options = {}) {
  const spec = specOf(entity);
  const tbl = tableName(entity);
  let rows = unwrap(await applyWhere(client().from(tbl).select('*'), where), 'list');
  rows = applyVisibility(spec, rows, where, options);

  // Row-access scoping: when a caller passes options.user AND the entity declares
  // rowAccess, restrict the rows to what that user may see (their assigned cases,
  // their team, etc.). Opt-in -- no user means the read is unchanged, so internal
  // and admin callers are unaffected. This makes a config row_access spec actually
  // enforced on the read path (previously list() took no user, so the spec was
  // inert and a scoped enquiry would leak every row).
  if (options.user && (spec.rowAccess || spec.row_access)) {
    const { permissionService } = await import('../services/permission.service.js');
    rows = permissionService.filterRecords(options.user, spec, rows);
  }

  // Sort accepts a single {field,dir} (the original) OR an ARRAY of them for
  // tie-broken order (e.g. [{field:'priority',dir:'DESC'},{field:'last_event_at',
  // dir:'DESC'}]) -- so a recency-with-tiebreak list is config, not a JS sort in
  // the caller. Each key is guarded against spec.fields; unknown keys are skipped.
  const sortSpec = options.sort || spec.list?.defaultSort;
  const sortKeys = (Array.isArray(sortSpec) ? sortSpec : sortSpec ? [sortSpec] : [])
    .filter(s => s && s.field && spec.fields?.[s.field]);
  if (sortKeys.length) {
    rows.sort((a, b) => {
      for (const s of sortKeys) {
        const av = a[s.field], bv = b[s.field];
        if (av === bv) continue;
        const desc = (s.dir || 'ASC').toUpperCase() === 'DESC';
        return (av > bv ? 1 : -1) * (desc ? -1 : 1);
      }
      return 0;
    });
  }
  if (options.offset || options.limit) {
    const off = parseInt(options.offset || 0, 10);
    const lim = options.limit ? parseInt(options.limit, 10) : rows.length;
    rows = rows.slice(off, off + lim);
  }
  return attachRefDisplays(entity, rows);
}

export async function count(entity, where = {}, options = {}) {
  const spec = specOf(entity);
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
  const spec = specOf(entity);
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
  unwrap(await client().from(tbl).insert(record), 'create');
  // Always return the locally-constructed record: it holds the genId we put in
  // the TEXT id column. The store's insert() may return a rowid/driver shape, so
  // trusting `created` would hand callers the wrong id.
  return record;
}

// opts.expectedVersion: optional optimistic-concurrency guard. When supplied,
// the write is conditioned on the row's internal _version counter still
// matching the value the caller last read (a plain read-then-write otherwise
// has no way to detect a concurrent writer landing in between -- whichever
// caller writes second wins outright, silently discarding the first caller's
// change). A stale expectedVersion throws a distinguishable 'conflict' error
// instead of clobbering; the caller re-reads and retries or surfaces the
// conflict. _version increments on every write regardless of whether the
// guard is used, so a caller can always read the CURRENT _version to guard
// its NEXT write. A dedicated counter, not updated_at, because updated_at
// (now(), second-precision epoch) can collide within the same second under a
// genuine fast race, silently defeating the guard exactly when it matters
// most; _version is a plain integer increment with no precision ceiling.
// Backward compatible: omitting opts.expectedVersion is the exact prior
// unconditional-write behaviour, unchanged for every existing caller; _version
// is added as a new column, ignored by every reader that doesn't ask for it.
export async function update(entity, id, data, opts = {}) {
  const spec = specOf(entity);
  const tbl = tableName(entity);

  const existing = await get(entity, id);
  if (!existing) throw new Error(`${entity} with id ${id} not found`);

  const currentVersion = Number(existing._version) || 0;
  const patch = { ...data, updated_at: now(), _version: currentVersion + 1 };
  let builder = client().from(tbl).update(patch).eq('id', id);
  if (opts.expectedVersion != null) {
    builder = builder.eq('_version', opts.expectedVersion);
  }
  const { data: rows, error } = await builder;
  if (error) throw new Error(`BusyBase update failed: ${error.message || error}`);
  if (opts.expectedVersion != null && Array.isArray(rows) && rows.length === 0) {
    const conflictErr = new Error(`${entity} ${id} was modified by another writer since it was last read`);
    conflictErr.code = 'conflict';
    throw conflictErr;
  }
  return get(entity, id);
}

export async function remove(entity, id) {
  const spec = specOf(entity);
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

// Substring search across the entity's text-ish fields (busybase has no FTS,
// so this is the in-memory equivalent of the old LIKE fallback). Returns visible rows only.
export async function search(entity, query, where = {}, options = {}) {
  const spec = specOf(entity);
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
  const spec = specOf(entity);
  const finalPageSize = pageSize || spec.list?.pageSize || 50;
  const finalPage = Math.max(1, page);
  const all = await search(entity, query, where);
  const total = all.length;
  const items = all.slice((finalPage - 1) * finalPageSize, finalPage * finalPageSize);
  return { items, pagination: { page: finalPage, pageSize: finalPageSize, total, totalPages: Math.ceil(total / finalPageSize) } };
}

// Children of a parent via foreign-key field (old: WHERE fk = ? AND status != deleted).
export async function getChildren(parentEntity, parentId, childDef) {
  const fk = childDef.fk || childDef.foreignKey || `${parentEntity}_id`;
  return list(childDef.entity, { [fk]: parentId });
}

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
