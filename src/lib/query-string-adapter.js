// Adapted from moonlanding/src/lib/query-string-adapter.js

// Thatcher uses a fixed default page size (no async config-engine lookup);
// keeps QueryAdapter helpers synchronous to match existing call sites.
const DEFAULT_PAGE_SIZE = 50;

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

export function getDefault(key) {
  const defaults = {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    q: null,
    filters: {},
    sortDir: 'asc',
    limit: null,
    offset: null,
  };
  return defaults[key] ?? null;
}

// Ported from moonlanding; methods kept synchronous to match thatcher call sites
// (e.g. api.js destructures QueryAdapter.fromSearchParams(...) without await).
export class QueryAdapter {
  // Delegates to thatcher's parseQuery so the returned shape stays consistent.
  static parse(request) {
    return parseQuery(request);
  }

  static extractFilters(searchParams) {
    const filters = {};
    const reserved = new Set(['q', 'page', 'pageSize', 'page_size', 'action', 'limit', 'offset', 'sort', 'sortBy', 'dir', 'direction', 'sortDir', 'domain']);
    for (const [key, value] of searchParams) {
      if (!reserved.has(key) && value) {
        filters[key] = value;
      }
    }
    return filters;
  }

  static build(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .forEach(([k, v]) => query.append(k, v));
    return query;
  }

  static buildUrl(baseUrl, params = {}) {
    const queryString = QueryAdapter.build(params).toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  static getDefault(key) {
    return getDefault(key);
  }

  // Synchronous so callers can destructure the result directly.
  static fromSearchParams(searchParams, spec = null) {
    const get = (key) => {
      if (searchParams && typeof searchParams.get === 'function') {
        return searchParams.get(key);
      }
      return searchParams ? searchParams[key] : undefined;
    };
    const pageSizeParam = get('pageSize') || get('limit') || String(spec?.list?.pageSize || DEFAULT_PAGE_SIZE);
    return {
      q: get('q') || null,
      page: Math.max(1, parseInt(get('page') || '1', 10)),
      pageSize: parseInt(pageSizeParam, 10),
    };
  }

  static toQueryString(params = {}) {
    return QueryAdapter.build(params).toString();
  }
}

// Named exports matching moonlanding's surface, so consumers importing
// `parse`, `build`, `buildUrl`, `fromSearchParams` resolve correctly.
export const parse = (request) => QueryAdapter.parse(request);
export const build = (params) => QueryAdapter.build(params);
export const buildUrl = (baseUrl, params) => QueryAdapter.buildUrl(baseUrl, params);
export const fromSearchParams = (searchParams, spec) => QueryAdapter.fromSearchParams(searchParams, spec);
