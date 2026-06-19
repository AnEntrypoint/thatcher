import { AsyncLocalStorage } from 'async_hooks';
import { createLogger } from './logger.js';

const logger = createLogger('[Tracing]');

const _asyncLocalStorage = new AsyncLocalStorage();
const _traceBuffer = [];
const _activeSpans = new Map();
const MAX_BUFFER_SIZE = 5000;
const SLOW_THRESHOLD_MS = 100;

let _traceIdCounter = 0;
let _spanIdCounter = 0;

function generateTraceId() {
  _traceIdCounter++;
  return `trace-${Date.now()}-${_traceIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateSpanId() {
  _spanIdCounter++;
  return `span-${_spanIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export class Span {
  constructor(options) {
    this.traceId = options.traceId;
    this.spanId = options.spanId;
    this.parentSpanId = options.parentSpanId || null;
    this.name = options.name;
    this.kind = options.kind || 'internal';
    this.startTime = options.startTime || Date.now();
    this.endTime = null;
    this.duration = null;
    this.status = options.status || 'ok';
    this.statusCode = options.statusCode || null;
    this.attributes = new Map(Object.entries(options.attributes || {}));
    this.events = [];
    this._isRecording = true;
  }

  setAttribute(key, value) {
    if (!this._isRecording) return this;
    this.attributes.set(key, value);
    return this;
  }

  setAttributes(attrs) {
    if (!this._isRecording) return this;
    for (const [key, value] of Object.entries(attrs)) {
      this.attributes.set(key, value);
    }
    return this;
  }

  addEvent(name, attributes = {}) {
    if (!this._isRecording) return this;
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  setStatus(status, message) {
    if (!this._isRecording) return this;
    this.status = status;
    if (message) {
      this.attributes.set('status.message', message);
    }
    return this;
  }

  end() {
    if (!this._isRecording) return;
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;

    if (this.duration > SLOW_THRESHOLD_MS) {
      this.setAttribute('slow', true);
      this.setAttribute('threshold.exceeded', SLOW_THRESHOLD_MS);
    }

    this._isRecording = false;
    _activeSpans.delete(this.spanId);
  }

  recordException(error) {
    if (!this._isRecording) return this;
    this.setStatus('error', error.message);
    this.addEvent('exception', {
      'exception.type': error.constructor?.name || 'Error',
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
    return this;
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      statusCode: this.statusCode,
      attributes: Object.fromEntries(this.attributes),
      events: this.events,
    };
  }
}

export class Tracer {
  constructor(name = 'thatcher') {
    this.name = name;
  }

  startSpan(name, options = {}) {
    const parentContext = _asyncLocalStorage.getStore();
    const parentSpan = parentContext?.span || null;

    const traceId = options.traceId || parentContext?.traceId || generateTraceId();
    const spanId = generateSpanId();

    const span = new Span({
      traceId,
      spanId,
      parentSpanId: parentSpan?.spanId,
      name,
      kind: options.kind,
      attributes: options.attributes,
    });

    _activeSpans.set(spanId, span);

    const context = { traceId, span };
    return { span, context };
  }

  async withSpan(name, fn, options = {}) {
    const { span, context } = this.startSpan(name, options);

    try {
      const result = await _asyncLocalStorage.run(context, () => fn(span));
      span.setStatus('ok');
      return result;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
      this._exportSpan(span);
    }
  }

  getCurrentContext() {
    return _asyncLocalStorage.getStore();
  }

  getCurrentTraceId() {
    return _asyncLocalStorage.getStore()?.traceId || null;
  }

  getCurrentSpan() {
    return _asyncLocalStorage.getStore()?.span || null;
  }

  getTraceparentHeader() {
    const ctx = this.getCurrentContext();
    if (!ctx?.span) return null;
    return `00-${ctx.traceId}-${ctx.span.spanId.replace('span-', '').replace(/-/g, '').padStart(16, '0')}-01`;
  }

  extractTraceparent(header) {
    if (!header) return null;
    const parts = header.split('-');
    if (parts.length !== 4) return null;
    return {
      version: parts[0],
      traceId: parts[1],
      parentSpanId: parts[2],
      flags: parts[3],
    };
  }

  getActiveSpans() {
    return Array.from(_activeSpans.values()).map(s => s.toJSON());
  }

  getRecentTraces(limit = 100) {
    return _traceBuffer.slice(-limit);
  }

  getTraceById(traceId) {
    const spans = _traceBuffer.filter(s => s.traceId === traceId);
    if (spans.length === 0) return null;

    const spanMap = new Map();
    for (const span of spans) {
      spanMap.set(span.spanId, { ...span, children: [] });
    }

    let root = null;
    for (const span of spanMap.values()) {
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        spanMap.get(span.parentSpanId).children.push(span);
      } else {
        root = span;
      }
    }

    return root;
  }

  getStats() {
    return {
      activeSpans: _activeSpans.size,
      bufferedTraces: _traceBuffer.length,
      maxBufferSize: MAX_BUFFER_SIZE,
    };
  }

  _exportSpan(span) {
    const json = span.toJSON();
    _traceBuffer.push(json);

    while (_traceBuffer.length > MAX_BUFFER_SIZE) {
      _traceBuffer.shift();
    }

    if (globalThis.__trace_export__) {
      globalThis.__trace_export__.export(json).catch(() => {});
    }
  }

  clear() {
    _traceBuffer.length = 0;
    _activeSpans.clear();
  }
}

export const tracer = new Tracer('thatcher');

export function createTracer(name) {
  return new Tracer(name);
}

export function getTracer() {
  return tracer;
}

export async function traceOperation(name, fn, attributes = {}) {
  return tracer.withSpan(name, async (span) => {
    span.setAttributes(attributes);
    return fn(span);
  }, { attributes });
}

export function getCurrentTraceId() {
  return tracer.getCurrentTraceId();
}

export function getTraceparentHeader() {
  return tracer.getTraceparentHeader();
}

export default Tracer;

if (globalThis.__debug__) {
  globalThis.__debug__.expose('tracing', {
    activeSpans: () => tracer.getActiveSpans(),
    recentTraces: (limit) => tracer.getRecentTraces(limit),
    traceById: (id) => tracer.getTraceById(id),
    stats: () => tracer.getStats(),
    currentTraceId: () => tracer.getCurrentTraceId(),
  }, 'Tracing Core');
}