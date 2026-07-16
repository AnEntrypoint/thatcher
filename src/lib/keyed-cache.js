/*
 * Shared keyed-cache primitive: a Map-backed store with TTL expiry and
 * size-bounded eviction, factored out of the near-identical Map+eviction
 * logic query-cache.js and render-cache.js each rolled independently.
 *
 * createCache({ ttlMs, maxSize }) returns a cache with get/set/delete/clear,
 * plus size/stats helpers callers can build their own public stats on top of.
 *
 * Eviction policy: insertion-order (oldest-first / FIFO), matching what both
 * original callers did via `cache.keys().next().value` -- not LRU. A `get()`
 * does not move a key to the back of the map, so read-heavy hot keys are not
 * specially protected from eviction; this preserves the exact prior behaviour
 * of both callers being ported onto this primitive.
 *
 * ttlMs: 0 disables storage entirely (every set() is a no-op, every get() is
 * a miss) -- mirrors query-cache.js's per-entity TTL_CONFIG=0 "never cache"
 * entries (e.g. audit_logs). Omit/undefined ttlMs means "no expiry" (entries
 * live until evicted by size or explicitly cleared) -- matches a cache that
 * never expired anything by time.
 */

export function createCache({ ttlMs, maxSize = Infinity } = {}) {
  const store = new Map();
  let hits = 0;
  let misses = 0;

  function isExpired(entry) {
    if (ttlMs == null || ttlMs < 0) return false;
    return Date.now() - entry.ts > ttlMs;
  }

  function evictIfFull() {
    while (store.size >= maxSize && maxSize > 0) {
      const firstKey = store.keys().next().value;
      if (firstKey === undefined) break;
      store.delete(firstKey);
    }
  }

  function get(key) {
    const entry = store.get(key);
    if (!entry) {
      misses++;
      return undefined;
    }
    if (isExpired(entry)) {
      store.delete(key);
      misses++;
      return undefined;
    }
    hits++;
    return entry.value;
  }

  function has(key) {
    const entry = store.get(key);
    if (!entry) return false;
    if (isExpired(entry)) {
      store.delete(key);
      return false;
    }
    return true;
  }

  function set(key, value) {
    if (ttlMs === 0) return; // 0 means "never cache" (matches TTL_CONFIG=0 entities)
    if (!store.has(key)) evictIfFull();
    store.set(key, { value, ts: Date.now() });
  }

  function del(key) {
    return store.delete(key);
  }

  function clear() {
    store.clear();
  }

  function keys() {
    return store.keys();
  }

  function deleteWhere(predicate) {
    let count = 0;
    for (const key of store.keys()) {
      if (predicate(key)) {
        store.delete(key);
        count++;
      }
    }
    return count;
  }

  function stats() {
    const total = hits + misses;
    return {
      size: store.size,
      maxSize,
      ttlMs,
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
    };
  }

  function resetStats() {
    hits = 0;
    misses = 0;
  }

  return { get, set, has, delete: del, clear, keys, deleteWhere, stats, resetStats };
}
