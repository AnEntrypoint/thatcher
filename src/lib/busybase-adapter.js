import { createLogger } from './logger.js';
import { hookEngine } from './hook-engine.js';

const logger = createLogger('[BusyBase]');

let _bbInstance = null;
let _bbMode = null;
let _bbConfig = null;
let _realtimeChannels = new Map();

export class BusyBaseAdapter {
  constructor(config = {}) {
    this.config = {
      mode: config.mode || 'embedded',
      url: config.url || 'http://localhost:54321',
      project: config.project || 'local',
      dir: config.dir || 'busybase_data',
      hooks: config.hooks !== false,
      ...config,
    };
    this.initialized = false;
    this._client = null;
    this._embedded = null;
  }

  async init() {
    if (this.initialized) return this;

    if (this.config.mode === 'embedded') {
      const { createEmbedded } = await import('busybase/embedded');
      this._embedded = await createEmbedded({ dir: this.config.dir });
      this._client = this._embedded;
      logger.info('Embedded mode initialized', { dir: this.config.dir });
    } else {
      const { default: BB, createClient } = await import('busybase');
      this._client = BB(this.config.url, this.config.project);
      logger.info('Remote mode initialized', { url: this.config.url });
    }

    if (this.config.hooks) {
      this._registerBusyBaseHooks();
    }

    this.initialized = true;
    _bbInstance = this;
    _bbMode = this.config.mode;
    _bbConfig = this.config;

    if (globalThis.__debug__) {
      globalThis.__debug__.expose('busybase', {
        mode: () => _bbMode,
        config: () => _bbConfig,
        client: () => this._client,
        channels: () => Array.from(_realtimeChannels.keys()),
        stats: () => this.getStats(),
      }, 'BusyBase Adapter');
    }

    return this;
  }

  _registerBusyBaseHooks() {
    const hookMap = {
      beforeInsert: 'beforeInsert',
      afterInsert: 'afterInsert',
      beforeUpdate: 'beforeUpdate',
      afterUpdate: 'afterUpdate',
      beforeDelete: 'beforeDelete',
      afterDelete: 'afterDelete',
      beforeSelect: 'beforeSelect',
      afterSelect: 'afterSelect',
    };

    for (const [bbHook, thEvent] of Object.entries(hookMap)) {
      if (globalThis.__busybase_hooks__) {
        globalThis.__busybase_hooks__[bbHook] = async (table, data, ...rest) => {
          const context = { table, data, ...rest };
          await hookEngine.execute(`busybase:${thEvent}`, context);
          return context.data;
        };
      }
    }
  }

  async subscribe(table, callback, event = '*') {
    if (this.config.mode === 'embedded') {
      logger.warn('Realtime subscriptions not supported in embedded mode');
      return () => {};
    }

    const channelName = `${table}-${event}-${Date.now()}`;
    const channel = this._client.channel(channelName)
      .on('postgres_changes', { event, schema: 'public', table }, (payload) => {
        callback(payload);
      })
      .subscribe((status) => {
        logger.info('Channel subscription', { table, event, status });
      });

    _realtimeChannels.set(channelName, { channel, table, event, callback });

    return () => {
      channel.unsubscribe();
      _realtimeChannels.delete(channelName);
    };
  }

  async unsubscribeAll() {
    for (const [name, { channel }] of _realtimeChannels.entries()) {
      channel.unsubscribe();
    }
    _realtimeChannels.clear();
    if (this._client?.removeAllChannels) {
      this._client.removeAllChannels();
    }
  }

  getClient() {
    return this._client;
  }

  getStats() {
    return {
      mode: _bbMode,
      channels: _realtimeChannels.size,
      initialized: this.initialized,
    };
  }

  async close() {
    await this.unsubscribeAll();
    _bbInstance = null;
    _bbMode = null;
    _bbConfig = null;
    this.initialized = false;
  }
}

export async function createBusyBaseAdapter(config = {}) {
  const adapter = new BusyBaseAdapter(config);
  await adapter.init();
  return adapter;
}

export function getBusyBaseAdapter() {
  return _bbInstance;
}

export function getBusyBaseClient() {
  return _bbInstance?._client;
}

export function isBusyBaseAvailable() {
  return _bbInstance?.initialized === true;
}

export default BusyBaseAdapter;