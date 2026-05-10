import path from 'path';
import { createRequire } from 'module';
import { DirectoryWatcher } from './directory-watcher.js';

const _require = createRequire(import.meta.url);

export class CacheInvalidator {
  constructor() {
    this.invalidated = new Set();
    this.watcher = null;
    this.onInvalidate = null;
  }

  startWatching(rootDir) {
    if (this.watcher) return this;
    this.watcher = new DirectoryWatcher({ rootDir });
    this.watcher.on('change', (event) => {
      const count = this.invalidateByFilePath(event.path);
      if (count > 0 && this.onInvalidate) {
        this.onInvalidate(event.path, count);
      }
    });
    this.watcher.start();
    return this;
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
    return this;
  }

  invalidateByFilePath(filePath) {
    const normalized = path.resolve(filePath);
    let count = 0;
    if (typeof _require.cache === 'undefined') return count;
    for (const modulePath of Object.keys(_require.cache)) {
      if (modulePath === normalized || modulePath.startsWith(normalized)) {
        this._invalidateModule(modulePath);
        this.invalidated.add(modulePath);
        count++;
      }
    }
    return count;
  }

  invalidate(modulePath) {
    try {
      const resolved = _require.resolve(modulePath);
      if (_require.cache[resolved]) {
        this._invalidateModule(resolved);
        this.invalidated.add(resolved);
        return true;
      }
    } catch (_) {}
    return false;
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    let count = 0;
    if (typeof _require.cache === 'undefined') return count;
    for (const modulePath of Object.keys(_require.cache)) {
      if (regex.test(modulePath)) {
        this._invalidateModule(modulePath);
        this.invalidated.add(modulePath);
        count++;
      }
    }
    return count;
  }

  invalidateAll(excludePattern = /node_modules/) {
    let count = 0;
    if (typeof _require.cache === 'undefined') return count;
    for (const modulePath of Object.keys(_require.cache)) {
      if (excludePattern && excludePattern.test(modulePath)) continue;
      this._invalidateModule(modulePath);
      this.invalidated.add(modulePath);
      count++;
    }
    return count;
  }

  _invalidateModule(modulePath) {
    if (typeof _require.cache === 'undefined') return;
    const mod = _require.cache[modulePath];
    if (!mod) return;
    if (mod.parent) {
      const index = mod.parent.children.indexOf(mod);
      if (index !== -1) mod.parent.children.splice(index, 1);
    }
    for (const child of mod.children || []) {
      this._invalidateModule(child.id);
    }
    delete _require.cache[modulePath];
  }

  getStats() {
    return {
      totalCached: typeof _require.cache !== 'undefined' ? Object.keys(_require.cache).length : 0,
      invalidated: this.invalidated.size,
      watching: !!this.watcher,
      watcherStats: this.watcher ? this.watcher.getStats() : null
    };
  }

  clearStats() {
    this.invalidated.clear();
  }
}

export const globalInvalidator = new CacheInvalidator();
