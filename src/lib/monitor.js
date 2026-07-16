// Merged from db-monitor.js + resource-monitor.js into one pluggable-probe
// monitor rather than two hardcoded monitor types. A "probe" is anything
// shaped like { name, start(), stop(), collect() } registered into the
// shared registry below; the db and resource probes that used to be two
// separate files are now just the two probes registered by default. Every
// original exported function name is preserved unchanged for call-site
// compatibility (getDatabaseStats, clearDatabaseStats, wrapDatabase,
// getCPUUsage, getMemoryUsage, getDiskUsage, collectResources,
// startMonitoring, stopMonitoring, getCurrentResources).

import os from 'os';
import fs from 'fs';
import { recordDatabase, recordResource } from './metrics-collector.js';
import { createLogger } from './logger.js';

const log = createLogger('[Monitor]');

// ---------------------------------------------------------------------------
// Pluggable probe registry
// ---------------------------------------------------------------------------
const probes = new Map();

function registerProbe(name, probe) {
  probes.set(name, probe);
  return probe;
}

function getProbe(name) {
  return probes.get(name);
}

function listProbes() {
  return Array.from(probes.keys());
}

// ---------------------------------------------------------------------------
// db probe — from db-monitor.js
// ---------------------------------------------------------------------------
const dbStats = {
  connections: 0,
  activeQueries: 0,
  locks: 0,
  slowQueries: []
};

function recordSlowQuery(sql, duration) {
  dbStats.slowQueries.push({
    sql: sql.substring(0, 200),
    duration,
    timestamp: Date.now()
  });

  if (dbStats.slowQueries.length > 100) {
    dbStats.slowQueries.shift();
  }
}

export function wrapDatabase(db) {
  const originalPrepare = db.prepare.bind(db);

  db.prepare = function(sql) {
    const stmt = originalPrepare(sql);
    const originalRun = stmt.run.bind(stmt);
    const originalGet = stmt.get.bind(stmt);
    const originalAll = stmt.all.bind(stmt);

    stmt.run = function(...args) {
      const start = process.hrtime.bigint();
      dbStats.activeQueries++;

      try {
        const result = originalRun(...args);
        const duration = Number(process.hrtime.bigint() - start) / 1000000;

        recordDatabase('run', duration, sql);
        if (duration > 100) {
          recordSlowQuery(sql, duration);
        }

        return result;
      } catch (err) {
        recordDatabase('error', 0, sql);
        throw err;
      } finally {
        dbStats.activeQueries--;
      }
    };

    stmt.get = function(...args) {
      const start = process.hrtime.bigint();
      dbStats.activeQueries++;

      try {
        const result = originalGet(...args);
        const duration = Number(process.hrtime.bigint() - start) / 1000000;

        recordDatabase('get', duration, sql);
        if (duration > 100) {
          recordSlowQuery(sql, duration);
        }

        return result;
      } catch (err) {
        recordDatabase('error', 0, sql);
        throw err;
      } finally {
        dbStats.activeQueries--;
      }
    };

    stmt.all = function(...args) {
      const start = process.hrtime.bigint();
      dbStats.activeQueries++;

      try {
        const result = originalAll(...args);
        const duration = Number(process.hrtime.bigint() - start) / 1000000;

        recordDatabase('all', duration, sql);
        if (duration > 100) {
          recordSlowQuery(sql, duration);
        }

        return result;
      } catch (err) {
        recordDatabase('error', 0, sql);
        throw err;
      } finally {
        dbStats.activeQueries--;
      }
    };

    return stmt;
  };

  return db;
}

export function getDatabaseStats() {
  return {
    connections: dbStats.connections,
    activeQueries: dbStats.activeQueries,
    locks: dbStats.locks,
    slowQueries: dbStats.slowQueries.slice(-10)
  };
}

export function clearDatabaseStats() {
  dbStats.slowQueries.length = 0;
}

registerProbe('db', {
  name: 'db',
  start: () => {},
  stop: () => {},
  collect: getDatabaseStats,
  clear: clearDatabaseStats,
});

// ---------------------------------------------------------------------------
// resource probe — from resource-monitor.js
// ---------------------------------------------------------------------------
let monitoringInterval = null;
let dbPath = null;

export function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 1 - (idle / total);

  return Math.max(0, Math.min(1, usage));
}

export function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    total: totalMem,
    used: usedMem,
    free: freeMem,
    percentage: usedMem / totalMem
  };
}

export function getDiskUsage() {
  if (!dbPath) return null;

  try {
    const stats = fs.statSync(dbPath);
    const totalSpace = 1024 * 1024 * 1024 * 100;
    const usedSpace = stats.size;

    return {
      total: totalSpace,
      used: usedSpace,
      percentage: usedSpace / totalSpace
    };
  } catch (err) {
    return null;
  }
}

export function collectResources() {
  try {
    const cpu = getCPUUsage();
    const memory = getMemoryUsage();
    const disk = getDiskUsage();

    recordResource(
      cpu,
      memory.percentage,
      disk?.percentage
    );

    return { cpu, memory, disk };
  } catch (err) {
    log.error('collection error:', { message: err?.message || String(err) });
    return null;
  }
}

export function startMonitoring(interval = 5000, databasePath = null) {
  if (monitoringInterval) {
    stopMonitoring();
  }

  dbPath = databasePath;

  monitoringInterval = setInterval(() => {
    collectResources();
  }, interval);
}

export function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

export function getCurrentResources() {
  return collectResources();
}

registerProbe('resource', {
  name: 'resource',
  start: startMonitoring,
  stop: stopMonitoring,
  collect: getCurrentResources,
});

// ---------------------------------------------------------------------------
// Probe registry surface (new — the pluggable-probe pattern the merge adds)
// ---------------------------------------------------------------------------
export { registerProbe, getProbe, listProbes };

if (typeof globalThis !== 'undefined') {
  globalThis.__dbMonitor = {
    getDatabaseStats,
    clearDatabaseStats
  };
  globalThis.__resources = {
    getCurrentResources,
    startMonitoring,
    stopMonitoring
  };
  globalThis.__monitor = {
    registerProbe,
    getProbe,
    listProbes,
  };
}
