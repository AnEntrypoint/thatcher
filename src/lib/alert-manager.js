const alerts = []
const alertHandlers = []
const thresholds = {
  errorRate: { window: 60000, maxErrors: 10 },
  p95Latency: { threshold: 500 },
  p99Latency: { threshold: 1000 },
  memoryUsage: { threshold: 0.9 },
  diskUsage: { threshold: 0.9 },
  dbConnections: { threshold: 100 },
  slowQuery: { threshold: 1000 }
}

let alertingEnabled = true
const alertCooldowns = new Map()

function checkErrorRate(errorMetrics) {
  const now = Date.now()
  const window = thresholds.errorRate.window
  let recentErrors = 0

  for (const [endpoint, data] of Object.entries(errorMetrics.byEndpoint)) {
    const recent = (data.recent || []).filter(e => (now - e.ts) < window)
    recentErrors += recent.length
  }

  if (recentErrors > thresholds.errorRate.maxErrors) {
    triggerAlert('error_rate', `High error rate: ${recentErrors} errors in last ${window/1000}s`, {
      count: recentErrors,
      threshold: thresholds.errorRate.maxErrors
    })
  }
}

function checkLatency(requestMetrics) {
  for (const [endpoint, stats] of Object.entries(requestMetrics)) {
    if (stats.p95 > thresholds.p95Latency.threshold) {
      triggerAlert('p95_latency', `P95 latency exceeded for ${endpoint}: ${stats.p95.toFixed(2)}ms`, {
        endpoint,
        p95: stats.p95,
        threshold: thresholds.p95Latency.threshold
      })
    }

    if (stats.p99 > thresholds.p99Latency.threshold) {
      triggerAlert('p99_latency', `P99 latency exceeded for ${endpoint}: ${stats.p99.toFixed(2)}ms`, {
        endpoint,
        p99: stats.p99,
        threshold: thresholds.p99Latency.threshold
      })
    }
  }
}

function checkResources(resourceMetrics) {
  if (!resourceMetrics) return

  if (resourceMetrics.memory && resourceMetrics.memory.avg > thresholds.memoryUsage.threshold) {
    triggerAlert('memory_usage', `High memory usage: ${(resourceMetrics.memory.avg * 100).toFixed(1)}%`, {
      usage: resourceMetrics.memory.avg,
      threshold: thresholds.memoryUsage.threshold
    })
  }

  if (resourceMetrics.disk && resourceMetrics.disk.avg > thresholds.diskUsage.threshold) {
    triggerAlert('disk_usage', `High disk usage: ${(resourceMetrics.disk.avg * 100).toFixed(1)}%`, {
      usage: resourceMetrics.disk.avg,
      threshold: thresholds.diskUsage.threshold
    })
  }
}

function checkDatabase(dbMetrics) {
  for (const [operation, stats] of Object.entries(dbMetrics)) {
    if (stats.p95 > thresholds.slowQuery.threshold) {
      triggerAlert('slow_query', `Slow ${operation}: ${stats.p95.toFixed(2)}ms`, {
        operation,
        p95: stats.p95,
        threshold: thresholds.slowQuery.threshold
      })
    }
  }
}

function triggerAlert(type, message, metadata = {}) {
  if (!alertingEnabled) return

  const cooldownKey = `${type}:${message}`
  const now = Date.now()
  const lastAlert = alertCooldowns.get(cooldownKey)

  if (lastAlert && (now - lastAlert) < 60000) {
    return
  }

  alertCooldowns.set(cooldownKey, now)

  const alert = {
    type,
    message,
    metadata,
    timestamp: now,
    severity: getSeverity(type)
  }

  alerts.push(alert)
  if (alerts.length > 1000) alerts.shift()

  console.error(`[ALERT] [${alert.severity.toUpperCase()}] ${type}: ${message}`, metadata)

  for (const handler of alertHandlers) {
    try {
      handler(alert)
    } catch (err) {
      console.error('[AlertManager] Handler error:', err)
    }
  }
}

function getSeverity(type) {
  if (type.includes('error_rate') || type.includes('memory') || type.includes('disk')) {
    return 'critical'
  }
  if (type.includes('p99') || type.includes('slow_query')) {
    return 'warning'
  }
  return 'info'
}

function checkAllThresholds(allMetrics) {
  try {
    checkErrorRate(allMetrics.errors)
    checkLatency(allMetrics.requests)
    checkResources(allMetrics.resources)
    checkDatabase(allMetrics.database)
  } catch (err) {
    console.error('[AlertManager] Check error:', err)
  }
}

function registerAlertHandler(handler) {
  alertHandlers.push(handler)
}

function getRecentAlerts(limit = 50) {
  return alerts.slice(-limit)
}

function clearAlerts() {
  alerts.length = 0
  alertCooldowns.clear()
}

function setThreshold(metric, value) {
  if (thresholds[metric]) {
    if (typeof thresholds[metric] === 'object' && 'threshold' in thresholds[metric]) {
      thresholds[metric].threshold = value
    } else {
      thresholds[metric] = value
    }
  }
}

function enableAlerting() {
  alertingEnabled = true
}

function disableAlerting() {
  alertingEnabled = false
}

export {
  checkAllThresholds,
  triggerAlert,
  registerAlertHandler,
  getRecentAlerts,
  clearAlerts,
  setThreshold,
  enableAlerting,
  disableAlerting
}

if (typeof globalThis !== 'undefined') {
  globalThis.__alerts = {
    getRecentAlerts,
    triggerAlert,
    clearAlerts,
    setThreshold
  }
}
