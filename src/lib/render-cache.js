const cache = new Map()
const maxSize = 500
const ttl = 60000
let hits = 0
let misses = 0

function cacheKey(fn, args) {
  return `${fn.name}:${JSON.stringify(args)}`
}

export function memoize(fn) {
  return function(...args) {
    const key = cacheKey(fn, args)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < ttl) {
      hits++
      return cached.value
    }
    misses++
    const value = fn(...args)
    cache.set(key, { value, ts: Date.now() })
    if (cache.size > maxSize) {
      const first = cache.keys().next().value
      cache.delete(first)
    }
    return value
  }
}

export function invalidate(pattern) {
  if (!pattern) {
    cache.clear()
    return cache.size
  }
  let count = 0
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key)
      count++
    }
  }
  return count
}

export function getCacheStats() {
  const total = hits + misses
  return {
    size: cache.size,
    hits,
    misses,
    hitRate: total > 0 ? (hits / total * 100).toFixed(2) + '%' : '0%',
    maxSize,
    ttl
  }
}

export function clearCache() {
  cache.clear()
  hits = 0
  misses = 0
}
