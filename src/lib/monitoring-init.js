import { startMonitoring as startResourceMonitoring } from '@/lib/resource-monitor.js'
import { checkAllThresholds, registerAlertHandler } from '@/lib/alert-manager.js'
import { getAllMetrics } from '@/lib/metrics-collector.js'
import { info, warn, error } from '@/lib/log-aggregator.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let alertCheckInterval = null
let initialized = false

function initializeMonitoring(config = {}) {
  if (initialized) {
    warn('Monitoring already initialized')
    return
  }

  const {
    resourceInterval = 5000,
    alertCheckInterval: alertInterval = 10000,
    dbPath = path.join(__dirname, '../../data/app.db')
  } = config

  startResourceMonitoring(resourceInterval, dbPath)
  info('Resource monitoring started', { interval: resourceInterval })

  alertCheckInterval = setInterval(() => {
    try {
      const metrics = getAllMetrics()
      checkAllThresholds(metrics)
    } catch (err) {
      error('Alert check failed', { error: err.message })
    }
  }, alertInterval)

  info('Alert checking started', { interval: alertInterval })

  registerAlertHandler((alert) => {
    if (alert.severity === 'critical') {
      error(`CRITICAL ALERT: ${alert.message}`, alert.metadata)
    } else if (alert.severity === 'warning') {
      warn(`WARNING: ${alert.message}`, alert.metadata)
    }
  })

  info('Alert handlers registered')

  initialized = true
  info('Monitoring system initialized')
}

async function shutdownMonitoring() {
  if (!initialized) return

  if (alertCheckInterval) {
    clearInterval(alertCheckInterval)
    alertCheckInterval = null
  }

  const { stopMonitoring } = await import('@/lib/resource-monitor.js')
  stopMonitoring()

  initialized = false
  info('Monitoring system shutdown')
}

export { initializeMonitoring, shutdownMonitoring }
