import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('[ExportSink]');

const BATCH_DEFAULT_SIZE = 100;
const BATCH_DEFAULT_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 10000;
const RETRY_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

export class ExportSink {
  constructor(options = {}) {
    this.target = options.target || process.env.OBSERVABILITY_EXPORT_TARGET || 'stdout';
    this.url = options.url || process.env.OBSERVABILITY_EXPORT_URL || '';
    this.batchSize = options.batchSize || BATCH_DEFAULT_SIZE;
    this.batchIntervalMs = options.batchIntervalMs || BATCH_DEFAULT_INTERVAL_MS;
    this._queue = [];
    this._running = false;
    this._timer = null;
    this._exportCount = 0;
    this._errorCount = 0;
    this._lastError = null;
  }

  async init() {
    if (this.target === 'file') {
      this._filePath = options.filePath || process.env.OBSERVABILITY_EXPORT_FILE || path.join(process.cwd(), 'observability.jsonl');
      logger.info('File export sink initialized', { path: this._filePath });
    } else if (this.target === 'http') {
      if (!this.url) {
        logger.error('HTTP export requires OBSERVABILITY_EXPORT_URL');
        return;
      }
      logger.info('HTTP export sink initialized', { url: this.url });
    } else {
      logger.info('Stdout export sink initialized');
    }

    this._startBatchLoop();
    globalThis.__trace_export__ = this;

    return this;
  }

  async export(span) {
    if (this._queue.length >= MAX_QUEUE_SIZE) {
      this._queue.shift();
    }

    this._queue.push(span);

    if (this._queue.length >= this.batchSize) {
      await this._flush();
    }
  }

  async _flush() {
    if (this._queue.length === 0 || this._running) return;

    this._running = true;
    const batch = this._queue.splice(0, this.batchSize);

    try {
      await this._sendBatch(batch);
      this._exportCount += batch.length;
    } catch (error) {
      this._errorCount += batch.length;
      this._lastError = error.message;
      logger.error('Export failed', { error: error.message, target: this.target });

      this._queue.unshift(...batch);
      if (this._queue.length > MAX_QUEUE_SIZE) {
        this._queue.length = MAX_QUEUE_SIZE;
      }
    } finally {
      this._running = false;
    }
  }

  async _sendBatch(batch) {
    const otlpBatch = batch.map(span => this._toOTLP(span));

    switch (this.target) {
      case 'file':
        await this._exportToFile(otlpBatch);
        break;
      case 'http':
        await this._exportToHTTP(otlpBatch);
        break;
      case 'stdout':
      default:
        await this._exportToStdout(otlpBatch);
        break;
    }
  }

  async _exportToFile(batch) {
    const filePath = this._filePath || path.join(process.cwd(), 'observability.jsonl');
    const lines = batch.map(s => JSON.stringify(s)).join('\n') + '\n';
    fs.appendFileSync(filePath, lines);
  }

  async _exportToHTTP(batch) {
    let lastError;

    for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resourceSpans: batch }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return;
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_BACKOFF_MS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS[attempt]));
        }
      }
    }

    throw lastError;
  }

  async _exportToStdout(batch) {
    for (const span of batch) {
      console.log(JSON.stringify(span));
    }
  }

  _toOTLP(span) {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: span.kind,
      startTimeUnixNano: (span.startTime * 1000000).toString(),
      endTimeUnixNano: span.endTime ? (span.endTime * 1000000).toString() : null,
      durationNano: span.duration ? (span.duration * 1000000).toString() : null,
      status: { code: span.status === 'ok' ? 1 : 2, message: span.attributes.get('status.message') || '' },
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: this._toOTLPValue(value),
      })),
      events: span.events.map(e => ({
        timeUnixNano: (e.timestamp * 1000000).toString(),
        name: e.name,
        attributes: Object.entries(e.attributes).map(([key, value]) => ({
          key,
          value: this._toOTLPValue(value),
        })),
      })),
    };
  }

  _toOTLPValue(value) {
    if (value === null || value === undefined) {
      return { stringValue: 'null' };
    }
    switch (typeof value) {
      case 'string': return { stringValue: value };
      case 'number': return Number.isInteger(value) ? { intValue: value.toString() } : { doubleValue: value };
      case 'boolean': return { boolValue: value };
      default: return { stringValue: JSON.stringify(value) };
    }
  }

  _startBatchLoop() {
    this._timer = setInterval(() => {
      this._flush().catch(() => {});
    }, this.batchIntervalMs);

    this._timer.unref();
  }

  getStats() {
    return {
      target: this.target,
      queueSize: this._queue.length,
      exportCount: this._exportCount,
      errorCount: this._errorCount,
      lastError: this._lastError,
      running: this._running,
    };
  }

  async close() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    await this._flush();
  }
}

let _sink = null;

export async function createExportSink(options = {}) {
  if (!_sink) {
    _sink = new ExportSink(options);
    await _sink.init();
  }
  return _sink;
}

export function getExportSink() {
  return _sink;
}

export default ExportSink;