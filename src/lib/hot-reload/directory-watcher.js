import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export class DirectoryWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rootDir = options.rootDir || path.join(process.cwd(), 'src');
    this.debounceMs = options.debounceMs || 100;
    this.extensions = options.extensions || ['.js', '.jsx', '.ts', '.tsx'];
    this.exclude = options.exclude || ['node_modules', '.git', 'migration'];
    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.running = false;
    this.stats = { totalWatched: 0, eventsReceived: 0, invalidations: 0 };
  }

  start() {
    if (this.running) return this;
    this.running = true;
    this._watchRecursive(this.rootDir);
    this.emit('started', { directories: this.watchers.size });
    return this;
  }

  stop() {
    this.running = false;
    for (const [, watcher] of this.watchers.entries()) {
      try { watcher.close(); } catch (_) {}
    }
    this.watchers.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.emit('stopped');
    return this;
  }

  _watchRecursive(dir) {
    if (!this.running) return;
    if (!fs.existsSync(dir)) return;

    try {
      const watcher = fs.watch(dir, { persistent: false }, (eventType, filename) => {
        if (!filename) return;
        this._handleChange(dir, filename, eventType);
      });
      watcher.on('error', (err) => {
        this.emit('watchError', { dir, error: err });
        this.watchers.delete(dir);
      });
      this.watchers.set(dir, watcher);
      this.stats.totalWatched++;
    } catch (err) {
      this.emit('watchError', { dir, error: err });
      return;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (this.exclude.includes(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        this._watchRecursive(path.join(dir, entry.name));
      }
    } catch (_) {}
  }

  _handleChange(dir, filename, eventType) {
    const ext = path.extname(filename);
    if (!this.extensions.includes(ext)) return;
    this.stats.eventsReceived++;
    const fullPath = path.join(dir, filename);
    if (this.debounceTimers.has(fullPath)) {
      clearTimeout(this.debounceTimers.get(fullPath));
    }
    this.debounceTimers.set(fullPath, setTimeout(() => {
      this.debounceTimers.delete(fullPath);
      this.stats.invalidations++;
      this.emit('change', { path: fullPath, dir, filename, eventType, timestamp: Date.now() });
    }, this.debounceMs));
  }

  getStats() {
    return {
      running: this.running,
      directoriesWatched: this.watchers.size,
      pendingDebounce: this.debounceTimers.size,
      ...this.stats
    };
  }
}

export const globalWatcher = new DirectoryWatcher();
