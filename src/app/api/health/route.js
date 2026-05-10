import fs from 'fs'
import path from 'path'
import { getDatabase } from '@/engine'
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
    const db = getDatabase()
    const start = process.hrtime.bigint()

    db.prepare('SELECT 1').get()
    db.pragma('wal_checkpoint(PASSIVE)')

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
        health.database.stats = getDatabaseStats()
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
    console.error('[Health] Check failed:', error)
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
    const db = getDatabase()
    db.prepare('SELECT 1').get()
    return new Response(null, { status: 200 })
  } catch (error) {
    console.error('[Health] Check failed:', error)
    return new Response(null, { status: 503 })
  }
}
