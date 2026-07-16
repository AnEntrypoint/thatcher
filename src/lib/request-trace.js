// Merged from request-tracing.js (span/OTel-shaped tracing over the shared
// tracer + perfProfiler) and request-tracker.js (simple duration/status
// request+error recording into metrics-collector.js's recordRequest/
// recordError channel). Two request-scoped tracking layers, same concern,
// kept side by side with their original exported names unchanged.

import { tracer } from './tracing.js';
import { perfProfiler } from './perf.js';
import { createLogger } from './logger.js';
import { recordRequest, recordError } from './metrics-collector.js';

const logger = createLogger('[RequestTracing]');

// ---------------------------------------------------------------------------
// From request-tracing.js
// ---------------------------------------------------------------------------
export function withTracing(handler) {
  return async (req, ...rest) => {
    const method = req.method || 'UNKNOWN';
    const url = req.url || '/';
    const path = url.split('?')[0];

    const traceparent = req.headers?.['traceparent'] || req.headers?.['x-traceparent'];
    const extracted = traceparent ? tracer.extractTraceparent(traceparent) : null;

    const attributes = {
      'http.method': method,
      'http.url': url,
      'http.path': path,
      'http.user_agent': req.headers?.['user-agent'],
      'http.client_ip': req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
    };

    if (extracted) {
      attributes['traceparent'] = traceparent;
    }

    return tracer.withSpan(`${method} ${path}`, async (span) => {
      span.setAttributes(attributes);

      const start = performance.now();

      try {
        let response;
        if (rest.length > 0) {
          response = await handler(req, ...rest);
        } else {
          response = await handler(req);
        }

        const duration = performance.now() - start;
        const statusCode = response?.status || response?.statusCode || 200;

        span.setAttribute('http.status_code', statusCode);
        span.setAttribute('http.duration_ms', Math.round(duration * 100) / 100);

        perfProfiler.record('http.request', duration, { method, path, statusCode });

        return response;
      } catch (error) {
        span.recordException(error);
        throw error;
      }
    }, { attributes });
  };
}

export function withDbTracing(db, queryName = 'db.query') {
  const original = { prepare: db.prepare?.bind(db) };

  if (db.prepare) {
    db.prepare = function(sql) {
      const stmt = original.prepare(sql);

      const wrapped = {};
      for (const method of ['run', 'get', 'all']) {
        if (stmt[method]) {
          wrapped[method] = async function(...args) {
            return tracer.withSpan(`${queryName}:${method}`, async (span) => {
              span.setAttributes({
                'db.statement': sql,
                'db.operation': method,
                'db.system': 'sqlite',
              });

              const start = performance.now();
              try {
                const result = stmt[method].call(stmt, ...args);
                const duration = performance.now() - start;

                span.setAttribute('db.duration_ms', Math.round(duration * 100) / 100);
                perfProfiler.record(`db.${method}`, duration, { sql: sql.slice(0, 100) });

                return result;
              } catch (error) {
                span.recordException(error);
                throw error;
              }
            });
          };
        }
      }

      return { ...stmt, ...wrapped };
    };
  }

  return db;
}

export function withHookTracing(hookEngine) {
  const originalExecute = hookEngine.execute.bind(hookEngine);
  const originalPipe = hookEngine.pipe.bind(hookEngine);

  hookEngine.execute = async function(name, data, options) {
    return tracer.withSpan(`hook:${name}`, async (span) => {
      span.setAttributes({
        'hook.name': name,
        'hook.handler_count': hookEngine.listeners(name).length,
      });

      const start = performance.now();
      try {
        const result = await originalExecute(name, data, options);
        const duration = performance.now() - start;

        span.setAttribute('hook.duration_ms', Math.round(duration * 100) / 100);
        perfProfiler.record('hook.execute', duration, { name });

        return result;
      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  };

  hookEngine.pipe = async function(name, data) {
    return tracer.withSpan(`hook:pipe:${name}`, async (span) => {
      span.setAttributes({
        'hook.name': name,
        'hook.handler_count': hookEngine.listeners(name).length,
      });

      const start = performance.now();
      try {
        const result = await originalPipe(name, data);
        const duration = performance.now() - start;

        span.setAttribute('hook.duration_ms', Math.round(duration * 100) / 100);

        return result;
      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  };

  return hookEngine;
}

export function addTraceHeaders(response, traceId) {
  if (!traceId) return response;

  if (response?.headers) {
    response.headers['X-Trace-Id'] = traceId;
  }

  if (typeof response?.setHeader === 'function') {
    response.setHeader('X-Trace-Id', traceId);
  }

  return response;
}

export function createTracingMiddleware() {
  return (req, res, next) => {
    const traceparent = req.headers?.['traceparent'];
    const extracted = traceparent ? tracer.extractTraceparent(traceparent) : null;

    const { span, context } = tracer.startSpan(`${req.method} ${req.url}`, {
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.user_agent': req.headers?.['user-agent'],
      },
    });

    if (extracted) {
      span.setAttribute('trace.parent', traceparent);
    }

    const originalEnd = res.end;
    const originalWriteHead = res.writeHead;

    res.writeHead = function(...args) {
      span.setAttribute('http.status_code', args[0]);
      return originalWriteHead.apply(this, args);
    };

    res.end = function(...args) {
      const duration = performance.now() - span.startTime;
      span.setAttribute('http.duration_ms', Math.round(duration * 100) / 100);
      span.end();

      tracer._exportSpan(span);

      return originalEnd.apply(this, args);
    };

    req.traceId = context.traceId;
    req.span = span;

    if (next) {
      return next();
    }
  };
}

export default withTracing;

// ---------------------------------------------------------------------------
// From request-tracker.js
// ---------------------------------------------------------------------------
function wrapHandler(handler, metadata = {}) {
  return async (request, context) => {
    const start = process.hrtime.bigint();
    const method = request.method;
    const path = new URL(request.url).pathname;

    try {
      const response = await handler(request, context);
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      const status = response.status || 200;

      recordRequest(path, method, duration, status);

      return response;
    } catch (err) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;

      recordRequest(path, method, duration, 500);
      recordError(path, method, err.message, err.stack);

      throw err;
    }
  };
}

function trackRequest(path, method, duration, status) {
  recordRequest(path, method, duration, status);
}

function trackError(path, method, error, stack) {
  recordError(path, method, error, stack);
}

export { wrapHandler, trackRequest, trackError };

if (typeof globalThis !== 'undefined') {
  globalThis.__requestTracker = {
    trackRequest,
    trackError
  };
}
