/**
 * Response Formatter - Standardized API response helpers
 */

import { HTTP } from '../config/constants.js';

/**
 * Successful response with data
 * @param {any} data
 * @returns {Response} NextResponse-compatible
 */
export function ok(data) {
  return new Response(JSON.stringify(data), {
    status: HTTP.OK,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Created response (201)
 * @param {any} data
 * @returns {Response}
 */
export function created(data) {
  return new Response(JSON.stringify(data), {
    status: HTTP.CREATED,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Paginated response
 * @param {Array} items
 * @param {object} pagination
 * @returns {Response}
 */
export function paginated(items, pagination) {
  return new Response(JSON.stringify({
    items,
    pagination,
  }), {
    status: HTTP.OK,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * No content response (204)
 * @returns {Response}
 */
export function noContent() {
  return new Response(null, { status: HTTP.NO_CONTENT });
}

/**
 * Error response
 * @param {string} message
 * @param {number} status
 * @param {string} code
 * @returns {Response}
 */
export function error(message, status = HTTP.INTERNAL_ERROR, code = 'ERROR') {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * With metadata wrapper
 * @param {any} data
 * @param {number} status
 * @param {string} type
 * @returns {object}
 */
export function withMetadata(data, status, type = 'success') {
  return { ...data, _meta: { status, type, timestamp: Date.now() } };
}

import { HTTP } from '../config/constants.js';
