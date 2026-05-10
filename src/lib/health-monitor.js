import { getDatabase } from '@/engine';

const healthState = {
  checks: new Map(),
  history: [],
  lastCheck: null,
  status: 'unknown'
};

export function registerHealthCheck(name, checkFn, options = {}) {
  const { critical = false, timeout = 5000 } = options;

  healthState.checks.set(name, {
    name,
    checkFn,
    critical,
    timeout,
    lastResult: null,
    lastCheck: null
  });
}

export async function runHealthCheck(name) {
  const check = healthState.checks.get(name);
  if (!check) return null;

  const start = Date.now();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
    );

    const checkPromise = check.checkFn();

    await Promise.race([checkPromise, timeoutPromise]);

    const result = {
      status: 'healthy',
      latency: Date.now() - start,
      timestamp: new Date().toISOString()
    };

    check.lastResult = result;
    check.lastCheck = Date.now();

    return result;
  } catch (error) {
    const result = {
      status: 'unhealthy',
      error: String(error?.message || error),
      latency: Date.now() - start,
      timestamp: new Date().toISOString()
    };

    check.lastResult = result;
    check.lastCheck = Date.now();

    if (check.critical) {
      console.error(`[HEALTH] Critical check failed: ${name}`, error);
    }

    return result;
  }
}

export async function runAllHealthChecks() {
  const results = {};
  const checks = Array.from(healthState.checks.keys());

  for (const name of checks) {
    results[name] = await runHealthCheck(name);
  }

  const allHealthy = Object.values(results).every(r => r.status === 'healthy');
  const criticalUnhealthy = Array.from(healthState.checks.values())
    .filter(c => c.critical && c.lastResult?.status === 'unhealthy')
    .length > 0;

  const status = criticalUnhealthy ? 'critical' : allHealthy ? 'healthy' : 'degraded';

  const summary = {
    status,
    timestamp: new Date().toISOString(),
    checks: results,
    uptime: process.uptime()
  };

  healthState.lastCheck = summary;
  healthState.status = status;
  healthState.history.push(summary);

  if (healthState.history.length > 100) {
    healthState.history.shift();
  }

  return summary;
}

export function getHealthStatus() {
  return healthState.lastCheck || { status: 'unknown', checks: {} };
}

export function getHealthHistory() {
  return healthState.history.slice(-20);
}

registerHealthCheck('database', async () => {
  const db = getDatabase();
  db.prepare('SELECT 1').get();
}, { critical: true, timeout: 2000 });

registerHealthCheck('memory', async () => {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;

  if (heapUsedMB > 512) {
    throw new Error(`High memory usage: ${heapUsedMB.toFixed(0)}MB`);
  }
}, { critical: false, timeout: 1000 });

registerHealthCheck('uptime', async () => {
  const uptime = process.uptime();
  if (uptime < 5) {
    throw new Error('Recently restarted');
  }
}, { critical: false, timeout: 100 });

if (typeof global !== 'undefined') {
  global.healthState = healthState;
  global.runHealthCheck = runHealthCheck;
  global.runAllHealthChecks = runAllHealthChecks;
  global.getHealthStatus = getHealthStatus;
}
