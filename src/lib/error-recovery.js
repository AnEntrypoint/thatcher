import { retryWithBackoff, withCircuitBreaker, checkpoint, restoreCheckpoint, logRecovery, normalizeError } from '@/lib/error-handler';
import { AppError } from '@/lib/errors';
import { HTTP } from '@/config/constants';

const recoveryState = { supervisors: new Map(), lastHealthCheck: null };

export function createSupervisor(name, fn, options = {}) {
  const { maxRestarts = 5, restartWindow = 60000, onRestart = null } = options;

  const supervisor = {
    name,
    fn,
    restarts: [],
    state: 'running',
    lastError: null,
    maxRestarts,
    restartWindow,
    onRestart
  };

  recoveryState.supervisors.set(name, supervisor);
  return supervisor;
}

export async function supervise(name, fn, options = {}) {
  const supervisor = recoveryState.supervisors.get(name) || createSupervisor(name, fn, options);

  const now = Date.now();
  supervisor.restarts = supervisor.restarts.filter(t => now - t < supervisor.restartWindow);

  if (supervisor.restarts.length >= supervisor.maxRestarts) {
    const error = new AppError(
      `Supervisor ${name} exceeded restart limit`,
      'SUPERVISOR_LIMIT',
      HTTP.INTERNAL_ERROR,
      { restarts: supervisor.restarts.length }
    );
    supervisor.state = 'failed';
    supervisor.lastError = error;
    console.error(`[SUPERVISOR] ${name} failed permanently after ${supervisor.restarts.length} restarts`);
    throw error;
  }

  try {
    supervisor.state = 'running';
    const result = await fn();
    supervisor.restarts = [];
    return result;
  } catch (error) {
    supervisor.restarts.push(now);
    supervisor.lastError = normalizeError(error);

    if (supervisor.onRestart) {
      await supervisor.onRestart(error, supervisor.restarts.length);
    }

    logRecovery({ supervisor: name, restarts: supervisor.restarts.length }, 'supervisor_restart');

    if (supervisor.restarts.length < supervisor.maxRestarts) {
      const delay = Math.min(1000 * Math.pow(2, supervisor.restarts.length - 1), 30000);
      console.warn(`[SUPERVISOR] ${name} restarting in ${delay}ms (attempt ${supervisor.restarts.length})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return supervise(name, fn, options);
    }

    throw error;
  }
}

export async function degradedMode(fn, fallback, options = {}) {
  const { timeout = 5000 } = options;

  try {
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
    return { mode: 'normal', result };
  } catch (error) {
    console.warn('[DEGRADED] Falling back to degraded mode', { error: error.message });
    const result = await fallback();
    return { mode: 'degraded', result };
  }
}

export async function healthCheck(checks) {
  const results = {};
  const timestamp = new Date().toISOString();

  for (const [name, checkFn] of Object.entries(checks)) {
    try {
      const start = Date.now();
      await checkFn();
      results[name] = { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      results[name] = {
        status: 'unhealthy',
        error: String(error.message || error),
        timestamp
      };
    }
  }

  const overall = Object.values(results).every(r => r.status === 'healthy') ? 'healthy' : 'degraded';

  recoveryState.lastHealthCheck = { timestamp, overall, checks: results };

  return { status: overall, timestamp, checks: results };
}

export function isolateFailure(fn, defaultValue = null) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('[ISOLATE] Failure contained', {
        function: fn.name,
        error: String(error.message || error)
      });
      return defaultValue;
    }
  };
}

export async function withRecovery(fn, options = {}) {
  const {
    retry = true,
    circuitBreaker = null,
    supervisor = null,
    checkpointName = null,
    fallback = null
  } = options;

  let operation = fn;

  if (checkpointName) {
    const savedState = restoreCheckpoint(checkpointName);
    if (savedState) {
    }
  }

  if (supervisor) {
    operation = () => supervise(supervisor, operation, options);
  }

  if (circuitBreaker) {
    operation = () => withCircuitBreaker(circuitBreaker, operation, options);
  }

  if (retry) {
    operation = () => retryWithBackoff(operation, options);
  }

  try {
    const result = await operation();

    if (checkpointName) {
      checkpoint(checkpointName, result);
    }

    return result;
  } catch (error) {
    if (fallback) {
      console.warn('[RECOVERY] Using fallback after error', { error: error.message });
      return fallback();
    }
    throw error;
  }
}

export function getSupervisorStats() {
  return {
    supervisors: Array.from(recoveryState.supervisors.entries()).map(([name, s]) => ({
      name,
      state: s.state,
      restarts: s.restarts.length,
      lastError: s.lastError ? String(s.lastError.message) : null
    })),
    lastHealthCheck: recoveryState.lastHealthCheck
  };
}

if (typeof global !== 'undefined') {
  global.recoveryState = recoveryState;
  global.getSupervisorStats = getSupervisorStats;
  global.supervise = supervise;
  global.healthCheck = healthCheck;
}
