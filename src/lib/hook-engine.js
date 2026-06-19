import { createLogger } from './logger.js';

const log = createLogger('[HookEngine]');

export class HookEngine {
  constructor() {
    this.hooks = new Map();
  }

  register(name, callback, options = {}) {
    const { priority = 0, once = false } = options;
    if (!this.hooks.has(name)) this.hooks.set(name, []);
    const list = this.hooks.get(name);
    list.push({ callback, priority, once });
    list.sort((a, b) => b.priority - a.priority);
    return this;
  }

  on(name, callback, options = {}) {
    return this.register(name, callback, options);
  }

  off(name, callback) {
    const list = this.hooks.get(name);
    if (!list) return this;
    const idx = list.findIndex(h => h.callback === callback);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.hooks.delete(name);
    return this;
  }

  async execute(name, data = {}, options = {}) {
    const { fallthrough = true } = options;
    const hooks = this.hooks.get(name);
    if (!hooks || hooks.length === 0) return { success: true, data };
    const errors = [];

    for (const hook of [...hooks]) {
      try {
        await hook.callback(data);
        if (hook.once) this.off(name, hook.callback);
      } catch (error) {
        log.error(`hook "${name}" error:`, { message: error.message });
        errors.push(error);
        if (!fallthrough) throw error;
      }
    }

    return { success: errors.length === 0, data, errors };
  }

  async pipe(name, data = {}) {
    const hooks = this.hooks.get(name);
    if (!hooks || hooks.length === 0) return data;

    let current = data;
    for (const hook of [...hooks]) {
      try {
        const result = await hook.callback(current);
        if (result !== undefined) current = result;
        if (hook.once) this.off(name, hook.callback);
      } catch (error) {
        log.error(`pipe hook "${name}" error:`, { message: error.message });
      }
    }
    return current;
  }

  listeners(name) {
    return this.hooks.has(name) ? Array.from(this.hooks.get(name)) : [];
  }

  stats() {
    const result = {};
    for (const [name, list] of this.hooks.entries()) {
      result[name] = list.length;
    }
    return result;
  }

  clear() {
    this.hooks.clear();
  }
}

export const hookEngine = new HookEngine();

export async function executeHook(name, data = {}, options = {}) {
  return hookEngine.execute(name, data, options);
}

export async function pipeHook(name, data = {}) {
  return hookEngine.pipe(name, data);
}

function registerHookDebug() {
  if (globalThis.__debug__) {
    globalThis.__debug__.expose('hooks', {
      stats: () => hookEngine.stats(),
      engine: hookEngine,
    }, 'HookEngine registry');
  }
}

// Auto-register when __debug__ becomes available
if (globalThis.__debug__) {
  registerHookDebug();
} else {
  const origDesc = Object.getOwnPropertyDescriptor(globalThis, '__debug__');
  Object.defineProperty(globalThis, '__debug__', {
    configurable: true,
    set(v) {
      Object.defineProperty(globalThis, '__debug__', { value: v, configurable: true, writable: true });
      registerHookDebug();
      if (origDesc?.set) origDesc.set.call(this, v);
    },
    get() { return undefined; }
  });
}

export default hookEngine;
