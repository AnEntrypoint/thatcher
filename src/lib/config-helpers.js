/**
 * Configuration Helpers - Utilities for config processing
 * LRUCache, deep cloning, freezing, recursive resolution
 */

/**
 * LRU Cache implementation
 */
export class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * Deep freeze object (immutable)
 */
export function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;

  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (obj[prop] && typeof obj[prop] === 'object' && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);

  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

/**
 * Recursively resolve string template references in config
 * Replaces ${ref.path} with value from config
 */
export function recursiveResolve(value, config) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, path) => {
      const segments = path.split('.');
      let current = config;
      for (const seg of segments) {
        if (current && typeof current === 'object' && seg in current) {
          current = current[seg];
        } else {
          return _; // Keep original if not found
        }
      }
      return typeof current === 'undefined' ? _ : current;
    });
  }

  if (Array.isArray(value)) {
    return value.map(item => recursiveResolve(item, config));
  }

  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = recursiveResolve(v, config);
    }
    return resolved;
  }

  return value;
}

/**
 * Merge objects deeply
 */
export function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
