import { recordDatabase } from '@/lib/metrics-collector.js'

const dbStats = {
  connections: 0,
  activeQueries: 0,
  locks: 0,
  slowQueries: []
}

function wrapDatabase(db) {
  const originalPrepare = db.prepare.bind(db)

  db.prepare = function(sql) {
    const stmt = originalPrepare(sql)
    const originalRun = stmt.run.bind(stmt)
    const originalGet = stmt.get.bind(stmt)
    const originalAll = stmt.all.bind(stmt)

    stmt.run = function(...args) {
      const start = process.hrtime.bigint()
      dbStats.activeQueries++

      try {
        const result = originalRun(...args)
        const duration = Number(process.hrtime.bigint() - start) / 1000000

        recordDatabase('run', duration, sql)
        if (duration > 100) {
          recordSlowQuery(sql, duration)
        }

        return result
      } catch (err) {
        recordDatabase('error', 0, sql)
        throw err
      } finally {
        dbStats.activeQueries--
      }
    }

    stmt.get = function(...args) {
      const start = process.hrtime.bigint()
      dbStats.activeQueries++

      try {
        const result = originalGet(...args)
        const duration = Number(process.hrtime.bigint() - start) / 1000000

        recordDatabase('get', duration, sql)
        if (duration > 100) {
          recordSlowQuery(sql, duration)
        }

        return result
      } catch (err) {
        recordDatabase('error', 0, sql)
        throw err
      } finally {
        dbStats.activeQueries--
      }
    }

    stmt.all = function(...args) {
      const start = process.hrtime.bigint()
      dbStats.activeQueries++

      try {
        const result = originalAll(...args)
        const duration = Number(process.hrtime.bigint() - start) / 1000000

        recordDatabase('all', duration, sql)
        if (duration > 100) {
          recordSlowQuery(sql, duration)
        }

        return result
      } catch (err) {
        recordDatabase('error', 0, sql)
        throw err
      } finally {
        dbStats.activeQueries--
      }
    }

    return stmt
  }

  return db
}

function recordSlowQuery(sql, duration) {
  dbStats.slowQueries.push({
    sql: sql.substring(0, 200),
    duration,
    timestamp: Date.now()
  })

  if (dbStats.slowQueries.length > 100) {
    dbStats.slowQueries.shift()
  }
}

function getDatabaseStats() {
  return {
    connections: dbStats.connections,
    activeQueries: dbStats.activeQueries,
    locks: dbStats.locks,
    slowQueries: dbStats.slowQueries.slice(-10)
  }
}

function clearDatabaseStats() {
  dbStats.slowQueries.length = 0
}

export {
  wrapDatabase,
  getDatabaseStats,
  clearDatabaseStats
}

if (typeof globalThis !== 'undefined') {
  globalThis.__dbMonitor = {
    getDatabaseStats,
    clearDatabaseStats
  }
}
