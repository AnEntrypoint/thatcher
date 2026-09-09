/*
 * A direct SQL read handle on the same sqlite file busybase writes.
 *
 * WHY THIS FILE EXISTS. busybase's embedded query builder compiles exactly one
 * thing into SQL -- the WHERE clause -- and issues `SELECT * FROM <table>` or
 * `SELECT * FROM <table> WHERE <compiled filters>`. Everything after that is a
 * JS array operation: select() re-projects with Object.fromEntries, order() is
 * Array.prototype.sort, limit()/offset()/range() are Array.prototype.slice, and
 * count('exact') is that array's `.length`. Its returned client exposes
 * `{ from, auth, channel, removeAllChannels, close, _bus }` and no handle onto
 * the underlying database, so LIMIT, OFFSET and COUNT(*) are unreachable from
 * store.js through that client at any price. Measured on a 13600-row event
 * table: count-as-length 192ms, `SELECT COUNT(*)` 0.07ms.
 *
 * So store.js opens its OWN read handle on the same file. It is an optimisation
 * and nothing else: every entry point below returns `null` the moment anything
 * is unavailable, unsupported or unexpected, and store.js falls back to the
 * pre-existing busybase path. A wrong answer is never preferable to a slow one.
 *
 * WRITES NEVER COME THROUGH HERE. The only DDL this file issues is
 * `CREATE INDEX IF NOT EXISTS`, which cannot change what any query returns
 * (see ensureIndexes); every other statement is a SELECT or a PRAGMA.
 */

import path from 'path';
import { createLogger } from '../logger.js';

const log = createLogger('[BusyBaseSQL]');

let _dir = null;
let _clientPromise = null;
let _disabled = false;

// Cleared whenever the directory changes: busybase creates tables lazily (its
// mkTbl runs on the FIRST insert into a table) and grows them lazily
// (`ALTER TABLE ... ADD COLUMN` on the first write carrying a new field), so a
// table or column absent at boot can exist later in the same process.
const _tableCols = new Map();

/**
 * Point this module at busybase's data directory. Called by store.js's
 * setBusyBaseClient(client, dir); a null/absent dir leaves every fast path off
 * and the store behaves exactly as it did before this file existed.
 */
export function setSqlDir(dir) {
  if (dir === _dir) return;
  _dir = dir || null;
  _clientPromise = null;
  _disabled = false;
  _tableCols.clear();
}

export function sqlDir() {
  return _dir;
}

async function client() {
  if (!_dir || _disabled) return null;
  if (!_clientPromise) {
    _clientPromise = (async () => {
      // Dynamic, and swallowed on failure: @libsql/client arrives as busybase's
      // own dependency, so a consumer that swapped busybase's backend (its
      // registerBackend seam) may not have it at all. That is a missing
      // optimisation, never an error.
      const mod = await import('@libsql/client');
      const createClient = mod.createClient || mod.default?.createClient;
      if (typeof createClient !== 'function') throw new Error('no createClient export');
      // busybase hardcodes `${dir}/db.sqlite` as the file it opens
      // (embedded.js: `file:${dir}/db.sqlite`), regardless of any filename a
      // caller's databasePath named. Open the same file, not a guess.
      return createClient({ url: 'file:' + path.join(_dir, 'db.sqlite') });
    })().catch((e) => {
      _disabled = true;
      log.warn(`direct read handle unavailable, using the busybase path: ${e?.message || e}`);
      return null;
    });
  }
  return _clientPromise;
}

export function closeSql() {
  const p = _clientPromise;
  _clientPromise = null;
  _tableCols.clear();
  if (!p) return;
  Promise.resolve(p).then(c => { try { c?.close?.(); } catch { /* best-effort */ } }, () => {});
}

// busybase's own identifier gate (embedded.js `validId`). A filter naming a
// column that fails it is SKIPPED by busybase rather than applied, so this file
// never compiles one: it bails to the busybase path, whose answer is by
// definition the one being reproduced.
const VALID_ID = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function validId(s) {
  return VALID_ID.test(s) && s !== '_users' && s !== '_sessions';
}

function qid(n) {
  return '"' + String(n).replaceAll('"', '""') + '"';
}

/**
 * Which columns a table actually has right now, or null when the table does not
 * exist. Cached per table name: a table's column set only ever grows, and a
 * lookup that missed is retried on the next call because nothing is cached for
 * an absent table.
 */
async function columnsOf(tbl) {
  if (_tableCols.has(tbl)) return _tableCols.get(tbl);
  const c = await client();
  if (!c) return null;
  try {
    const info = await c.execute(`PRAGMA table_info(${qid(tbl)})`);
    if (!info.rows.length) return null;
    const cols = new Set(info.rows.map(r => String(r.name)));
    _tableCols.set(tbl, cols);
    return cols;
  } catch (e) {
    log.warn(`table_info(${tbl}) failed: ${e?.message || e}`);
    return null;
  }
}

/*
 * A MIRROR OF busybase's `toFilter`/`cmp` (embedded.js), deliberately, and the
 * one place this file is coupled to busybase's internals.
 *
 * The point is not to express the same intent -- it is to emit the same rows.
 * busybase binds every column as TEXT, so a stored number is the string '5',
 * and its `cmp` therefore widens a numeric-looking value to
 * `(col = '5' OR col = CAST('5' AS NUMERIC))` so a column that DID land as a
 * real numeric still matches. An `IN` set is widened the same way, per element.
 * Reproducing that exactly is what makes a pushdown identical rather than
 * merely equivalent; writing the "obvious" `col = ?` instead would silently
 * drop rows on any deployment whose column holds numerics.
 *
 * Anything outside the mirrored set returns null and the caller falls back:
 * $or (busybase's or() parser splits the compiled clause on ',' and '.' with no
 * escaping, and store.js's applyWhere already refuses the values that would
 * corrupt it -- reproducing that corruption faithfully is not worth it), an
 * invalid identifier, a non-scalar value, an unknown operator.
 *
 * Values are BOUND, not interpolated -- the same predicate, minus busybase's
 * quote-doubling escape.
 */
const NUM_LIT = /^-?\d+(\.\d+)?$/;

function cmp(col, op, val) {
  const s = String(val);
  if (NUM_LIT.test(s)) {
    return { sql: `(${qid(col)} ${op} ? OR ${qid(col)} ${op} CAST(? AS NUMERIC))`, args: [s, s] };
  }
  return { sql: `${qid(col)} ${op} ?`, args: [s] };
}

function inClause(col, value) {
  // busybase's builder interpolates the array into `in.${col}=${value}` and
  // then splits the result on ',', so an element containing a comma is already
  // torn apart before any SQL exists. String(value).split(',') reproduces that
  // byte for byte rather than pretending the array survived intact.
  const parts = String(value).split(',');
  const args = [];
  const slots = [];
  for (const v of parts) {
    slots.push('?');
    args.push(v);
    if (NUM_LIT.test(v)) { slots.push('CAST(? AS NUMERIC)'); args.push(v); }
  }
  return { sql: `${qid(col)} IN (${slots.join(',')})`, args };
}

const SQL_OPS = { $eq: '=', $ne: '!=', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' };

/** Compile a store.js where-object to `{sql, args}`, or null to bail. */
export function compileWhere(where) {
  const parts = [];
  const args = [];
  for (const [k, v] of Object.entries(where || {})) {
    if (v === undefined || v === null) continue;
    if (k === '$or') return null;
    if (!validId(k)) return null;
    if (Array.isArray(v)) {
      const c = inClause(k, v);
      parts.push(c.sql); args.push(...c.args);
      continue;
    }
    if (typeof v === 'object') {
      for (const [op, ov] of Object.entries(v)) {
        if (op === '$in') {
          const c = inClause(k, Array.isArray(ov) ? ov : [ov]);
          parts.push(c.sql); args.push(...c.args);
          continue;
        }
        const sqlOp = SQL_OPS[op];
        // $like/$ilike are deliberately not mirrored: they are never on a
        // counted or paged path here, and LIKE's semantics depend on pragmas
        // this handle does not control.
        if (!sqlOp) return null;
        if (ov === undefined || ov === null || typeof ov === 'object') return null;
        const c = cmp(k, sqlOp, ov);
        parts.push(c.sql); args.push(...c.args);
      }
      continue;
    }
    const c = cmp(k, '=', v);
    parts.push(c.sql); args.push(...c.args);
  }
  return { sql: parts.join(' AND '), args };
}

/**
 * busybase strips `pw` and `pubkey` off every row it returns (embedded.js
 * `clean`), before its own slice. A raw `SELECT *` has to strip them too or the
 * rows differ by two keys on any table that has them.
 */
function clean(rows) {
  return rows.map(({ pw, pubkey, ...r }) => r);
}

function withDeleteFilter(compiled, excludeDeleted, deletedValue) {
  if (!excludeDeleted) return compiled;
  // The same predicate busybase emits for `.neq('status', 'deleted')`.
  const c = cmp('status', '!=', deletedValue);
  return {
    sql: compiled.sql ? `${compiled.sql} AND ${c.sql}` : c.sql,
    args: [...compiled.args, ...c.args],
  };
}

async function tableReady(tbl, where) {
  const cols = await columnsOf(tbl);
  if (!cols) return false;
  for (const k of Object.keys(where || {})) {
    if (k === '$or') return false;
    if (!cols.has(k)) return false;
  }
  return true;
}

/**
 * `SELECT COUNT(*)` for a where-object, or null to fall back.
 * opts.excludeDeleted appends busybase's own soft-delete predicate.
 */
export async function countRows(tbl, where, { excludeDeleted = false, deletedValue = 'deleted' } = {}) {
  const c = await client();
  if (!c) return null;
  const compiled = compileWhere(where);
  if (!compiled) return null;
  if (excludeDeleted && !(await columnsOf(tbl))?.has('status')) return null;
  if (!(await tableReady(tbl, where))) return null;
  const q = withDeleteFilter(compiled, excludeDeleted, deletedValue);
  try {
    const r = await c.execute({
      sql: `SELECT COUNT(*) AS n FROM ${qid(tbl)}${q.sql ? ' WHERE ' + q.sql : ''}`,
      args: q.args,
    });
    return Number(r.rows[0].n);
  } catch (e) {
    log.warn(`count(${tbl}) fell back to the busybase path: ${e?.message || e}`);
    return null;
  }
}

/**
 * `SELECT * ... ORDER BY rowid LIMIT ? OFFSET ?` for a where-object, or null to
 * fall back.
 *
 * The caller's own sort is NEVER pushed down (see store.js's caller). `ORDER BY
 * rowid` is not that sort -- it is insertion order, and it is here to PIN the
 * order this page is cut from rather than to impose a new one.
 *
 * It is load-bearing, and it was measured, not assumed. busybase issues an
 * unordered `SELECT *`, so the order its rows arrive in is whatever the plan
 * happens to produce -- for a table scan that is rowid order, which is why
 * consumers can and do rely on "the raw list order preserves insertion order".
 * Add an index and that stops being incidental: `WHERE case_id IN (a,b,c)`
 * against an indexed `case_id` returns the rows GROUPED BY the IN-list values
 * instead of in rowid order, which reorders same-second rows for any consumer
 * whose sort breaks ties on input position. Witnessed on the 13600-row event
 * table: identical rows, different order, from the index alone. `ORDER BY
 * rowid` makes this path return insertion order whatever the planner picks.
 * A single-value equality was already unaffected either way (an index on `c`
 * visits one `c`'s rows in rowid order), so this costs nothing on the shape it
 * matters most for.
 */
export async function selectRows(tbl, where, { excludeDeleted = false, deletedValue = 'deleted', limit = null, offset = 0 } = {}) {
  const c = await client();
  if (!c) return null;
  const compiled = compileWhere(where);
  if (!compiled) return null;
  if (excludeDeleted && !(await columnsOf(tbl))?.has('status')) return null;
  if (!(await tableReady(tbl, where))) return null;
  const q = withDeleteFilter(compiled, excludeDeleted, deletedValue);
  const off = Math.max(0, Number(offset) || 0);
  const lim = limit == null ? -1 : Math.max(0, Number(limit) || 0);
  try {
    const r = await c.execute({
      sql: `SELECT * FROM ${qid(tbl)}${q.sql ? ' WHERE ' + q.sql : ''} ORDER BY rowid LIMIT ? OFFSET ?`,
      args: [...q.args, lim, off],
    });
    return clean(r.rows.map(row => ({ ...row })));
  } catch (e) {
    log.warn(`select(${tbl}) fell back to the busybase path: ${e?.message || e}`);
    return null;
  }
}

/**
 * Does this table hold a row whose `status` is SQL NULL? Capped at one row --
 * only existence matters. Returns null when it cannot be answered, which the
 * caller must treat as "assume yes" and fall back.
 *
 * This is the guard that makes a soft-delete pushdown identical rather than
 * equivalent: SQL `status <> 'deleted'` is NOT the JS predicate
 * `r.status !== 'deleted'`, because three-valued logic makes the comparison
 * NULL for a NULL-status row, so SQL drops what JS keeps. busybase grows a
 * table with `ALTER TABLE ... ADD COLUMN`, which leaves the new column NULL on
 * every pre-existing row, so such rows are real.
 */
export async function hasNullStatus(tbl) {
  const c = await client();
  if (!c) return null;
  const cols = await columnsOf(tbl);
  if (!cols) return false;
  if (!cols.has('status')) return false;
  try {
    const r = await c.execute(`SELECT 1 FROM ${qid(tbl)} WHERE "status" IS NULL LIMIT 1`);
    return r.rows.length > 0;
  } catch (e) {
    log.warn(`null-status guard on ${tbl} failed: ${e?.message || e}`);
    return null;
  }
}

/**
 * Additive `CREATE INDEX IF NOT EXISTS` over columns that already exist.
 *
 * AN INDEX CANNOT CHANGE WHAT A QUERY RETURNS. It changes which plan SQLite
 * picks, never the row set: SQLite's query planner is required to produce the
 * same result set for the same statement whatever access path it chooses, and
 * every statement in this file and in busybase either carries no ORDER BY and
 * has its order fixed downstream, or is counted. The two ways an index could
 * still be observable are guarded here:
 *   - it must never be UNIQUE (a unique index turns a duplicate INSERT into an
 *     error), so every index below is a plain one;
 *   - it must never sit on a column whose scan order a caller depends on
 *     without an ORDER BY. That is why the derived set is equality-lookup
 *     columns only and never `status` -- store.js's soft-delete pushdown emits
 *     `status <> 'deleted'`, an inequality no index can serve, so indexing
 *     status would only tempt the planner into an unordered index scan on the
 *     one predicate that runs on an unsorted, JS-sliced read.
 *
 * `columns` is a Map/object of table -> column names. A table that does not
 * exist yet, or a column busybase has not added yet, is skipped silently and
 * retried on the next boot -- busybase creates both lazily, so a one-shot
 * migration would permanently miss anything created after it ran.
 *
 * Returns the list of index names that now exist (created or already present).
 */
export async function ensureIndexes(columns) {
  const c = await client();
  if (!c) return [];
  const made = [];
  for (const [tbl, wanted] of Object.entries(columns || {})) {
    if (!validId(tbl) || !wanted?.length) continue;
    const cols = await columnsOf(tbl);
    if (!cols) continue;
    // The NULL-status guard's own index, and the reason it is PARTIAL. That
    // guard (hasNullStatus, above) has to run on every pushdown, and without an
    // index `WHERE status IS NULL` is a full scan precisely when it finds
    // nothing -- 2ms on a 13600-row table, per call, to answer a question whose
    // answer is almost always "no". A partial index on the NULL rows alone is
    // usually empty, costs nothing to maintain, and answers it in microseconds.
    //
    // PARTIAL, not a plain index on `status`, and that distinction is the whole
    // safety argument: SQLite may only use a partial index where the query's
    // WHERE implies the index's, so this one can serve `status IS NULL` and
    // NOTHING else. A plain index on `status` could instead be picked for
    // `status <> 'deleted'` -- the soft-delete predicate that rides an
    // unsorted, JS-sliced read -- and an index scan there would hand the caller
    // the same rows in a different order.
    if (cols.has('status')) {
      const nname = `idx_${tbl}_status_null`;
      try {
        await c.execute(`CREATE INDEX IF NOT EXISTS ${qid(nname)} ON ${qid(tbl)}("status") WHERE "status" IS NULL`);
        made.push(nname);
      } catch (e) {
        log.warn(`index ${nname} not created: ${e?.message || e}`);
      }
    }
    for (const col of wanted) {
      if (!validId(col) || !cols.has(col)) continue;
      const name = `idx_${tbl}_${col}`;
      try {
        await c.execute(`CREATE INDEX IF NOT EXISTS ${qid(name)} ON ${qid(tbl)}(${qid(col)})`);
        made.push(name);
      } catch (e) {
        // A locked or read-only database is a reason to run without the index,
        // never a reason to fail a boot.
        log.warn(`index ${name} not created: ${e?.message || e}`);
      }
    }
  }
  return made;
}
