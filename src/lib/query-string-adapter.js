/**
 * Query String Adapter - Parse URL query parameters into typed objects
 * Adapted from moonlanding/src/lib/query-string-adapter.js
 */

/**
 * Parse query string from URL
 * @param {object} request - Fetch Request or NextRequest-like
 * @returns {Promise<{q?: string, page?: number, pageSize?: number, filters?: object, sort?: object}>}
 */
export async function parseQuery(request) {
  const url = request.url || (request._url ? `http://localhost${request._url}` : 'http://localhost/');
  const searchParams = new URL(url).searchParams;

  const result = {
    q: searchParams.get('q') || null,
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || searchParams.get('page_size') || '50', 10),
    filters: {},
    sort: null,
  };

  // Parse filters (filter[key]=value)
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('filter_') || key.startsWith('filters[')) {
      const filterKey = key.replace('filter_', '').replace(/filters\[(\w+)\]/, '$1');
      result.filters[filterKey] = coerceValue(value);
    }
  }

  // Parse sort
  const sortBy = searchParams.get('sort') || searchParams.get('sortBy');
  const sortDir = searchParams.get('dir') || searchParams.get('direction') || 'asc';
  if (sortBy) {
    result.sort = {
      field: sortBy,
      dir: sortDir.toLowerCase() === 'desc' ? 'desc' : 'asc',
    };
  }

  return result;
}

/**
 * Coerce string to appropriate type
 * @param {string} value
 * @returns {any}
 */
function coerceValue(value) {
  // Lowercase boolean strings
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '') return null;

  // Number?
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;

  return value;
}

/**
 * Get default value for config key
 * @param {string} key
 * @returns {any}
 */
export function getDefault(key) {
  const defaults = {
    page: 1,
    pageSize: 50,
    q: null,
    filters: {},
  };
  return defaults[key];
}
