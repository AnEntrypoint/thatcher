import { tracer } from './tracing.js';
import { perfProfiler } from './perf-profiler.js';
import { debugRegistry } from './debug-registry.js';
import { createExportSink } from './export-sink.js';
import { withHookTracing } from './request-tracing.js';
import { hookEngine } from './hook-engine.js';
import { createLogger } from './logger.js';

const logger = createLogger('[ObservabilityBootstrap]');

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

export default bootstrapObservability;