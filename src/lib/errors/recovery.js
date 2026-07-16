import { createLogger } from '../logger.js';
import { retryWithBackoff } from './wrap.js';
import { normalizeError, AppError } from './types.js';
import { HTTP } from '../../config/constants.js';

const log = createLogger('[Recovery]');
const resilienceLog = createLogger('[Resilience]');

// ---------------------------------------------------------------------------
// Ported from error-resilience.js — circuit breaker + checkpoint primitives.
// These are used directly, and also passed as strategies into withRecovery()
// below rather than living as a second parallel wrapper module.
// ---------------------------------------------------------------------------
const errorState = { errors: [], circuitBreakers: new Map(), checkpoints: new Map() };

export function createCircuitBreaker(name, options = {}) {
  const { threshold = 5, resetTimeout = 30000 } = options;

  if (!errorState.circuitBreakers.has(name)) {
    errorState.circuitBreakers.set(name, {
      failures: 0,
      state: 'closed',
      lastFailure: null,
      nextAttempt: null,
      threshold,
      resetTimeout
    });
  }

  return errorState.circuitBreakers.get(name);
}

export async function withCircuitBreaker(name, fn, options = {}) {
  const breaker = createCircuitBreaker(name, options);

  if (breaker.state === 'open') {
    const now = Date.now();
    if (breaker.nextAttempt && now < breaker.nextAttempt) {
      throw new AppError(`Service unavailable: ${name}`, 'CIRCUIT_OPEN', HTTP.SERVICE_UNAVAILABLE, { nextAttempt: breaker.nextAttempt });
    }
    breaker.state = 'half-open';
  }

  try {
    const result = await fn();
    if (breaker.state === 'half-open') {
    }
    breaker.failures = 0;
    breaker.state = 'closed';
    return result;
  } catch (error) {
    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
      breaker.nextAttempt = Date.now() + breaker.resetTimeout;
      resilienceLog.error(`circuit ${name} opened after ${breaker.failures} failures`);
    }

    throw error;
  }
}

export function checkpoint(name, state) {
  errorState.checkpoints.set(name, {
    state: JSON.parse(JSON.stringify(state)),
    timestamp: Date.now()
  });
}

export function restoreCheckpoint(name) {
  const cp = errorState.checkpoints.get(name);
  if (cp) {
    return cp.state;
  }
  return null;
}

export function logRecovery(context, action) {
  errorState.errors.push({
    type: 'recovery',
    context,
    action,
    timestamp: new Date().toISOString()
  });
  if (errorState.errors.length > 1000) errorState.errors.shift();
}

export function getErrorStats() {
  const recent = errorState.errors.slice(-100);
  const byType = {};

  for (const err of recent) {
    byType[err.type || 'error'] = (byType[err.type || 'error'] || 0) + 1;
  }

  return {
    total: errorState.errors.length,
    recent: recent.length,
    byType,
    circuitBreakers: Array.from(errorState.circuitBreakers.entries()).map(([name, state]) => ({
      name,
      state: state.state,
      failures: state.failures,
      lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null
    })),
    checkpoints: Array.from(errorState.checkpoints.keys())
  };
}

// ---------------------------------------------------------------------------
// Ported from error-recovery.js — supervisor / degraded-mode / health-check
// strategies, now composed with the circuit-breaker + retry primitives above
// (and wrap.js's retryWithBackoff) rather than importing a second sibling
// wrapper module.
// ---------------------------------------------------------------------------
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
    log.error(`${name} failed permanently after ${supervisor.restarts.length} restarts`);
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
      log.warn(`${name} restarting in ${delay}ms (attempt ${supervisor.restarts.length})`);
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
    log.warn('falling back to degraded mode', { error: error.message });
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
      log.error('failure contained', {
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
      log.warn('using fallback after error', { error: error.message });
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
  global.errorState = errorState;
  global.getErrorStats = getErrorStats;
  global.retryWithBackoff = retryWithBackoff;
  global.withCircuitBreaker = withCircuitBreaker;
  global.checkpoint = checkpoint;
  global.restoreCheckpoint = restoreCheckpoint;
}
