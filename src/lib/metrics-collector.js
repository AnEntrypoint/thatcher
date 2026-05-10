/**
 * Metrics Collector - Request metrics and stats
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
}
