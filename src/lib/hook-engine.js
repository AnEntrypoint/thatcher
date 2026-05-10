/**
 * Hook Engine - Event system for plugins and lifecycle hooks
 * Fires events like 'create:entity:after', 'update:entity:before', etc.
 */

export class HookEngine {
  constructor() {
    this.hooks = new Map();
  }

  /**
   * Register a hook handler
   * @param {string} name - Event name
   * @param {Function} callback - Handler function
   * @param {object} options - { priority, once }
   */
  register(name, callback, options = {}) {
    const { priority = 0, once = false } = options;
    if (!this.hooks.has(name)) this.hooks.set(name, []);
    const list = this.hooks.get(name);
    list.push({ callback, priority, once });
    list.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Alias for register
   */
  on(name, callback, options = {}) {
    return this.register(name, callback, options);
  }

  /**
   * Unregister a hook handler
   */
  off(name, callback) {
    const list = this.hooks.get(name);
    if (!list) return this;
    const idx = list.findIndex(h => h.callback === callback);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.hooks.delete(name);
    return this;
  }

  /**
   * Execute all handlers for an event (fire-and-forget style)
   * @param {string} name
   * @param {object} data
   * @param {object} options - { fallthrough: true to continue on error }
   * @returns {Promise<{success: boolean, data, errors}>}
   */
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
        console.error(`[HookEngine] Hook "${name}" error:`, error.message);
        errors.push(error);
        if (!fallthrough) throw error;
      }
    }

    return { success: errors.length === 0, data, errors };
  }

  /**
   * Pipe data through transformation hooks
   * @param {string} name
   * @param {any} data
   * @returns {Promise<any>}
   */
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
        console.error(`[HookEngine] Pipe hook "${name}" error:`, error.message);
      }
    }
    return current;
  }

  /**
   * Get all listeners for an event
   * @param {string} name
   * @returns {Array}
   */
  listeners(name) {
    return this.hooks.has(name) ? Array.from(this.hooks.get(name)) : [];
  }

  /**
   * Get statistics
   * @returns {object} Map of event -> count
   */
  stats() {
    const result = {};
    for (const [name, list] of this.hooks.entries()) {
      result[name] = list.length;
    }
    return result;
  }

  /**
   * Clear all hooks
   */
  clear() {
    this.hooks.clear();
  }
}

// Global singleton
export const hookEngine = new HookEngine();

/**
 * Execute hook (convenience function)
 */
export async function executeHook(name, data = {}, options = {}) {
  return hookEngine.execute(name, data, options);
}

/**
 * Pipe through hooks
 */
export async function pipeHook(name, data = {}) {
  return hookEngine.pipe(name, data);
}

/**
 * Register hook debug exposure
 */
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
