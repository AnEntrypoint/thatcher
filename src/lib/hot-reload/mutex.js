export class Mutex {
  constructor(name = 'anonymous') {
    this.name = name;
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next(() => this.release());
    } else {
      this.locked = false;
    }
  }

  async runExclusive(fn) {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  isLocked() {
    return this.locked;
  }

  getQueueSize() {
    return this.queue.length;
  }
}

export class MutexManager {
  constructor() {
    this.mutexes = new Map();
  }

  get(key) {
    if (!this.mutexes.has(key)) {
      this.mutexes.set(key, new Mutex(key));
    }
    return this.mutexes.get(key);
  }

  async lock(key, fn) {
    const mutex = this.get(key);
    return mutex.runExclusive(fn);
  }

  getStats() {
    const stats = {};
    for (const [key, mutex] of this.mutexes.entries()) {
      stats[key] = {
        locked: mutex.isLocked(),
        queueSize: mutex.getQueueSize()
      };
    }
    return stats;
  }
}

export const globalManager = new MutexManager();
