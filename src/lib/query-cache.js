const stmtCache = new Map();
const resultCache = new Map();
const queryCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;
let stmtCacheHits = 0;
let stmtCacheMisses = 0;

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

export const prepareStmt = (db, sql) => {
  const cached = stmtCache.get(sql);
  if (cached) {
    stmtCacheHits++;
    return cached;
  }

  stmtCacheMisses++;
  if (stmtCache.size >= MAX_STMT_CACHE) {
    const firstKey = stmtCache.keys().next().value;
    stmtCache.delete(firstKey);
  }

  const stmt = db.prepare(sql);
  stmtCache.set(sql, stmt);
  return stmt;
};

export const getCached = (key, entity = 'default') => {
  const entry = resultCache.get(key);
  if (!entry) {
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

  if (resultCache.size >= MAX_RESULT_CACHE) {
    const firstKey = resultCache.keys().next().value;
    resultCache.delete(firstKey);
  }

  resultCache.set(key, { data, timestamp: Date.now() });
};

export const invalidate = (pattern) => {
  if (!pattern) {
    resultCache.clear();
    queryCache.clear();
    return;
  }

  const regex = new RegExp(pattern);
  for (const key of resultCache.keys()) {
    if (regex.test(key)) resultCache.delete(key);
  }
  for (const key of queryCache.keys()) {
    if (regex.test(key)) queryCache.delete(key);
  }
};

export const cacheQuery = (key, fn) => {
  const cached = queryCache.get(key);
  if (cached) return cached;

  if (queryCache.size >= MAX_QUERY_CACHE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }

  const result = fn();
  queryCache.set(key, result);
  return result;
};

export const getStats = () => ({
  cacheHits,
  cacheMisses,
  hitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2) + '%' : '0%',
  stmtCacheHits,
  stmtCacheMisses,
  stmtHitRate: stmtCacheHits + stmtCacheMisses > 0 ? (stmtCacheHits / (stmtCacheHits + stmtCacheMisses) * 100).toFixed(2) + '%' : '0%',
  stmtCacheSize: stmtCache.size,
  resultCacheSize: resultCache.size,
  queryCacheSize: queryCache.size
});

export const clearStats = () => {
  cacheHits = 0;
  cacheMisses = 0;
  stmtCacheHits = 0;
  stmtCacheMisses = 0;
};
