import { AppError, normalizeError, createErrorLogger } from './types.js';
import { apiError } from '../response-formatter.js';
import { NextResponse } from '../next-shim.js';
import { HTTP } from '../../config/constants.js';

// ---------------------------------------------------------------------------
// wrap(): the single configurable wrapper subsuming what with-error-handler.js
// and api-error-wrapper.js used to do separately (timeout, retry-with-backoff,
// logging) as options. Every call site keeps its original named import below —
// each is now a thin adapter over wrap() with the exact defaults/behavior the
// original standalone function had.
// ---------------------------------------------------------------------------
export function wrap(fn, options = {}) {
  const {
    retry = false,
    retryOptions = { maxAttempts: 3 },
    timeout = null,
    log = null, // { context } to enable normalize+log-on-error, or null to skip
  } = options;

  return async (...args) => {
    const operation = async () => {
      if (!timeout) return fn(...args);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
      );

      return await Promise.race([fn(...args), timeoutPromise]);
    };

    try {
      if (retry) {
        return await retryWithBackoff(operation, retryOptions);
      }
      return await operation();
    } catch (e) {
      if (log) {
        const logger = createErrorLogger(log.context || '');
        const error = normalizeError(e);
        logger.error(error.code || 'ERROR', error.context || {});
      }
      throw e;
    }
  };
}

// retryWithBackoff lives here (not recovery.js) because wrap() itself needs it
// with no circular dependency; recovery.js imports it back from here.
export async function retryWithBackoff(fn, options = {}) {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        const normalized = normalizeError(error);
        throw normalized;
      }

      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// ---------------------------------------------------------------------------
// Ported from with-error-handler.js — identical behavior, same imports
// (including the pre-existing `apiError` import from response-formatter.js,
// which has no such export today; preserved as-is, not silently fixed, since
// fixing it is a behavior change outside this consolidation's scope).
// ---------------------------------------------------------------------------
export const withErrorHandler = (handler, operation = 'Operation') => {
  const logger = createErrorLogger(operation);

  return async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      const error = normalizeError(e);
      logger.error(error.code, error.context);
      return apiError(error);
    }
  };
};

export const withAsyncErrorHandler = (handler, context = '') => {
  const logger = createErrorLogger(context);

  return async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      const error = e instanceof AppError ? e : new AppError(e.message, 'INTERNAL_ERROR', HTTP.INTERNAL_ERROR, { originalMessage: e.message });
      logger.error(error.code || 'ERROR', error.context || {});
      throw error;
    }
  };
};

// ---------------------------------------------------------------------------
// Ported from api-error-wrapper.js — identical behavior/defaults.
// ---------------------------------------------------------------------------
const apiLogger = createErrorLogger('API');

export function wrapAPIRoute(handler, options = {}) {
  const { retry = false, timeout = 30000, logErrors = true } = options;

  return async (request, context) => {
    const startTime = Date.now();
    const url = new URL(request.url);

    try {
      const operation = async () => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        );

        const handlerPromise = handler(request, context);

        return await Promise.race([handlerPromise, timeoutPromise]);
      };

      const result = retry
        ? await retryWithBackoff(operation, { maxAttempts: 3, context: { url: url.pathname } })
        : await operation();

      const duration = Date.now() - startTime;

      if (duration > 1000) {
        apiLogger.warn('Slow request', { url: url.pathname, duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const normalized = normalizeError(error);

      if (logErrors) {
        apiLogger.error('Request failed', {
          url: url.pathname,
          method: request.method,
          error: normalized.toJSON(),
          duration
        });
      }

      return NextResponse.json(
        normalized.toJSON(),
        {
          status: normalized.statusCode,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

export function wrapGETRoute(handler, options = {}) {
  return wrapAPIRoute(handler, { ...options, retry: true });
}

export function wrapPOSTRoute(handler, options = {}) {
  return wrapAPIRoute(handler, options);
}

export function wrapPUTRoute(handler, options = {}) {
  return wrapAPIRoute(handler, options);
}

export function wrapDELETERoute(handler, options = {}) {
  return wrapAPIRoute(handler, options);
}

export function createAPIHandler(handlers) {
  const wrapped = {};

  if (handlers.GET) wrapped.GET = wrapGETRoute(handlers.GET);
  if (handlers.POST) wrapped.POST = wrapPOSTRoute(handlers.POST);
  if (handlers.PUT) wrapped.PUT = wrapPUTRoute(handlers.PUT);
  if (handlers.DELETE) wrapped.DELETE = wrapDELETERoute(handlers.DELETE);
  if (handlers.PATCH) wrapped.PATCH = wrapAPIRoute(handlers.PATCH);
  if (handlers.HEAD) wrapped.HEAD = wrapAPIRoute(handlers.HEAD);

  return wrapped;
}

export async function safeJSONParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (error) {
    apiLogger.warn('JSON parse failed', { error: error.message });
    return fallback;
  }
}

export async function safeReadBody(request, fallback = {}) {
  try {
    const text = await request.text();
    return text ? await safeJSONParse(text, fallback) : fallback;
  } catch (error) {
    apiLogger.warn('Body read failed', { error: error.message });
    return fallback;
  }
}

export function validateRequired(data, fields) {
  const missing = [];

  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function sanitizeError(error) {
  const safe = String(error?.message || error || 'Unknown error');
  return safe.substring(0, 500);
}
