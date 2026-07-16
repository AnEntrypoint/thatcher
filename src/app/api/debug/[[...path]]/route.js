import { tracer } from '@/lib/tracing.js';
import { perfProfiler } from '@/lib/perf.js';
import { debugRegistry } from '@/lib/debug-registry.js';
import { getExportSink } from '@/lib/export-sink.js';
import { getXStateWorkflowEngine } from '@/lib/xstate-workflow-engine.js';
import { getHyperFormulaService } from '@/lib/hyperformula-service.js';
import { getBusyBaseAdapter } from '@/lib/busybase/adapter.js';
import { hookEngine } from '@/lib/hook-engine.js';
import { createLogger } from '@/lib/logger.js';

const logger = createLogger('[DebugAPI]');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export async function GET(request) {
  // The debug surface exposes memory, CPU, queries, hooks, config and env state.
  // That is operational intelligence an attacker must never get in production, so
  // the endpoint is disabled there outright (opt back in only behind real auth).
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('Debug endpoints are disabled in production', 403);
  }
  const url = new URL(request.url);
  const path = url.pathname;
  const params = url.searchParams;

  try {
    if (path === '/api/debug') {
      return jsonResponse({
        subsystems: {
          tracing: tracer.getStats(),
          performance: perfProfiler.getAllStats().length,
          xstate: getXStateWorkflowEngine()?.getStats() || null,
          hyperformula: getHyperFormulaService()?.getStats() || null,
          busybase: getBusyBaseAdapter()?.getStats() || null,
          hooks: hookEngine.stats(),
          export: getExportSink()?.getStats() || null,
          health: debugRegistry.health(),
        },
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    }

    if (path === '/api/debug/traces') {
      const limit = parseInt(params.get('limit') || '100');
      const status = params.get('status');
      const minDuration = parseFloat(params.get('duration'));

      let traces = tracer.getRecentTraces(limit * 10);

      if (status) {
        traces = traces.filter(t => t.status === status);
      }

      if (minDuration) {
        traces = traces.filter(t => t.duration && t.duration > minDuration);
      }

      return jsonResponse({ traces: traces.slice(-limit), count: traces.length });
    }

    if (path.startsWith('/api/debug/traces/')) {
      const traceId = path.split('/api/debug/traces/')[1];
      const trace = tracer.getTraceById(traceId);
      if (!trace) return errorResponse(`Trace "${traceId}" not found`, 404);
      return jsonResponse(trace);
    }

    if (path === '/api/debug/formulas') {
      const service = getHyperFormulaService();
      if (!service) return errorResponse('HyperFormula not initialized', 503);
      return jsonResponse({
        sheets: service.listSheets(),
        stats: service.getStats(),
        log: service.getStats().evaluationLogSize,
      });
    }

    if (path.startsWith('/api/debug/formulas/')) {
      const service = getHyperFormulaService();
      if (!service) return errorResponse('HyperFormula not initialized', 503);
      const sheetName = decodeURIComponent(path.split('/api/debug/formulas/')[1]);
      const info = service.getSheetInfo(sheetName);
      if (!info) return errorResponse(`Sheet "${sheetName}" not found`, 404);
      return jsonResponse({
        ...info,
        values: service.getSheetValues(sheetName),
      });
    }

    if (path === '/api/debug/machines') {
      const engine = getXStateWorkflowEngine();
      if (!engine) return errorResponse('XState engine not initialized', 503);
      return jsonResponse({
        actors: engine.getActiveActors(),
        machines: engine.getCachedMachines(),
        stats: engine.getStats(),
      });
    }

    if (path.startsWith('/api/debug/machines/')) {
      const engine = getXStateWorkflowEngine();
      if (!engine) return errorResponse('XState engine not initialized', 503);
      const actorKey = path.split('/api/debug/machines/')[1];
      const snapshot = engine.getSnapshot(...actorKey.split(':'));
      if (!snapshot) return errorResponse(`Actor "${actorKey}" not found`, 404);
      return jsonResponse({
        actorKey,
        value: snapshot.value,
        context: snapshot.context,
        done: snapshot.done,
      });
    }

    if (path === '/api/debug/hooks') {
      return jsonResponse({
        stats: hookEngine.stats(),
        events: Object.keys(hookEngine.stats()),
        totalHandlers: Object.values(hookEngine.stats()).reduce((a, b) => a + b, 0),
      });
    }

    if (path === '/api/debug/database') {
      const dbMonitor = globalThis.__dbMonitor;
      const busybase = getBusyBaseAdapter();

      return jsonResponse({
        monitor: dbMonitor ? {
          activeQueries: dbMonitor.activeQueries?.length || 0,
          slowQueries: dbMonitor.slowQueries?.slice(-20) || [],
          stats: dbMonitor.stats?.(),
        } : null,
        busybase: busybase ? busybase.getStats() : null,
      });
    }

    if (path === '/api/debug/realtime') {
      const channels = globalThis.__channels || {};
      return jsonResponse({
        channels: Object.keys(channels),
        subscribers: Object.entries(channels).map(([name, ch]) => ({
          name,
          subscriberCount: ch.subscribers?.length || 0,
        })),
      });
    }

    if (path === '/api/debug/health') {
      return jsonResponse(debugRegistry.health());
    }

    if (path === '/api/debug/metrics') {
      const metrics = globalThis.__metrics;
      return jsonResponse({
        metrics: metrics ? {
          requests: metrics.requests?.slice(-100) || [],
          slowQueries: metrics.slowQueries || [],
          errors: metrics.errors?.slice(-50) || [],
          stats: metrics.getStats?.(),
        } : null,
        performance: perfProfiler.getAllStats(),
        slowOperations: perfProfiler.getSlowOperations(),
        regressions: perfProfiler.detectRegressions(),
      });
    }

    if (path === '/api/debug/system') {
      return jsonResponse({
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DEBUG: process.env.DEBUG,
          PORT: process.env.PORT,
        },
      });
    }

    if (path === '/api/debug/perf') {
      return jsonResponse({
        stats: perfProfiler.getAllStats(),
        slow: perfProfiler.getSlowOperations(),
        regressions: perfProfiler.detectRegressions(),
        alerts: perfProfiler.getAlerts(),
        thresholds: Object.fromEntries(perfProfiler._thresholds),
      });
    }

    if (path === '/api/debug/export') {
      const sink = getExportSink();
      return jsonResponse(sink ? sink.getStats() : { enabled: false });
    }

    if (path === '/api/debug/registry') {
      return jsonResponse(debugRegistry.toJSON());
    }

    return errorResponse(`Unknown debug endpoint: ${path}`, 404);
  } catch (error) {
    logger.error('Debug API error', { error: error.message, path });
    return errorResponse(error.message, 500);
  }
}