import { createLogger } from '@/lib/logger.js';
import fs from 'fs'

const log = createLogger('[Health]');
import path from 'path'
import { count } from '@/engine'
import { getAllMetrics } from '@/lib/metrics-collector.js'
import { getDatabaseStats } from '@/lib/db-monitor.js'
import { getCurrentResources } from '@/lib/resource-monitor.js'
import { getRecentAlerts } from '@/lib/alert-manager.js'

function getLastSyncAt() {
  try {
    const dir = path.resolve('data')
    if (!fs.existsSync(dir)) return null
    const files = fs.readdirSync(dir).map(f => path.join(dir, f)).filter(p => { try { return fs.statSync(p).isFile() } catch { return false } })
    if (!files.length) return null
    const mt = Math.max(...files.map(p => fs.statSync(p).mtimeMs))
    return new Date(mt).toISOString()
  } catch { return null }
}

export const GET = async (request) => {
  try {
    const start = process.hrtime.bigint()

    // busybase liveness probe (replaces the SQLite SELECT 1 + wal_checkpoint).
    try { await count('user', {}); } catch { /* table may not exist yet; still alive */ }

    const dbLatency = Number(process.hrtime.bigint() - start) / 1000000
    const url = new URL(request.url)
    const detailed = url.searchParams.get('detailed') === 'true'

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      uptime_ms: Math.round(process.uptime() * 1000),
      last_sync_at: getLastSyncAt(),
      database: {
        connected: true,
        latency: dbLatency
      },
      db: 'ok'
    }

    if (detailed) {
      const { getUser, setCurrentRequest } = await import('@/engine.server')
      setCurrentRequest(request)
      const user = await getUser()
      if (user && (user.role === 'admin' || user.role === 'partner')) {
        health.metrics = getAllMetrics()
        try { health.database.stats = getDatabaseStats() } catch { health.database.stats = null }
        health.resources = getCurrentResources()
        health.alerts = getRecentAlerts(10)
        health.memory = {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        }
      }
    }

    return new Response(
      JSON.stringify(health, null, 2),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    log.error('check failed:', { message: error.message })
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export const HEAD = async (request) => {
  try {
    await count('user', {})
    return new Response(null, { status: 200 })
  } catch (error) {
    log.error('check failed:', { message: error.message })
    return new Response(null, { status: 503 })
  }
}
