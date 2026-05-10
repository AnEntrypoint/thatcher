import { normalizeError, createErrorLogger, retryWithBackoff } from '@/lib/error-handler';
import { NextResponse } from '@/lib/next-polyfills';
import { HTTP } from '@/config/constants';

const logger = createErrorLogger('API');

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
        logger.warn('Slow request', { url: url.pathname, duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const normalized = normalizeError(error);

      if (logErrors) {
        logger.error('Request failed', {
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
    logger.warn('JSON parse failed', { error: error.message });
    return fallback;
  }
}

export async function safeReadBody(request, fallback = {}) {
  try {
    const text = await request.text();
    return text ? await safeJSONParse(text, fallback) : fallback;
  } catch (error) {
    logger.warn('Body read failed', { error: error.message });
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
