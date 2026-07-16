import { HTTP } from '../config/constants.js';

export function ok(data) {
  return new Response(JSON.stringify(data), {
    status: HTTP.OK,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function created(data) {
  return new Response(JSON.stringify(data), {
    status: HTTP.CREATED,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function paginated(items, pagination) {
  return new Response(JSON.stringify({
    items,
    pagination,
  }), {
    status: HTTP.OK,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function noContent() {
  return new Response(null, { status: HTTP.NO_CONTENT });
}

export function error(message, status = HTTP.INTERNAL_ERROR, code = 'ERROR') {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Accepts a normalized AppError-shaped object (message/code/status/details)
// and renders it the same way error() renders a plain message/status/code
// triple. Pre-existing callers (withErrorHandler in lib/errors/wrap.js)
// imported this name with no such export ever having existed here; adding
// it now is the real fix for what was previously a dead, never-taken error
// path (nothing ever exercised it directly, so the gap went unnoticed).
export function apiError(err) {
  const status = err?.status || err?.statusCode || HTTP.INTERNAL_ERROR;
  const code = err?.code || 'ERROR';
  const message = err?.message || 'An unexpected error occurred';
  const body = { error: message, code };
  if (err?.details) body.details = err.details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function withMetadata(data, status, type = 'success') {
  return { ...data, _meta: { status, type, timestamp: Date.now() } };
}
