/*
 * BusyBase data store — async replacement for the better-sqlite3 query engine.
 *
 * busybase is a Supabase-style async document store (LanceDB) with no SQL joins or
 * foreign keys, so the relational behaviours of the old query-engine are reimplemented
 * here in JS:
 *   - ref "display" fields (old LEFT JOIN) -> client-side lookup of the referenced row
 *   - soft-delete filtering                  -> a WHERE predicate where that is
 *                                              provably identical, else in-memory
 *   - archive filtering                      -> in-memory predicate (not SQL-expressible)
 *   - sort / limit / offset                  -> in-memory; busybase's own
 *                                              order()/limit()/range() are JS too,
 *                                              so handing them down buys nothing
 *                                              (see the note above BUILDER_ROW_CEILING)
 *
 * Every export is async (busybase is async); callers are the already-async API route
 * handlers and crud-handlers, so the await ripple terminates at an existing boundary.
 *
 * Requires Bun (busybase embedded uses Bun.password + the vectordb native binding).
 */

import { getSpec } from '../../config/spec-helpers.js';
import { RECORD_STATUS } from '../../config/constants.js';
import { genId, now } from '../id-helpers.js';

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

// Apply soft-delete / archive default filtering in memory. Still the
// correctness authority even when the soft-delete half also rides the WHERE
// (see fetchVisibleRows): running it on an already-filtered set is a no-op, and
// running it is what makes the pushdown an optimisation rather than a second,
// divergent implementation of the same predicate.
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

// busybase's query builder defaults to a 1000-row page when no .limit() is set
// (`const lim = Math.max(0, q.limit || 1000)`), and it applies that AFTER
// reading and filtering the table -- so a caller asking for 10000 rows silently
// received 1000 and had no way to tell. That default is a sensible guard for an
// HTTP-shaped client; it is wrong here, because everything below -- the
// visibility filter, the row-access scoping, the tie-broken sort and the
// caller's own offset/limit page -- operates on the set this line returns. A
// truncated input means the sort ranks the wrong rows and the page is cut from
// the wrong set, with no error and no flag.
//
// Measured consequences in a consuming deployment before this line existed: a
// health sweep asking for 10000 open cases checked 1000 of 1900 and silently
// left 900 unswept; a privacy erasure asking for 10000 cases could not see past
// 1000; count() returned 886 where 2300 rows matched; and every truncation
// flag built on a limit+1 sentinel read false forever, because the sentinel row
// was itself inside the truncated page.
//
// The ceiling goes on the BUILDER, not on the JS slice below, and it is
// deliberately not the caller's own options.limit: that is the page size wanted
// AFTER sorting, so pushing it down here would sort only the first N rows in
// rowid order and return a different, wrong page. Sorting is likewise NOT
// pushed down -- store/query.js re-sorts same-second rows in JS on purpose, for
// replay determinism, and the builder's own sort would break that.
//
// This costs nothing: busybase already reads and filters the whole table before
// applying the limit, so raising the ceiling removes a truncation rather than
// adding work.
const BUILDER_ROW_CEILING = Number.MAX_SAFE_INTEGER;

// THE WHERE CLAUSE IS THE ONLY THING BUSYBASE COMPILES INTO SQL. Its embedded
// query builder issues exactly `SELECT * FROM <table>` or
// `SELECT * FROM <table> WHERE <compiled filters>` and then does everything
// else to the resulting JS array: select() re-projects it with
// Object.fromEntries, order() calls Array.prototype.sort, limit()/offset()/
// range() are an Array.prototype.slice, and count('exact') reports that array's
// length. So a sort, a page window or a column list handed to the builder
// changes what this process allocates and nothing about what SQLite reads --
// measured on a 2600-row case table: bare select('*') 94ms, the same read with
// a four-column select() 98ms, with order()+limit(200) 96ms. The equivalent raw
// statements are 98ms / 17ms / 9ms, so the pushdown those numbers promise is
// real but lives in busybase, not here.
//
// What that leaves reachable from this file is the WHERE, and the one filter
// this module applies that belongs in it is the soft-delete default below.

// Where-operators that cannot narrow a read to a small slice of the table: a
// negation, an open range, or a pattern. Everything else -- a bare scalar, a
// bare array, $eq, $in, a top-level $or of equalities -- can, and does on the
// per-case and per-id reads. The distinction is a COST one only; correctness
// does not depend on it (see fetchVisibleRows' guard, which runs whenever the
// pushdown is used at all).
const NON_NARROWING_OPS = new Set(['$ne', '$gt', '$gte', '$lt', '$lte', '$like', '$ilike']);
function whereNarrows(where) {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined || v === null) continue;
    if (k === '$or') return true;
    if (Array.isArray(v)) return true;
    if (typeof v === 'object') {
      if (Object.keys(v).some(op => !NON_NARROWING_OPS.has(op))) return true;
      continue;
    }
    return true;
  }
  return false;
}

// Rows a table must be known to hold before the soft-delete pushdown is worth
// its guard statement. Break-even is around ten soft-deleted rows: the guard
// costs roughly 0.4ms of fixed per-statement overhead plus a scan, while the
// pushdown saves the marshalling of each row it removes (about 37us per row on
// a 24-column case table). 1000 clears that by a wide margin at any plausible
// soft-delete rate, and keeps a small table -- where the guard is measurably
// the larger of the two numbers -- on the single-statement path.
const SOFT_DELETE_PUSHDOWN_MIN_ROWS = 1000;

// Largest row count this module has actually seen come back from an unnarrowed
// read of each table. A size hint only: it decides whether the pushdown is
// WORTH attempting, never whether its result is correct (the NULL guard in
// fetchVisibleRows decides that, every time the pushdown is used). Both ways of
// being wrong are bounded and cheap -- a low or absent entry (the default, so
// the first unnarrowed read of a table always takes the pre-existing
// single-statement path) costs a missed optimisation, and an entry left high by
// a table that has since shrunk costs one extra statement per read.
const observedTableRows = new Map();
function observeTableRows(tbl, n) {
  if (n > (observedTableRows.get(tbl) || 0)) observedTableRows.set(tbl, n);
}

// True when applyVisibility() would drop rows on `status` alone -- the same
// three conditions it tests, hoisted so the predicate can ride the WHERE --
// AND the read is wide enough for that to be worth an extra statement.
//
// The width tests are what keep the pushdown from costing more than it saves.
// busybase puts no LIMIT in the SQL it emits, so the NULL guard below is a
// second FULL SCAN however few rows it can match. On a table-wide read of a big
// table that scan is noise against the marshalling it removes (13600-row event
// table: 2.1ms guard against 42ms saved); on a read already narrowed to one
// case's handful of rows, or on any read of a small table, there is almost no
// marshalling to remove and the guard is pure added cost (measured +60% on a
// per-case event read, and +15% across a 26-row table, before these tests
// existed). So: push down only when the caller has not already narrowed AND the
// table is known to be big enough to pay for it.
function softDeleteRidesWhere(spec, tbl, where, options) {
  return Boolean(spec.fields?.status)
    && !('status' in where)
    && !options.includeDeleted
    && !whereNarrows(where)
    && (observedTableRows.get(tbl) || 0) >= SOFT_DELETE_PUSHDOWN_MIN_ROWS;
}

// Read the rows a caller may see, moving the soft-delete predicate into the SQL
// WHERE when that is provably equivalent to filtering it out afterwards.
//
// Only the soft-delete half moves. The archive half stays in JS because it is
// not a comparison: `!r.archived || r.archived === 0` is a JS truthiness test,
// and busybase binds every column as TEXT, so an archived value of "0" is
// truthy and IS dropped -- no SQL comparison reproduces that, and rewriting it
// as one would change which rows come back.
//
// The guard: SQL `status <> 'deleted'` is NOT the same predicate as JS
// `r.status !== 'deleted'`. Three-valued logic makes the comparison NULL for a
// row whose status is NULL, so SQL drops it while the JS filter keeps it.
// create() stamps a real status on every row it writes, but busybase grows a
// table with `ALTER TABLE ... ADD COLUMN`, which leaves the new column NULL on
// every pre-existing row, so a consuming deployment's table can genuinely hold
// them. A companion `status IS NULL` read -- capped at one row, since only
// existence matters -- decides: with no such row the pushdown returns the
// identical set in the identical order, and with one the caller gets the
// original unfiltered read instead. Identical, never merely equivalent.
const NULL_STATUS_PROBE_LIMIT = 1;
async function fetchVisibleRows(entity, where, options, op) {
  const spec = specOf(entity);
  const tbl = tableName(entity);
  const unnarrowed = !whereNarrows(where);
  const build = () => applyWhere(client().from(tbl).select('*'), where);
  const fullRead = async () => {
    const rows = unwrap(await build().limit(BUILDER_ROW_CEILING), op);
    if (unnarrowed) observeTableRows(tbl, rows.length);
    return rows;
  };
  if (!softDeleteRidesWhere(spec, tbl, where, options)) return fullRead();
  const [pushedDown, nullStatus] = await Promise.all([
    build().neq('status', RECORD_STATUS.DELETED).limit(BUILDER_ROW_CEILING),
    build().is('status', null).limit(NULL_STATUS_PROBE_LIMIT),
  ]);
  if (unwrap(nullStatus, `${op}-null-status-guard`).length) return fullRead();
  const rows = unwrap(pushedDown, op);
  observeTableRows(tbl, rows.length);
  return rows;
}

// The shared body of list() and listWithPagination(): one read, filtered,
// scoped, sorted and paged, plus the pre-page total the pagination envelope
// needs. `total` is the length of the set the page is cut from, which is
// exactly what count() returns for the same arguments -- sorting and slicing
// cannot change a set's size -- so a paginated read costs one table read
// instead of the two a separate count() + list() pair costs.
async function listResolved(entity, where, options) {
  const spec = specOf(entity);
  let rows = await fetchVisibleRows(entity, where, options, 'list');
  rows = applyVisibility(spec, rows, where, options);

  // Row-access scoping: when a caller passes options.user AND the entity declares
  // rowAccess OR an organization_id field (multi-tenancy), restrict the rows to
  // what that user may see (their assigned cases, their team, their organization).
  // Opt-in -- no user means the read is unchanged, so internal and admin callers
  // are unaffected. This makes a config row_access spec actually enforced on the
  // read path (previously list() took no user, so the spec was inert and a scoped
  // enquiry would leak every row).
  if (options.user && (spec.rowAccess || spec.row_access || spec.fields?.organization_id)) {
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
  const total = rows.length;
  if (options.offset || options.limit) {
    const off = parseInt(options.offset || 0, 10);
    const lim = options.limit ? parseInt(options.limit, 10) : rows.length;
    rows = rows.slice(off, off + lim);
  }
  const { decryptFields } = await import('../field-encryption.js');
  const decryptedRows = rows.map(r => decryptFields(r, spec.fields));
  const { computeFormulaFields } = await import('../formula-fields.js');
  const withFormulas = await Promise.all(decryptedRows.map(r => computeFormulaFields(r, spec.fields, entity)));
  return { items: await attachRefDisplays(entity, withFormulas), total };
}

export async function list(entity, where = {}, options = {}) {
  return (await listResolved(entity, where, options)).items;
}

export async function count(entity, where = {}, options = {}) {
  const spec = specOf(entity);
  // Same builder ceiling as list(), and for a worse reason: this function's
  // whole answer is rows.length, so the 1000-row default did not truncate a
  // page, it returned a WRONG NUMBER with no way to tell. Measured before this:
  // 886 where 2300 rows matched.
  //
  // The whole table is still read to produce one integer, and it has to be:
  // busybase computes count('exact') as the length of the array a full
  // `SELECT *` already returned, so there is no COUNT(*) to reach from here
  // (see the builder note above BUILDER_ROW_CEILING). Only the soft-delete
  // predicate reaches SQL, via fetchVisibleRows.
  let rows = await fetchVisibleRows(entity, where, options, 'count');
  rows = applyVisibility(spec, rows, where, options);
  if (options.user && (spec.rowAccess || spec.row_access || spec.fields?.organization_id)) {
    const { permissionService } = await import('../services/permission.service.js');
    rows = permissionService.filterRecords(options.user, spec, rows);
  }
  return rows.length;
}

export async function listWithPagination(entity, where = {}, page = 1, pageSize = 50, options = {}) {
  const finalPage = Math.max(1, page);
  // One read, not two: the page and its total come out of the same pass, so a
  // paginated read no longer scans the table once for count() and again for
  // list(). `total` is identical to count(entity, where, options) -- both are
  // the size of the same filtered, scoped set.
  const { items, total } = await listResolved(entity, where, {
    ...options,
    offset: (finalPage - 1) * pageSize,
    limit: pageSize,
  });
  return { items, pagination: { page: finalPage, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function get(entity, id, options = {}) {
  const tbl = tableName(entity);
  const row = unwrap(await client().from(tbl).select('*').eq('id', id).maybeSingle(), 'get');
  if (!row) return null;
  const spec = specOf(entity);
  if (options.user && (spec.rowAccess || spec.row_access || spec.fields?.organization_id)) {
    const { permissionService } = await import('../services/permission.service.js');
    if (!permissionService.checkRowAccess(options.user, spec, row)) return null;
  }
  const { decryptFields } = await import('../field-encryption.js');
  const decrypted = decryptFields(row, spec.fields);
  const { computeFormulaFields } = await import('../formula-fields.js');
  const withFormula = await computeFormulaFields(decrypted, spec.fields, entity);
  const [withDisplay] = await attachRefDisplays(entity, [withFormula]);
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
    // Every row is born with a real _version=0 rather than an absent/null
    // column: update()'s optimistic-concurrency guard only ever forwards
    // opts.expectedVersion when the caller's own prior read shows
    // `_version != null` (see every case-store.js call site) -- a row
    // created without this field stays genuinely SQL-NULL until its first
    // update(), during which window ANY concurrent first-write race on that
    // row skips the version guard entirely (both callers see _version==null,
    // both correctly conclude there is nothing to compare against, and
    // neither forwards expectedVersion at all) -- unconditional last-write-
    // wins with silent data loss on the very first edit. Stamping _version:0
    // at creation closes that window: the next caller's read always sees a
    // real number, so the very first update() after create() is guarded
    // exactly like every subsequent one.
    _version: 0,
    status: data.status || RECORD_STATUS.ACTIVE,
  };
  if (spec.fields?.organization_id && !record.organization_id && user?.organization_id) {
    record.organization_id = user.organization_id;
  }
  for (const [key, field] of Object.entries(spec.fields || {})) {
    if (field.auto === 'uuid' && !record[key]) record[key] = genId();
    if (field.auto === 'timestamp' && !record[key]) record[key] = now();
  }
  // Encrypt any field marked encrypted:true BEFORE the null/undefined
  // sentinel coercion below, so a real value never reaches the insert as
  // plaintext -- this is the single choke point every create() call passes
  // through, so no caller needs to know the field is encrypted at all.
  const { encryptFields } = await import('../field-encryption.js');
  const encryptedRecord = encryptFields(record, spec.fields);
  // LanceDB cannot infer a column's type from a null on first insert; coerce any
  // null/undefined to a typed sentinel ('' for strings) so the insert schema is stable.
  for (const k of Object.keys(encryptedRecord)) {
    if (encryptedRecord[k] === null || encryptedRecord[k] === undefined) encryptedRecord[k] = '';
  }
  unwrap(await client().from(tbl).insert(encryptedRecord), 'create');
  // Always return the locally-constructed record: it holds the genId we put in
  // the TEXT id column. The store's insert() may return a rowid/driver shape, so
  // trusting `created` would hand callers the wrong id. Return the UNENCRYPTED
  // record -- the caller gets back plaintext, matching what get()/list() will
  // also return after decrypting the stored ciphertext.
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
  const nextVersion = currentVersion + 1;
  const { encryptFields } = await import('../field-encryption.js');
  // Encrypt only the fields actually present in this partial update -- a
  // caller updating an unrelated field must not force-decrypt/re-encrypt an
  // encrypted field it never touched (encryptFields already skips fields
  // absent from the object, so this is naturally a no-op for those).
  const patch = encryptFields({ ...data, updated_at: now(), _version: nextVersion }, spec.fields);
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
  const after = await get(entity, id);
  // busybase's PATCH endpoint (rest/v1 server handler) synthesizes its response
  // body from the PRE-write row snapshot plus the request patch, rather than
  // confirming how many rows the underlying conditional UPDATE actually
  // touched -- so `rows.length === 0` above never fires under real concurrency:
  // two callers can both pass the read-existence check with the same stale
  // _version before either's UPDATE lands, and the loser's conditional
  // UPDATE...WHERE _version=? matches zero rows server-side while busybase
  // still echoes back a fabricated "success" body built from stale data. Nor
  // does re-checking _version alone fully close the gap: two racers starting
  // from the same stale existing._version both compute the identical
  // nextVersion, so if BOTH conditional UPDATEs coincidentally target the
  // same row (only possible on the loser's side if the WHERE clause somehow
  // still matched, but confirmed as a real busybase response-fabrication
  // path above), a bare version-number comparison cannot tell winner from
  // loser when they land on the same target number. The one thing genuinely
  // unique per caller is the caller's OWN requested field values -- if this
  // call asked to set a field to X and the freshly re-read row shows a
  // DIFFERENT value for that same field, some other writer's patch is what
  // actually persisted (whether it landed before, during, or after this
  // call's own UPDATE), and that mismatch IS the conflict: computed from
  // live state, never trusted from busybase's own echoed response. A field
  // this call's own patch happened to set to the SAME value another writer
  // also chose is indistinguishable from a genuine win, same as any
  // best-effort optimistic-concurrency check based on observable state
  // rather than a true database-native compare-and-swap primitive -- the
  // encrypted-field case is skipped (compares ciphertext, never plaintext)
  // since encryption is expected to be non-deterministic per call.
  if (opts.expectedVersion != null) {
    const encryptedKeys = new Set(Object.keys(spec.fields || {}).filter(k => spec.fields[k]?.encrypted));
    const mismatched = Object.keys(data).filter(k => !encryptedKeys.has(k) && after?.[k] !== data[k]);
    if (mismatched.length || Number(after?._version) !== nextVersion) {
      const conflictErr = new Error(`${entity} ${id} was modified by another writer since it was last read`);
      conflictErr.code = 'conflict';
      throw conflictErr;
    }
  }
  return after;
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

export async function searchWithPagination(entity, query, where = {}, page = 1, pageSize = null, options = {}) {
  const spec = specOf(entity);
  const finalPageSize = pageSize || spec.list?.pageSize || 50;
  const finalPage = Math.max(1, page);
  const all = await search(entity, query, where, options);
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
