import { HTTP } from '@/config/constants';
import { AppError } from '@/lib/errors';
import { normalizeError } from '@/lib/error-handler';

const errorState = { errors: [], circuitBreakers: new Map(), checkpoints: new Map() };

export async function retryWithBackoff(fn, options = {}) {
  const { maxAttempts = 3, delay = 1000, backoff = 2, context = {} } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        const normalized = normalizeError(error);
        console.error(`[RETRY] Final attempt failed:`, { ...context, attempt, error: normalized.toJSON() });
        throw normalized;
      }

      const waitTime = delay * Math.pow(backoff, attempt - 1);
      console.warn(`[RETRY] Attempt ${attempt} failed, retrying in ${waitTime}ms`, context);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

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
      console.error(`[CIRCUIT] ${name} opened after ${breaker.failures} failures`);
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

if (typeof global !== 'undefined') {
  global.errorState = errorState;
  global.getErrorStats = getErrorStats;
  global.retryWithBackoff = retryWithBackoff;
  global.withCircuitBreaker = withCircuitBreaker;
  global.checkpoint = checkpoint;
  global.restoreCheckpoint = restoreCheckpoint;
}
