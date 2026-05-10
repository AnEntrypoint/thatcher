const metrics = new Map()
const thresholds = { render: 100, query: 50, api: 200, total: 500 }
let enabled = process.env.PERF_MONITOR !== 'false'

export function startTimer(key) {
  if (!enabled) return null
  const start = process.hrtime.bigint()
  return { key, start }
}

export function endTimer(timer) {
  if (!enabled || !timer) return 0
  const end = process.hrtime.bigint()
  const ms = Number(end - timer.start) / 1000000
  recordMetric(timer.key, ms)
  return ms
}

export function recordMetric(key, value) {
  if (!enabled) return
  if (!metrics.has(key)) metrics.set(key, [])
  const arr = metrics.get(key)
  arr.push({ value, ts: Date.now() })
  if (arr.length > 1000) arr.shift()
}

export function getMetrics(key) {
  if (!key) return Object.fromEntries(metrics.entries())
  return metrics.get(key) || []
}

export function getStats(key) {
  const data = metrics.get(key) || []
  if (data.length === 0) return null
  const values = data.map(d => d.value)
  values.sort((a, b) => a - b)
  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    p99: values[Math.floor(values.length * 0.99)]
  }
}

export function checkThreshold(key, value) {
  if (!enabled) return true
  const limit = thresholds[key]
  if (limit && value > limit) {
    console.warn(`[PERF] ${key} exceeded threshold: ${value.toFixed(2)}ms > ${limit}ms`)
    return false
  }
  return true
}

export function setThreshold(key, ms) {
  thresholds[key] = ms
}

export function clearMetrics() {
  metrics.clear()
}

export function enable() {
  enabled = true
}

export function disable() {
  enabled = false
}

export function measure(key, fn) {
  const timer = startTimer(key)
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.finally(() => {
        const ms = endTimer(timer)
        checkThreshold(key, ms)
      })
    }
    const ms = endTimer(timer)
    checkThreshold(key, ms)
    return result
  } catch (err) {
    endTimer(timer)
    throw err
  }
}
