// Merged from three parallel timing layers:
//  - perf-profiler.js: the real, actively-used PerfProfiler class (record/
//    measure/getStats/regressions/alerts), consumed by request-tracing.js,
//    observability-bootstrap.js, and api/debug/[[...path]]/route.js.
//  - perf-monitor.js: a simpler Map-based timer/threshold API
//    (startTimer/endTimer/recordMetric/getStats/measure), zero external
//    call sites at merge time, kept for its lighter-weight API shape.
//  - query-perf.js: SQL-specific query tracking (trackQuery/getSlowQueries),
//    zero external call sites at merge time.
// perf-monitor.js's and query-perf.js's `getMetrics`/`clearMetrics` collided
// on name; query-perf.js's versions are renamed getQueryMetrics/
// clearQueryMetrics below (nothing imported the unqualified names, confirmed
// by grep, so this is a safe rename with zero call sites to migrate).

import { createLogger } from './logger.js';

const logger = createLogger('[Perf]');

// ---------------------------------------------------------------------------
// From perf-profiler.js — the real, actively-used API.
// ---------------------------------------------------------------------------
const _profiles = new Map();
const _alerts = [];
const MAX_ALERTS = 100;
const BASELINE_WINDOW_MS = 3600000;

const DEFAULT_THRESHOLDS = {
  'http.request': 500,
  'db.query': 100,
  'db.write': 200,
  'hook.execute': 50,
  'workflow.transition': 100,
  'formula.evaluate': 50,
  'auth.login': 300,
  'render.page': 200,
};

export class PerfProfiler {
  constructor() {
    this._profiles = _profiles;
    this._thresholds = new Map(Object.entries(DEFAULT_THRESHOLDS));
  }

  setThreshold(operation, thresholdMs) {
    this._thresholds.set(operation, thresholdMs);
  }

  getThreshold(operation) {
    return this._thresholds.get(operation) || 100;
  }

  record(operation, durationMs, metadata = {}) {
    let profile = _profiles.get(operation);
    if (!profile) {
      profile = {
        operation,
        count: 0,
        totalMs: 0,
        minMs: Infinity,
        maxMs: 0,
        durations: [],
        slowCount: 0,
        lastRecorded: null,
        metadata: {},
      };
      _profiles.set(operation, profile);
    }

    profile.count++;
    profile.totalMs += durationMs;
    profile.minMs = Math.min(profile.minMs, durationMs);
    profile.maxMs = Math.max(profile.maxMs, durationMs);
    profile.lastRecorded = Date.now();

    profile.durations.push({ durationMs, timestamp: Date.now(), ...metadata });
    while (profile.durations.length > 10000) {
      profile.durations.shift();
    }

    const threshold = this.getThreshold(operation);
    if (durationMs > threshold) {
      profile.slowCount++;
      this._maybeAlert(operation, durationMs, threshold, metadata);
    }

    return profile;
  }

  async measure(operation, fn, metadata = {}) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.record(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(operation, duration, { ...metadata, error: error.message });
      throw error;
    }
  }

  measureSync(operation, fn, metadata = {}) {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.record(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(operation, duration, { ...metadata, error: error.message });
      throw error;
    }
  }

  getStats(operation) {
    const profile = _profiles.get(operation);
    if (!profile) return null;

    const durations = profile.durations.map(d => d.durationMs).sort((a, b) => a - b);
    const count = durations.length;

    return {
      operation: profile.operation,
      count: profile.count,
      totalMs: profile.totalMs,
      avgMs: profile.count > 0 ? profile.totalMs / profile.count : 0,
      minMs: profile.minMs === Infinity ? 0 : profile.minMs,
      maxMs: profile.maxMs,
      p50: this._percentile(durations, 50),
      p95: this._percentile(durations, 95),
      p99: this._percentile(durations, 99),
      slowCount: profile.slowCount,
      threshold: this.getThreshold(operation),
      lastRecorded: profile.lastRecorded,
    };
  }

  getAllStats() {
    return Array.from(_profiles.keys()).map(key => this.getStats(key));
  }

  getSlowOperations() {
    return this.getAllStats()
      .filter(s => s.slowCount > 0)
      .sort((a, b) => b.slowCount - a.slowCount);
  }

  detectRegressions(windowMs = 300000) {
    const regressions = [];
    const now = Date.now();

    for (const [operation, profile] of _profiles.entries()) {
      const recent = profile.durations.filter(d => now - d.timestamp < windowMs);
      const older = profile.durations.filter(d => now - d.timestamp >= windowMs && now - d.timestamp < windowMs * 2);

      if (recent.length < 10 || older.length < 10) continue;

      const recentAvg = recent.reduce((sum, d) => sum + d.durationMs, 0) / recent.length;
      const olderAvg = older.reduce((sum, d) => sum + d.durationMs, 0) / older.length;

      if (olderAvg > 0 && recentAvg > olderAvg * 1.5) {
        regressions.push({
          operation,
          recentAvg: Math.round(recentAvg * 100) / 100,
          olderAvg: Math.round(olderAvg * 100) / 100,
          regressionPercent: Math.round((recentAvg / olderAvg - 1) * 100),
          sampleSize: recent.length,
        });
      }
    }

    return regressions;
  }

  getAlerts() {
    return [..._alerts];
  }

  clearAlerts() {
    _alerts.length = 0;
  }

  clear() {
    _profiles.clear();
    _alerts.length = 0;
  }

  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  _maybeAlert(operation, durationMs, thresholdMs, metadata) {
    const alertKey = `${operation}:slow`;
    const existing = _alerts.find(a => a.key === alertKey && Date.now() - a.timestamp < 60000);
    if (existing) return;

    const alert = {
      key: alertKey,
      operation,
      type: 'slow_operation',
      durationMs: Math.round(durationMs * 100) / 100,
      thresholdMs,
      severity: durationMs > thresholdMs * 5 ? 'critical' : durationMs > thresholdMs * 2 ? 'warning' : 'info',
      timestamp: Date.now(),
      metadata,
    };

    _alerts.push(alert);
    while (_alerts.length > MAX_ALERTS) {
      _alerts.shift();
    }

    logger.warn('Slow operation detected', alert);
  }
}

export const perfProfiler = new PerfProfiler();

export function createPerfProfiler() {
  return new PerfProfiler();
}

export function getPerfProfiler() {
  return perfProfiler;
}

export async function measurePerf(operation, fn, metadata = {}) {
  return perfProfiler.measure(operation, fn, metadata);
}

export function measurePerfSync(operation, fn, metadata = {}) {
  return perfProfiler.measureSync(operation, fn, metadata);
}

export default PerfProfiler;

if (globalThis.__debug__) {
  globalThis.__debug__.expose('perf', {
    stats: (op) => op ? perfProfiler.getStats(op) : perfProfiler.getAllStats(),
    slow: () => perfProfiler.getSlowOperations(),
    regressions: () => perfProfiler.detectRegressions(),
    alerts: () => perfProfiler.getAlerts(),
    thresholds: () => Object.fromEntries(perfProfiler._thresholds),
  }, 'Performance Profiler');
}

// ---------------------------------------------------------------------------
// From perf-monitor.js — a simpler Map-based timer/threshold API.
// ---------------------------------------------------------------------------
const metrics = new Map();
const thresholds = { render: 100, query: 50, api: 200, total: 500 };
let enabled = process.env.PERF_MONITOR !== 'false';

export function startTimer(key) {
  if (!enabled) return null;
  const start = process.hrtime.bigint();
  return { key, start };
}

export function endTimer(timer) {
  if (!enabled || !timer) return 0;
  const end = process.hrtime.bigint();
  const ms = Number(end - timer.start) / 1000000;
  recordMetric(timer.key, ms);
  return ms;
}

export function recordMetric(key, value) {
  if (!enabled) return;
  if (!metrics.has(key)) metrics.set(key, []);
  const arr = metrics.get(key);
  arr.push({ value, ts: Date.now() });
  if (arr.length > 1000) arr.shift();
}

export function getMetrics(key) {
  if (!key) return Object.fromEntries(metrics.entries());
  return metrics.get(key) || [];
}

export function getSimpleStats(key) {
  const data = metrics.get(key) || [];
  if (data.length === 0) return null;
  const values = data.map(d => d.value);
  values.sort((a, b) => a - b);
  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    p99: values[Math.floor(values.length * 0.99)]
  };
}

export function checkThreshold(key, value) {
  if (!enabled) return true;
  const limit = thresholds[key];
  if (limit && value > limit) {
    logger.warn(`${key} exceeded threshold: ${value.toFixed(2)}ms > ${limit}ms`);
    return false;
  }
  return true;
}

export function setThreshold(key, ms) {
  thresholds[key] = ms;
}

export function clearMetrics() {
  metrics.clear();
}

export function enable() {
  enabled = true;
}

export function disable() {
  enabled = false;
}

export function measure(key, fn) {
  const timer = startTimer(key);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        const ms = endTimer(timer);
        checkThreshold(key, ms);
      });
    }
    const ms = endTimer(timer);
    checkThreshold(key, ms);
    return result;
  } catch (err) {
    endTimer(timer);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// From query-perf.js — SQL-specific query tracking. `getMetrics`/
// `clearMetrics` renamed to getQueryMetrics/clearQueryMetrics to avoid
// colliding with perf-monitor.js's same-named exports above (nothing
// imported the unqualified names; see file-header note).
// ---------------------------------------------------------------------------
const queryMetrics = new Map();
const slowQueries = [];
const MAX_SLOW_QUERIES = 100;
const SLOW_QUERY_THRESHOLD = 100;

export const trackQuery = (sql, duration, params = []) => {
  const key = sql.substring(0, 200);

  if (!queryMetrics.has(key)) {
    queryMetrics.set(key, {
      sql: key,
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      times: []
    });
  }

  const metric = queryMetrics.get(key);
  metric.count++;
  metric.totalTime += duration;
  metric.minTime = Math.min(metric.minTime, duration);
  metric.maxTime = Math.max(metric.maxTime, duration);
  metric.times.push(duration);

  if (metric.times.length > 1000) metric.times.shift();

  if (duration >= SLOW_QUERY_THRESHOLD) {
    slowQueries.push({
      sql: key,
      duration,
      params: params.slice(0, 10),
      timestamp: Date.now()
    });

    if (slowQueries.length > MAX_SLOW_QUERIES) slowQueries.shift();
  }
};

const percentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, index)];
};

export const getQueryMetrics = () => {
  const result = [];

  for (const [, metric] of queryMetrics) {
    const avgTime = metric.count > 0 ? metric.totalTime / metric.count : 0;
    const p50 = percentile(metric.times, 50);
    const p95 = percentile(metric.times, 95);
    const p99 = percentile(metric.times, 99);

    result.push({
      sql: metric.sql,
      count: metric.count,
      avgTime: avgTime.toFixed(2),
      minTime: metric.minTime === Infinity ? 0 : metric.minTime.toFixed(2),
      maxTime: metric.maxTime.toFixed(2),
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
      totalTime: metric.totalTime.toFixed(2)
    });
  }

  return result.sort((a, b) => parseFloat(b.totalTime) - parseFloat(a.totalTime));
};

export const getSlowQueries = () => {
  return slowQueries.slice().reverse();
};

export const getSummary = () => {
  const qm = getQueryMetrics();
  const totalQueries = qm.reduce((sum, m) => sum + m.count, 0);
  const totalTime = qm.reduce((sum, m) => sum + parseFloat(m.totalTime), 0);
  const allTimes = [];

  for (const [, metric] of queryMetrics) {
    allTimes.push(...metric.times);
  }

  return {
    totalQueries,
    uniqueQueries: qm.length,
    totalTime: totalTime.toFixed(2),
    avgTime: totalQueries > 0 ? (totalTime / totalQueries).toFixed(2) : '0',
    p50: percentile(allTimes, 50).toFixed(2),
    p95: percentile(allTimes, 95).toFixed(2),
    p99: percentile(allTimes, 99).toFixed(2),
    slowQueries: slowQueries.length,
    slowQueryThreshold: SLOW_QUERY_THRESHOLD
  };
};

export const clearQueryMetrics = () => {
  queryMetrics.clear();
  slowQueries.length = 0;
};

export const withPerfTracking = (db, sql, params, executor) => {
  const start = performance.now();
  try {
    const result = executor();
    const duration = performance.now() - start;
    trackQuery(sql, duration, params);
    return result;
  } catch (e) {
    const duration = performance.now() - start;
    trackQuery(sql, duration, params);
    throw e;
  }
};
