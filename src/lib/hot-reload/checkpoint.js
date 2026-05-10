import fs from 'fs';
import path from 'path';

export class CheckpointManager {
  constructor(options = {}) {
    this.checkpointDir = options.checkpointDir || path.join(process.cwd(), 'data', 'checkpoints');
    this.maxCheckpoints = options.maxCheckpoints || 10;
    this.checkpoints = new Map();

    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  async save(key, state) {
    const checkpoint = { key, state, timestamp: Date.now(), version: 1 };
    this.checkpoints.set(key, checkpoint);
    const filename = this._getFilename(key);
    const filepath = path.join(this.checkpointDir, filename);

    try {
      await fs.promises.writeFile(filepath, JSON.stringify(checkpoint, null, 2), 'utf-8');
      await this._pruneOldCheckpoints(key);
      return true;
    } catch (err) {
      console.error(`[Checkpoint] Failed to save ${key}:`, err);
      return false;
    }
  }

  async load(key) {
    if (this.checkpoints.has(key)) {
      return this.checkpoints.get(key).state;
    }
    const files = await this._getCheckpointFiles(key);
    if (files.length === 0) return null;
    const latest = files[files.length - 1];
    const filepath = path.join(this.checkpointDir, latest);
    try {
      const data = await fs.promises.readFile(filepath, 'utf-8');
      const checkpoint = JSON.parse(data);
      this.checkpoints.set(key, checkpoint);
      return checkpoint.state;
    } catch (err) {
      console.error(`[Checkpoint] Failed to load ${key}:`, err);
      return null;
    }
  }

  async restore(key, defaultState = null) {
    const state = await this.load(key);
    return state !== null ? state : defaultState;
  }

  async clear(key) {
    this.checkpoints.delete(key);
    const files = await this._getCheckpointFiles(key);
    await Promise.all(files.map(f => fs.promises.unlink(path.join(this.checkpointDir, f))));
  }

  async clearAll() {
    this.checkpoints.clear();
    const files = await fs.promises.readdir(this.checkpointDir);
    await Promise.all(files.map(f => fs.promises.unlink(path.join(this.checkpointDir, f))));
  }

  _getFilename(key) {
    const safe = key.replace(/[^a-z0-9-_]/gi, '_');
    return `${safe}_${Date.now()}.json`;
  }

  async _getCheckpointFiles(key) {
    const safe = key.replace(/[^a-z0-9-_]/gi, '_');
    const prefix = `${safe}_`;
    const files = await fs.promises.readdir(this.checkpointDir);
    return files.filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort();
  }

  async _pruneOldCheckpoints(key) {
    const files = await this._getCheckpointFiles(key);
    if (files.length <= this.maxCheckpoints) return;
    const toDelete = files.slice(0, files.length - this.maxCheckpoints);
    await Promise.all(toDelete.map(f => fs.promises.unlink(path.join(this.checkpointDir, f))));
  }

  getStats() {
    return {
      inMemory: this.checkpoints.size,
      checkpointDir: this.checkpointDir,
      maxCheckpoints: this.maxCheckpoints
    };
  }
}

export const globalCheckpoint = new CheckpointManager();
