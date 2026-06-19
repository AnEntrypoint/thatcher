import { createLogger } from './logger.js';

const logger = createLogger('[DebugRegistry]');

class DebugRegistry {
  constructor() {
    this._modules = new Map();
    this._metadata = new Map();
  }

  expose(path, valueOrGetter, description = '') {
    const parts = path.split('.');
    const leaf = parts.pop();

    let current = this._modules;
    for (const part of parts) {
      if (!current.has(part)) {
        current.set(part, new Map());
      }
      current = current.get(part);
    }

    current.set(leaf, valueOrGetter);
    this._metadata.set(path, { description, registeredAt: Date.now() });

    this._syncToGlobal();
    return this;
  }

  remove(path) {
    const parts = path.split('.');
    const leaf = parts.pop();

    let current = this._modules;
    for (const part of parts) {
      if (!current.has(part)) return this;
      current = current.get(part);
    }

    current.delete(leaf);
    this._metadata.delete(path);

    this._syncToGlobal();
    return this;
  }

  get(path) {
    const parts = path.split('.');
    let current = this._modules;

    for (const part of parts) {
      if (!current.has(part)) return undefined;
      current = current.get(part);
    }

    return typeof current === 'function' ? current() : current;
  }

  inspect(path) {
    const value = this.get(path);
    if (value === undefined) return { error: `Path "${path}" not found` };

    const meta = this._metadata.get(path);
    return {
      path,
      value: typeof value === 'function' ? value() : value,
      metadata: meta,
    };
  }

  list(prefix = '') {
    const results = [];
    for (const [path, meta] of this._metadata.entries()) {
      if (!prefix || path.startsWith(prefix)) {
        results.push({ path, description: meta.description, registeredAt: meta.registeredAt });
      }
    }
    return results;
  }

  health() {
    const checks = {};

    if (globalThis.healthState) {
      checks.health = globalThis.healthState;
    }

    if (globalThis.__resources) {
      checks.resources = globalThis.__resources;
    }

    if (globalThis.__alerts) {
      checks.alerts = globalThis.__alerts;
    }

    if (globalThis.__dbMonitor) {
      checks.database = {
        activeQueries: globalThis.__dbMonitor?.activeQueries?.length || 0,
        slowQueries: globalThis.__dbMonitor?.slowQueries?.length || 0,
      };
    }

    checks.modules = this._modules.size;
    checks.uptime = process.uptime();
    checks.memory = process.memoryUsage();

    return checks;
  }

  toJSON() {
    return this.list().map(item => ({
      ...item,
      value: this.get(item.path),
    }));
  }

  _syncToGlobal() {
    if (!globalThis.__debug__) {
      globalThis.__debug__ = {
        expose: (path, value, desc) => this.expose(path, value, desc),
        get: (path) => this.get(path),
        inspect: (path) => this.inspect(path),
        list: (prefix) => this.list(prefix),
        health: () => this.health(),
        remove: (path) => this.remove(path),
      };
    } else {
      globalThis.__debug__.expose = (path, value, desc) => this.expose(path, value, desc);
      globalThis.__debug__.get = (path) => this.get(path);
      globalThis.__debug__.inspect = (path) => this.inspect(path);
      globalThis.__debug__.list = (prefix) => this.list(prefix);
      globalThis.__debug__.health = () => this.health();
      globalThis.__debug__.remove = (path) => this.remove(path);
    }
  }
}

export const debugRegistry = new DebugRegistry();

export function expose(path, value, description = '') {
  return debugRegistry.expose(path, value, description);
}

export function removeDebug(path) {
  return debugRegistry.remove(path);
}

export function getDebug(path) {
  return debugRegistry.get(path);
}

export function inspectDebug(path) {
  return debugRegistry.inspect(path);
}

export function listDebug(prefix = '') {
  return debugRegistry.list(prefix);
}

export default DebugRegistry;