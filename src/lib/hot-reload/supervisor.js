import { EventEmitter } from 'events';

export class Supervisor extends EventEmitter {
  constructor(name, workerFn, options = {}) {
    super();
    this.name = name;
    this.workerFn = workerFn;
    this.options = {
      maxRestarts: options.maxRestarts || 5,
      restartWindow: options.restartWindow || 60000,
      backoffMs: options.backoffMs || 1000,
      maxBackoffMs: options.maxBackoffMs || 30000,
      onError: options.onError || null,
      ...options
    };

    this.worker = null;
    this.restarts = [];
    this.currentBackoff = this.options.backoffMs;
    this.running = false;
    this.stopping = false;

    if (this.listenerCount('error') === 0) {
      this.on('error', (data) => {
        console.error(`[Supervisor:${this.name}] Worker error:`, data.error?.message || data.error);
      });
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    await this._startWorker();
  }

  async stop() {
    this.stopping = true;
    this.running = false;
    if (this.worker && typeof this.worker.stop === 'function') {
      await this.worker.stop();
    }
    this.worker = null;
  }

  async restart() {
    await this.stop();
    this.restarts = [];
    this.currentBackoff = this.options.backoffMs;
    await this.start();
  }

  async _startWorker() {
    if (!this.running || this.stopping) return;

    try {
      this.worker = await this.workerFn();
      this.emit('started', this.name);
      this.currentBackoff = this.options.backoffMs;

      if (this.worker && typeof this.worker.on === 'function') {
        this.worker.on('error', (err) => this._handleError(err));
      }
    } catch (err) {
      await this._handleError(err);
    }
  }

  async _handleError(err) {
    this.emit('error', { name: this.name, error: err });

    if (this.options.onError) {
      try {
        await this.options.onError(err);
      } catch (handlerErr) {
        console.error(`[Supervisor:${this.name}] Error handler failed:`, handlerErr);
      }
    }

    if (!this.running || this.stopping) return;

    const now = Date.now();
    this.restarts = this.restarts.filter(t => now - t < this.options.restartWindow);
    this.restarts.push(now);

    if (this.restarts.length > this.options.maxRestarts) {
      console.error(`[Supervisor:${this.name}] Max restarts exceeded. Giving up.`);
      this.emit('giveup', this.name);
      this.running = false;
      return;
    }

    await new Promise(resolve => setTimeout(resolve, this.currentBackoff));
    this.currentBackoff = Math.min(this.currentBackoff * 2, this.options.maxBackoffMs);

    await this._startWorker();
  }

  getStats() {
    return {
      name: this.name,
      running: this.running,
      stopping: this.stopping,
      restarts: this.restarts.length,
      maxRestarts: this.options.maxRestarts,
      currentBackoff: this.currentBackoff,
      hasWorker: !!this.worker
    };
  }
}

export class SupervisorTree extends EventEmitter {
  constructor() {
    super();
    this.supervisors = new Map();
  }

  register(name, workerFn, options) {
    const supervisor = new Supervisor(name, workerFn, options);
    supervisor.on('error', (data) => this.emit('childError', data));
    supervisor.on('giveup', (name) => this.emit('childGiveup', name));
    this.supervisors.set(name, supervisor);
    return supervisor;
  }

  async start(name) {
    const supervisor = this.supervisors.get(name);
    if (!supervisor) throw new Error(`Supervisor ${name} not found`);
    await supervisor.start();
  }

  async stop(name) {
    const supervisor = this.supervisors.get(name);
    if (!supervisor) throw new Error(`Supervisor ${name} not found`);
    await supervisor.stop();
  }

  async startAll() {
    await Promise.all([...this.supervisors.values()].map(s => s.start()));
  }

  async stopAll() {
    await Promise.all([...this.supervisors.values()].map(s => s.stop()));
  }

  async restart(name) {
    const supervisor = this.supervisors.get(name);
    if (!supervisor) throw new Error(`Supervisor ${name} not found`);
    await supervisor.restart();
  }

  getStats() {
    const stats = {};
    for (const [name, supervisor] of this.supervisors.entries()) {
      stats[name] = supervisor.getStats();
    }
    return stats;
  }
}

export const globalTree = new SupervisorTree();
