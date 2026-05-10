import { safeError } from './safe-error.js';
import { contain } from './promise-container.js';

export function wrapRouteHandler(handler, options = {}) {
  const { logErrors = true, sendErrorResponse = true, context = 'route' } = options;

  return async function wrappedHandler(req, res) {
    try {
      const result = await contain(
        Promise.resolve(handler(req, res)),
        `${context}:${req.method}:${req.url}`
      );
      return result;
    } catch (err) {
      if (logErrors) {
        console.error(`[RouteError:${context}] ${req.method} ${req.url}:`, err);
      }
      if (sendErrorResponse && !res.headersSent) {
        const safe = safeError(err);
        const statusCode = err.statusCode || err.status || 500;
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        const body = JSON.stringify({
          error: safe.message,
          type: safe.type,
          ...(process.env.NODE_ENV === 'development' && { stack: safe.stack })
        });
        res.setHeader('Content-Length', Buffer.byteLength(body, 'utf-8'));
        res.end(body);
      }
      throw err;
    }
  };
}

export function wrapRouteHandlers(handlers) {
  const wrapped = {};
  for (const [method, handler] of Object.entries(handlers)) {
    if (typeof handler === 'function') {
      wrapped[method] = wrapRouteHandler(handler, { context: method });
    } else {
      wrapped[method] = handler;
    }
  }
  return wrapped;
}
