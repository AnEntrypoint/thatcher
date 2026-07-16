import { createCache } from './keyed-cache.js'

const maxSize = 500
const ttl = 60000
const cache = createCache({ ttlMs: ttl, maxSize })

function cacheKey(fn, args) {
  return `${fn.name}:${JSON.stringify(args)}`
}

export function memoize(fn) {
  return function(...args) {
    const key = cacheKey(fn, args)
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    const value = fn(...args)
    cache.set(key, value)
    return value
  }
}

export function invalidate(pattern) {
  if (!pattern) {
    cache.clear()
    return 0
  }
  return cache.deleteWhere(key => key.includes(pattern))
}

export function getCacheStats() {
  const s = cache.stats()
  return {
    size: s.size,
    hits: s.hits,
    misses: s.misses,
    hitRate: (s.hits + s.misses) > 0 ? (s.hitRate * 100).toFixed(2) + '%' : '0%',
    maxSize,
    ttl
  }
}

export function clearCache() {
  cache.clear()
  cache.resetStats()
}
