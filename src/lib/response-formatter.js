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

export function withMetadata(data, status, type = 'success') {
  return { ...data, _meta: { status, type, timestamp: Date.now() } };
}
