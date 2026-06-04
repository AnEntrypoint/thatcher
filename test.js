/**
 * Integration test for busybase, hyperformula, xstate, and observability
 * Run: node test.js
 */

import { HyperFormula } from 'hyperformula';
import { createMachine, createActor } from 'xstate';
import { tracer, Span } from './src/lib/tracing.js';
import { perfProfiler } from './src/lib/perf-profiler.js';
import { debugRegistry } from './src/lib/debug-registry.js';
import { HyperFormulaService, createHyperFormulaService } from './src/lib/hyperformula-service.js';
import { XStateWorkflowEngine, validateTransition, getAvailableTransitions, transition } from './src/lib/xstate-workflow-engine.js';
import { BusyBaseAdapter, createBusyBaseAdapter } from './src/lib/busybase-adapter.js';
import { bootstrapObservability } from './src/lib/observability-bootstrap.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function test(name, fn) {
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}: ${error.message}`);
  }
}

await test('1. HyperFormula - basic formula evaluation', async () => {
  const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });
  hf.addSheet('Test');
  const sheetId = hf.getSheetId('Test');
  hf.setSheetContent(sheetId, [[10, 20, 30, '=SUM(A1:C1)']]);
  const result = hf.getCellValue({ sheet: sheetId, row: 0, col: 3 });
  assert(result === 60, `SUM(A1:C1) = ${result}`);
  hf.destroy();
});

await test('2. HyperFormulaService - sheet management', async () => {
  const service = await createHyperFormulaService();
  const { name, sheetId } = service.createSheet('IntegrationTest');
  assert(name === 'IntegrationTest', `Sheet created: ${name}`);
  assert(sheetId !== undefined, 'Sheet has ID');

  service.setCellContents(name, { row: 0, col: 0 }, '=2+2');
  const value = service.getCellValue(name, { row: 0, col: 0 });
  assert(value === 4, `Formula =2+2 evaluates to ${value}`);

  const stats = service.getStats();
  assert(stats.sheetCount >= 1, `Sheet count: ${stats.sheetCount}`);

  service.removeSheet(name);
  await service.close();
});

await test('3. XState - state machine creation and transitions', async () => {
  const machine = createMachine({
    id: 'test',
    initial: 'idle',
    states: {
      idle: { on: { START: 'running' } },
      running: { on: { STOP: 'done', PAUSE: 'paused' } },
      paused: { on: { RESUME: 'running' } },
      done: { type: 'final' },
    },
  });

  const actor = createActor(machine);
  actor.start();

  assert(actor.getSnapshot().value === 'idle', `Initial state: ${actor.getSnapshot().value}`);

  actor.send({ type: 'START' });
  assert(actor.getSnapshot().value === 'running', `After START: ${actor.getSnapshot().value}`);

  actor.send({ type: 'PAUSE' });
  assert(actor.getSnapshot().value === 'paused', `After PAUSE: ${actor.getSnapshot().value}`);

  actor.send({ type: 'RESUME' });
  assert(actor.getSnapshot().value === 'running', `After RESUME: ${actor.getSnapshot().value}`);

  actor.send({ type: 'STOP' });
  assert(actor.getSnapshot().value === 'done', `After STOP: ${actor.getSnapshot().value}`);

  actor.stop();
});

await test('4. Tracing - span lifecycle', async () => {
  const result = await tracer.withSpan('test-operation', async (span) => {
    span.setAttribute('test.key', 'test-value');
    span.addEvent('test-event', { detail: 'test' });
    return 'success';
  });

  assert(result === 'success', `Span returned: ${result}`);

  const stats = tracer.getStats();
  assert(stats.bufferedTraces >= 1, `Buffered traces: ${stats.bufferedTraces}`);

  const traces = tracer.getRecentTraces(10);
  assert(traces.length >= 1, `Recent traces count: ${traces.length}`);
  assert(traces[traces.length - 1].name === 'test-operation', `Last trace name: ${traces[traces.length - 1].name}`);
});

await test('5. Performance Profiler - measurement', async () => {
  const result = await perfProfiler.measure('test.fn', async () => {
    await new Promise(r => setTimeout(r, 10));
    return 42;
  });

  assert(result === 42, `Measured function returned: ${result}`);

  const stats = perfProfiler.getStats('test.fn');
  assert(stats !== null, 'Stats exist for test.fn');
  assert(stats.count >= 1, `Count: ${stats.count}`);
  assert(stats.p50 >= 0, `P50: ${stats.p50}ms`);
});

await test('6. Debug Registry - expose and retrieve', async () => {
  debugRegistry.expose('test.module', { value: 'test-data' }, 'Test module');
  const value = debugRegistry.get('test.module');
  assert(value?.value === 'test-data', `Retrieved: ${JSON.stringify(value)}`);

  const list = debugRegistry.list('test');
  assert(list.length >= 1, `Listed ${list.length} test modules`);

  const health = debugRegistry.health();
  assert(health.modules !== undefined, 'Health includes module count');
});

await test('7. BusyBase Adapter - instantiation', async () => {
  const adapter = new BusyBaseAdapter({ mode: 'embedded', dir: 'test_busybase_data' });
  assert(adapter.config.mode === 'embedded', `Mode: ${adapter.config.mode}`);
  assert(!adapter.initialized, 'Not initialized yet');
});

await test('8. Observability Bootstrap', async () => {
  const results = await bootstrapObservability();
  assert(results.registry === true, 'Registry initialized');
  assert(results.tracing === true, 'Tracing initialized');
  assert(results.profiler === true, 'Profiler initialized');
  assert(results.hookTracing === true, 'Hook tracing initialized');
});

await test('9. XState Workflow Engine - validation (backward compat)', async () => {
  const engine = new XStateWorkflowEngine();
  await engine.init();
  assert(engine.getStats().activeActors === 0, 'No active actors initially');
  assert(engine.getStats().cachedMachines === 0, 'No cached machines initially');
  await engine.close();
});

await test('10. Export Sink - creation', async () => {
  const { ExportSink } = await import('./src/lib/export-sink.js');
  const sink = new ExportSink({ target: 'stdout' });
  assert(sink.target === 'stdout', `Target: ${sink.target}`);
  const stats = sink.getStats();
  assert(stats.queueSize === 0, 'Queue starts empty');
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);