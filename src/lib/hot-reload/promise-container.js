import { EventEmitter } from 'events';

import { createLogger } from '../logger.js';

const log = createLogger('[PromiseContainer]');

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
      log.warn(`promise drain timeout: ${this.activePromises.size} promises still active`);
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
  log.error(`unhandled rejection in ${context}:`, { message: err?.message || String(err) });
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('unhandled promise rejection:', { message: reason?.message || String(reason) });
  globalContainer.emit('processRejection', { reason, promise });
});

export const contain = globalContainer.wrap.bind(globalContainer);
