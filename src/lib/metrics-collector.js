/**
 * Metrics Collector - Request metrics and stats
 *
 * Thatcher keeps its original lightweight request-summary API
 * (recordRequest/getMetrics/getSummary/resetMetrics) for backward compat.
 * Merged in the richer per-channel collector API consumed by
 * resource-monitor / db-monitor / request-tracker / metrics & health routes
 * (recordError/recordDatabase/recordResource/recordCustom, getAllMetrics,
 * clearMetrics, getStats, and the per-channel getters).
 */

const metrics = {
  requests: [],
  slowQueries: [],
  errors: [],
  startTime: Date.now(),
};

let _requestCount = 0;

/**
 * Record a request
 * @param {string} endpoint
 * @param {string} method
 * @param {number} durationMs
 * @param {number} statusCode
 */
export function recordRequest(endpoint, method, durationMs, statusCode) {
  _requestCount++;

  const record = {
    timestamp: Date.now(),
    endpoint,
    method,
    durationMs,
    statusCode,
  };

  metrics.requests.push(record);

  // Keep last 1000 requests
  if (metrics.requests.length > 1000) {
    metrics.requests.shift();
  }

  // Track slow queries (>500ms)
  if (durationMs > 500) {
    metrics.slowQueries.push(record);
  }

  // Track errors
  if (statusCode >= 400) {
    metrics.errors.push(record);
  }

  // Mirror into the per-channel request collector used by getAllMetrics().
  const key = `${method}:${endpoint}`;
  if (!channels.requests.has(key)) {
    channels.requests.set(key, []);
  }
  const arr = channels.requests.get(key);
  arr.push({ duration: durationMs, status: statusCode, ts: Date.now() });
  if (arr.length > 1000) arr.shift();
}

/**
 * Get all metrics
 * @returns {object}
 */
export function getMetrics() {
  const now = Date.now();
  const uptimeSec = Math.floor((now - metrics.startTime) / 1000);

  const requests = metrics.requests;
  const recent = requests.filter(r => now - r.timestamp < 60000); // last minute

  const avgDuration = recent.length
    ? recent.reduce((sum, r) => sum + r.durationMs, 0) / recent.length
    : 0;

  const errorRate = recent.length
    ? recent.filter(r => r.statusCode >= 400).length / recent.length
    : 0;

  return {
    uptime_seconds: uptimeSec,
    total_requests: _requestCount,
    requests_per_minute: recent.length,
    average_response_time_ms: Math.round(avgDuration),
    error_rate_percent: Math.round(errorRate * 100),
    slow_queries: metrics.slowQueries.slice(-10),
    recent_errors: metrics.errors.slice(-10),
  };
}

/**
 * Get summary statistics
 * @returns {object}
 */
export function getSummary() {
  const m = getMetrics();
  return {
    requests: m.total_requests,
    avgMs: m.average_response_time_ms,
    errors: m.recent_errors.length,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics() {
  metrics.requests = [];
  metrics.slowQueries = [];
  metrics.errors = [];
  _requestCount = 0;
  metrics.startTime = Date.now();
  clearMetrics();
}

// ---------------------------------------------------------------------------
// Per-channel collector API (ported from moonlanding feature set)
// Consumed by resource-monitor.js, db-monitor.js, request-tracker.js,
// api/metrics/route.js, api/health/route.js, monitoring-init.js.
// ---------------------------------------------------------------------------

const channels = {
  requests: new Map(),
  errors: new Map(),
  database: new Map(),
  resources: new Map(),
  custom: new Map(),
};

const errorCounts = new Map();
const resourceSamples = [];

/**
 * Record an error against an endpoint.
 */
export function recordError(path, method, error, stack) {
  const key = `${method}:${path}`;
  if (!channels.errors.has(key)) {
    channels.errors.set(key, []);
  }
  const arr = channels.errors.get(key);
  arr.push({ error, stack, ts: Date.now() });
  if (arr.length > 100) arr.shift();

  const countKey = error || 'unknown';
  errorCounts.set(countKey, (errorCounts.get(countKey) || 0) + 1);
}

/**
 * Record a database operation timing.
 */
export function recordDatabase(operation, duration, query) {
  const key = operation;
  if (!channels.database.has(key)) {
    channels.database.set(key, []);
  }
  const arr = channels.database.get(key);
  arr.push({ duration, query: query?.substring(0, 200), ts: Date.now() });
  if (arr.length > 1000) arr.shift();
}

/**
 * Record a resource sample (cpu/memory/disk).
 */
export function recordResource(cpu, memory, disk) {
  resourceSamples.push({ cpu, memory, disk, ts: Date.now() });
  if (resourceSamples.length > 1000) resourceSamples.shift();
}

/**
 * Record a custom metric value with optional tags.
 */
export function recordCustom(name, value, tags = {}) {
  const key = name;
  if (!channels.custom.has(key)) {
    channels.custom.set(key, []);
  }
  const arr = channels.custom.get(key);
  arr.push({ value, tags, ts: Date.now() });
  if (arr.length > 1000) arr.shift();
}

function getPercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Compute count/min/max/avg/p50/p95/p99 stats over a data array.
 */
export function getStats(dataArray, field = 'duration') {
  if (!dataArray || dataArray.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const values = dataArray.map(d => d[field] || 0).filter(v => typeof v === 'number');
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    p50: getPercentile(values, 0.50),
    p95: getPercentile(values, 0.95),
    p99: getPercentile(values, 0.99),
  };
}

export function getRequestMetrics() {
  const result = {};
  for (const [key, data] of channels.requests.entries()) {
    result[key] = getStats(data, 'duration');
  }
  return result;
}

export function getErrorMetrics() {
  const result = {
    byEndpoint: {},
    byCause: Object.fromEntries(errorCounts),
  };
  for (const [key, data] of channels.errors.entries()) {
    result.byEndpoint[key] = { count: data.length, recent: data.slice(-5) };
  }
  return result;
}

export function getDatabaseMetrics() {
  const result = {};
  for (const [key, data] of channels.database.entries()) {
    result[key] = getStats(data, 'duration');
  }
  return result;
}

export function getResourceMetrics() {
  if (resourceSamples.length === 0) return null;
  const cpuVals = resourceSamples.map(s => s.cpu).filter(v => v != null);
  const memVals = resourceSamples.map(s => s.memory).filter(v => v != null);
  const diskVals = resourceSamples.map(s => s.disk).filter(v => v != null);

  return {
    cpu: cpuVals.length > 0 ? getStats(cpuVals.map(v => ({ duration: v }))) : null,
    memory: memVals.length > 0 ? getStats(memVals.map(v => ({ duration: v }))) : null,
    disk: diskVals.length > 0 ? getStats(diskVals.map(v => ({ duration: v }))) : null,
  };
}

/**
 * Aggregate snapshot across all channels.
 */
export function getAllMetrics() {
  return {
    requests: getRequestMetrics(),
    errors: getErrorMetrics(),
    database: getDatabaseMetrics(),
    resources: getResourceMetrics(),
    custom: Object.fromEntries(
      Array.from(channels.custom.entries()).map(([k, v]) => [k, getStats(v, 'value')])
    ),
    timestamp: Date.now(),
  };
}

/**
 * Clear the per-channel collector state.
 */
export function clearMetrics() {
  channels.requests.clear();
  channels.errors.clear();
  channels.database.clear();
  channels.custom.clear();
  resourceSamples.length = 0;
  errorCounts.clear();
}

if (typeof globalThis !== 'undefined') {
  globalThis.__metrics = {
    recordRequest,
    recordError,
    recordDatabase,
    recordResource,
    recordCustom,
    getAllMetrics,
    clearMetrics,
  };
}
