import { createCache } from './keyed-cache.js';

const MAX_STMT_CACHE = 500;
const MAX_RESULT_CACHE = 200;
const MAX_QUERY_CACHE = 100;
const DEFAULT_TTL = 30000;

const TTL_CONFIG = {
  user: 60000,
  users: 60000,
  client: 120000,
  engagement: 10000,
  rfi: 5000,
  audit_logs: 0,
  sessions: 5000,
  email: 1000,
  default: DEFAULT_TTL
};

// Prepared statements never expire by time (only size-evicted), so ttlMs is
// left unset (no expiry) -- matches the original stmtCache having no TTL check.
const stmtCache = createCache({ maxSize: MAX_STMT_CACHE });
// The query cache (cacheQuery) also never expired by time in the original.
const queryCache = createCache({ maxSize: MAX_QUERY_CACHE });
// The result cache's TTL varies PER ENTRY (by the entity it was cached under),
// so a single fixed ttlMs on the shared primitive cannot express it directly.
// Kept as ONE cache instance (matching the original single-Map, single
// MAX_RESULT_CACHE=200-total ceiling -- a per-TTL-bucket split would silently
// multiply the effective capacity, a real behaviour change) with no TTL on the
// primitive itself; each entry's own per-entity TTL is checked here at read
// time against a stored timestamp, exactly like the original inline check did.
// Hit/miss counting is also done at this layer (not the primitive's own
// built-in counters) since a ttl=0/expired lookup must count as a MISS to
// match the original's exact cacheHits/cacheMisses semantics.
const resultCache = createCache({ maxSize: MAX_RESULT_CACHE });
let cacheHits = 0;
let cacheMisses = 0;

export const prepareStmt = (db, sql) => {
  const cached = stmtCache.get(sql);
  if (cached !== undefined) {
    return cached;
  }

  const stmt = db.prepare(sql);
  stmtCache.set(sql, stmt);
  return stmt;
};

export const getCached = (key, entity = 'default') => {
  const entry = resultCache.get(key);
  if (entry === undefined) {
    cacheMisses++;
    return null;
  }

  const ttl = TTL_CONFIG[entity] || TTL_CONFIG.default;
  if (ttl === 0) {
    cacheMisses++;
    return null;
  }

  if (Date.now() - entry.timestamp > ttl) {
    resultCache.delete(key);
    cacheMisses++;
    return null;
  }

  cacheHits++;
  return entry.data;
};

export const setCached = (key, data, entity = 'default') => {
  const ttl = TTL_CONFIG[entity] || TTL_CONFIG.default;
  if (ttl === 0) return;

  resultCache.set(key, { data, timestamp: Date.now() });
};

export const invalidate = (pattern) => {
  if (!pattern) {
    resultCache.clear();
    queryCache.clear();
    return;
  }

  const regex = new RegExp(pattern);
  resultCache.deleteWhere(key => regex.test(key));
  queryCache.deleteWhere(key => regex.test(key));
};

export const cacheQuery = (key, fn) => {
  const cached = queryCache.get(key);
  if (cached !== undefined) return cached;

  const result = fn();
  queryCache.set(key, result);
  return result;
};

export const getStats = () => {
  const stmtStats = stmtCache.stats();
  return {
    cacheHits,
    cacheMisses,
    hitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2) + '%' : '0%',
    stmtCacheHits: stmtStats.hits,
    stmtCacheMisses: stmtStats.misses,
    stmtHitRate: stmtStats.hits + stmtStats.misses > 0 ? (stmtStats.hits / (stmtStats.hits + stmtStats.misses) * 100).toFixed(2) + '%' : '0%',
    stmtCacheSize: stmtStats.size,
    resultCacheSize: resultCache.stats().size,
    queryCacheSize: queryCache.stats().size
  };
};

export const clearStats = () => {
  cacheHits = 0;
  cacheMisses = 0;
  stmtCache.resetStats();
};
