// Merged from monitoring-init.js (resource-monitoring + alert-threshold-check
// loop) and observability-bootstrap.js (tracing/profiler/debug-registry/
// export-sink/hook-tracing wiring) into one init entry point. Both source
// files had zero external call sites at merge time (confirmed by grep) — a
// future caller wanting "start everything observability-related" now has one
// function, `initializeObservability`, that runs both halves; the original
// two function names (`initializeMonitoring`/`bootstrapObservability`) are
// kept as exports too so a caller wanting only one half still can.

import { tracer } from './tracing.js';
import { perfProfiler } from './perf.js';
import { debugRegistry } from './debug-registry.js';
import { createExportSink } from './export-sink.js';
import { withHookTracing } from './request-trace.js';
import { hookEngine } from './hook-engine.js';
import { createLogger } from './logger.js';
import { startMonitoring as startResourceMonitoring, stopMonitoring as stopResourceMonitoring } from './monitor.js';
import { checkAllThresholds, registerAlertHandler } from './alert-manager.js';
import { getAllMetrics } from './metrics-collector.js';
import { info, warn, error } from './log-aggregator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger('[ObservabilityInit]');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let alertCheckInterval = null;
let monitoringInitialized = false;

// ---------------------------------------------------------------------------
// From monitoring-init.js — resource monitoring + alert-threshold checking.
// ---------------------------------------------------------------------------
export function initializeMonitoring(config = {}) {
  if (monitoringInitialized) {
    warn('Monitoring already initialized');
    return;
  }

  const {
    resourceInterval = 5000,
    alertCheckInterval: alertInterval = 10000,
    dbPath = path.join(__dirname, '../../data/app.db')
  } = config;

  startResourceMonitoring(resourceInterval, dbPath);
  info('Resource monitoring started', { interval: resourceInterval });

  alertCheckInterval = setInterval(() => {
    try {
      const metrics = getAllMetrics();
      checkAllThresholds(metrics);
    } catch (err) {
      error('Alert check failed', { error: err.message });
    }
  }, alertInterval);

  info('Alert checking started', { interval: alertInterval });

  registerAlertHandler((alert) => {
    if (alert.severity === 'critical') {
      error(`CRITICAL ALERT: ${alert.message}`, alert.metadata);
    } else if (alert.severity === 'warning') {
      warn(`WARNING: ${alert.message}`, alert.metadata);
    }
  });

  info('Alert handlers registered');

  monitoringInitialized = true;
  info('Monitoring system initialized');
}

export async function shutdownMonitoring() {
  if (!monitoringInitialized) return;

  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
    alertCheckInterval = null;
  }

  stopResourceMonitoring();

  monitoringInitialized = false;
  info('Monitoring system shutdown');
}

// ---------------------------------------------------------------------------
// From observability-bootstrap.js — tracing/profiler/debug-registry/export
// sink/hook-tracing wiring.
// ---------------------------------------------------------------------------
export async function bootstrapObservability(options = {}) {
  const results = {
    tracing: false,
    profiler: false,
    registry: false,
    export: false,
    hookTracing: false,
    errors: [],
  };

  try {
    debugRegistry.expose('system', {
      pid: () => process.pid,
      uptime: () => process.uptime(),
      memory: () => process.memoryUsage(),
      cpuUsage: () => process.cpuUsage(),
      version: () => process.version,
      platform: () => process.platform,
    }, 'System information');

    results.registry = true;
    logger.info('Debug registry initialized');
  } catch (error) {
    results.errors.push({ subsystem: 'registry', error: error.message });
    logger.error('Registry bootstrap failed', { error: error.message });
  }

  try {
    if (globalThis.__debug__) {
      globalThis.__debug__.expose('tracing', {
        activeSpans: () => tracer.getActiveSpans(),
        recentTraces: (limit) => tracer.getRecentTraces(limit),
        traceById: (id) => tracer.getTraceById(id),
        stats: () => tracer.getStats(),
        currentTraceId: () => tracer.getCurrentTraceId(),
      }, 'Tracing Core');
    }

    results.tracing = true;
    logger.info('Tracing initialized');
  } catch (error) {
    results.errors.push({ subsystem: 'tracing', error: error.message });
    logger.error('Tracing bootstrap failed', { error: error.message });
  }

  try {
    if (globalThis.__debug__) {
      globalThis.__debug__.expose('perf', {
        stats: (op) => op ? perfProfiler.getStats(op) : perfProfiler.getAllStats(),
        slow: () => perfProfiler.getSlowOperations(),
        regressions: () => perfProfiler.detectRegressions(),
        alerts: () => perfProfiler.getAlerts(),
        thresholds: () => Object.fromEntries(perfProfiler._thresholds),
      }, 'Performance Profiler');
    }

    results.profiler = true;
    logger.info('Performance profiler initialized');
  } catch (error) {
    results.errors.push({ subsystem: 'profiler', error: error.message });
    logger.error('Profiler bootstrap failed', { error: error.message });
  }

  try {
    const exportTarget = options.exportTarget || process.env.OBSERVABILITY_EXPORT_TARGET;
    if (exportTarget) {
      await createExportSink({
        target: exportTarget,
        url: options.exportUrl || process.env.OBSERVABILITY_EXPORT_URL,
        batchSize: options.batchSize,
        batchIntervalMs: options.batchIntervalMs,
      });
      results.export = true;
      logger.info('Export sink initialized', { target: exportTarget });
    }
  } catch (error) {
    results.errors.push({ subsystem: 'export', error: error.message });
    logger.error('Export sink bootstrap failed', { error: error.message });
  }

  try {
    withHookTracing(hookEngine);
    results.hookTracing = true;
    logger.info('Hook tracing initialized');
  } catch (error) {
    results.errors.push({ subsystem: 'hookTracing', error: error.message });
    logger.error('Hook tracing bootstrap failed', { error: error.message });
  }

  return results;
}

export async function shutdownObservability() {
  const { getExportSink } = await import('./export-sink.js');
  const sink = getExportSink();
  if (sink) {
    await sink.close();
  }

  tracer.clear();
  perfProfiler.clear();

  logger.info('Observability shutdown complete');
}

// ---------------------------------------------------------------------------
// Single init entry point (new — what the merge adds): runs both halves.
// ---------------------------------------------------------------------------
export async function initializeObservability(config = {}) {
  const { monitoring = {}, bootstrap = {} } = config;

  initializeMonitoring(monitoring);
  const bootstrapResults = await bootstrapObservability(bootstrap);

  return { monitoring: monitoringInitialized, bootstrap: bootstrapResults };
}

export async function shutdownObservabilityAll() {
  await shutdownMonitoring();
  await shutdownObservability();
}

export default initializeObservability;
