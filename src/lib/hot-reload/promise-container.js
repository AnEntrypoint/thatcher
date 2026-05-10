import { EventEmitter } from 'events';

export class PromiseContainer extends EventEmitter {
  constructor() {
    super();
    this.activePromises = new Set();
    this.rejectionHandlers = new Map();
    this.globalHandler = null;
  }

  wrap(promise, context = 'anonymous') {
    const tracked = promise
      .catch(err => {
        this.emit('rejection', { error: err, context });
        if (this.globalHandler) {
          this.globalHandler(err, context);
        }
        return Promise.reject(err);
      })
      .finally(() => {
        this.activePromises.delete(tracked);
      });

    this.activePromises.add(tracked);
    return tracked;
  }

  setGlobalHandler(handler) {
    this.globalHandler = handler;
  }

  async drainAll(timeout = 5000) {
    if (this.activePromises.size === 0) return;

    const drainPromise = Promise.allSettled([...this.activePromises]);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Drain timeout')), timeout)
    );

    try {
      await Promise.race([drainPromise, timeoutPromise]);
    } catch (err) {
      console.warn(`Promise drain timeout: ${this.activePromises.size} promises still active`);
    }
  }

  getStats() {
    return {
      active: this.activePromises.size,
      hasGlobalHandler: !!this.globalHandler
    };
  }
}

export const globalContainer = new PromiseContainer();

globalContainer.setGlobalHandler((err, context) => {
  console.error(`[PromiseContainer] Unhandled rejection in ${context}:`, err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Promise Rejection:', reason);
  globalContainer.emit('processRejection', { reason, promise });
});

export const contain = globalContainer.wrap.bind(globalContainer);
