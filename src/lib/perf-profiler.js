import { createLogger } from './logger.js';

const logger = createLogger('[PerfProfiler]');

const _profiles = new Map();
const _thresholds = new Map();
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