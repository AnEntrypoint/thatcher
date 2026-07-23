import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createLogger } from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = createLogger('[Thatcher]');

// Forward-declare so we can set later
let _configEngine = null;
let _databaseInitialized = false;
let _pluginsLoaded = false;
let _server = null;
let _hotReloadWatchers = [];

function resolveModule(relative) {
  const abs = path.resolve(__dirname, relative);
  return pathToFileURL(abs).href;
}

// busybase stores data in a directory. Callers pass `databasePath` which may be
// either a directory or a path ending in a db filename (.db/.sqlite); reduce the
// latter to its containing directory.
function databasePathToDir(p) {
  return /\.(db|sqlite|sqlite3)$/i.test(p) ? path.dirname(p) : p;
}

export class Thatcher {
  constructor(options = {}) {
    this.options = this.normalizeOptions(options);
    this.config = null;
    this.initialized = false;
    this.started = false;
  }

  normalizeOptions(options) {
    return {
      config: options.config || null,
      databasePath: options.databasePath || path.resolve(process.cwd(), 'data', 'app.db'),
      env: options.env || {},
      plugins: options.plugins || [],
      server: {
        port: options.server?.port || parseInt(process.env.PORT || '3000', 10),
        host: options.server?.host || '0.0.0.0',
        hotReload: options.server?.hotReload !== false,
      },
      ui: options.ui !== false,
    };
  }

  async init() {
    if (this.initialized) return this;

    // Apply env overrides
    Object.assign(process.env, this.options.env);

    // Load configuration
    await this.loadConfig();

    // Initialize database
    await this.initDatabase();

    // Load plugins
    await this.loadPlugins();

    // Hot reload
    if (this.options.server.hotReload) {
      this.setupHotReload();
    }

    this.initialized = true;
    return this;
  }

  async loadConfig() {
    const { config } = this.options;
    let masterConfig;

    if (typeof config === 'string') {
      const configPath = path.resolve(process.cwd(), config);
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      const content = fs.readFileSync(configPath, 'utf-8');
      const { load: yamlLoad } = await import('js-yaml');
      masterConfig = yamlLoad(content);
    } else if (typeof config === 'object') {
      masterConfig = config;
    } else {
      // Auto-discover
      const defaultPaths = [
        path.resolve(process.cwd(), 'master-config.yml'),
        path.resolve(process.cwd(), 'thatcher.config.yml'),
      ];
      for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
          this.options.config = p;
          const content = fs.readFileSync(p, 'utf-8');
          const { load: yamlLoad } = await import('js-yaml');
          masterConfig = yamlLoad(content);
          break;
        }
      }
    }

    if (!masterConfig) {
      throw new Error('No configuration provided. Supply config path or object.');
    }

    // Init config engine AND set the module-level singleton that getConfigEngineSync()
    // returns. The server, plugin loader, and generateEntitySpec all read the singleton
    // via getConfigEngineSync(), so a locally-newed engine alone leaves them uninitialized.
    const engineMod = await import(resolveModule('./lib/config-generator-engine.js'));
    const { ConfigGeneratorEngine, setConfigEngine } = engineMod;
    _configEngine = new ConfigGeneratorEngine(masterConfig);
    setConfigEngine(_configEngine);
    this.configEngine = _configEngine;
    // Cross-module-instance bridge: tsx can load config-generator-engine.js as two
    // distinct module instances (static import vs resolveModule file:// URL), so the
    // module-level singleton set above is not always visible to server.js. globalThis
    // is the one registry both instances share.
    globalThis.__thatcherConfigEngine = _configEngine;

    // Debug exposure
    if (globalThis.__debug__) {
      globalThis.__debug__.expose('configEngine', _configEngine, 'Config Engine');
    }

    this.config = masterConfig;
  }

  async initDatabase() {
    if (_databaseInitialized) return;
    const { createEmbedded } = await import('busybase/embedded');
    // Honour the caller's chosen location. `databasePath` is the documented
    // option; busybase wants a directory, so a value that looks like a db file
    // is reduced to its dirname. `dataDir` and BUSYBASE_DIR remain fallbacks.
    const dir = this.options.dataDir
      || (this.options.databasePath ? databasePathToDir(this.options.databasePath) : null)
      || process.env.BUSYBASE_DIR
      || 'busybase_data';
    const client = await createEmbedded({ dir });

    const store = await import(resolveModule('./lib/busybase/store.js'));
    store.setBusyBaseClient(client);
    const audit = await import(resolveModule('./lib/busybase/audit.js'));
    audit.setBusyBaseClient(client);

    this.busybase = client;
    globalThis.__thatcherBusyBase = client;
    if (globalThis.__debug__) {
      globalThis.__debug__.expose('datastore', { kind: () => 'busybase', dir: () => dir }, 'Data Store');
    }
    _databaseInitialized = true;
  }

  async loadPlugins() {
    if (_pluginsLoaded) return;

    // User-supplied plugins
    for (const plugin of this.options.plugins) {
      if (_configEngine && plugin.entityName) {
        _configEngine.registerPlugin(plugin.entityName, plugin);
      }
    }

    // Auto-discover in cwd/plugins and cwd/src/plugins
    const pluginDirs = [
      path.resolve(process.cwd(), 'plugins'),
      path.resolve(process.cwd(), 'src/plugins'),
    ];
    for (const dir of pluginDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.plugin.js'));
        for (const file of files) {
          try {
            const mod = await import(`file://${path.join(dir, file)}?t=${Date.now()}`);
            const plugin = mod.default || mod;
            if (plugin.entityName) {
              _configEngine.registerPlugin(plugin.entityName, plugin);
            }
          } catch (e) {
            log.error(`plugins: failed to load ${file}: ${e.message}`);
          }
        }
      }
    }

    _pluginsLoaded = true;
  }

  setupHotReload() {
    const dirs = [
      path.resolve(process.cwd(), 'config'),
      path.resolve(process.cwd(), 'api'),
      path.resolve(process.cwd(), 'ui'),
      path.resolve(process.cwd(), 'plugins'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const watcher = fs.watch(dir, { recursive: true }, (_, filename) => {
          if (filename && (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.yml'))) {
            log.info(`hot reload: ${filename} changed`);
            this.invalidateCache();
          }
        });
        _hotReloadWatchers.push(watcher);
      } catch (err) {
        log.warn(`hot reload: failed to watch ${dir}: ${err.message}`);
      }
    }
  }

  invalidateCache() {
    if (_configEngine) {
      _configEngine.invalidateCache();
    }
  }

  async startServer(opts = {}) {
    if (!this.initialized) throw new Error('Call init() first');

    const port = opts.port || this.options.server.port;
    const host = opts.host || this.options.server.host;

    const { createServer } = await import(resolveModule('./server/server.js'));
    _server = createServer({
      thatcher: this,
      config: this.config,
      configEngine: _configEngine,
      port,
      host,
    });

    return new Promise((resolve) => {
      _server.listen(port, host, () => {
        console.log(`\n> Thatcher Server\n- Local: http://localhost:${port}\n[OK] Ready\n`);
        resolve(_server);
      });
    });
  }

  async stop() {
    if (_server) {
      _server.close();
      _server = null;
    }
    for (const w of _hotReloadWatchers) w.close();
    _hotReloadWatchers = []
    // This never called the underlying database client's own close() at all
    // -- busybase's createEmbedded() now exposes a real one (busybase's own
    // embedded.ts fix), but nothing here called it, so a consumer reusing the
    // SAME database file in the same process (a fresh Thatcher instance, a
    // test harness) would silently open a SECOND native handle onto an
    // already-open file rather than genuinely replacing the first --
    // _databaseInitialized is a MODULE-level singleton (see initDatabase()'s
    // own comment / AGENTS.md's documented cwd-bound handle caveat), so it
    // must be reset here too or a subsequent initDatabase() call would
    // silently skip re-opening and keep using the now-closed client.
    // NOTE (live-witnessed, Windows): calling close() does NOT synchronously
    // release the native libsql binding's OS-level file lock while THIS
    // process keeps running -- the lock only actually clears once the owning
    // process exits. A caller needing the underlying file/directory removable
    // in the SAME still-running process (e.g. a per-run isolated-tmpdir test
    // harness) cannot rely on this call alone for that and must retry the
    // removal with backoff, or isolate each run in its own child process.
    // close() is still correct and worth calling regardless -- it prevents
    // the silent second-handle-fork above, which is a real, distinct benefit.
    if (this.busybase) {
      try { this.busybase.close?.() } catch { /* best-effort */ }
      this.busybase = null
      globalThis.__thatcherBusyBase = null
      _databaseInitialized = false
    }
  }

  getConfigEngine() {
    return _configEngine;
  }

  getEntitySpec(name) {
    return _configEngine?.generateEntitySpec(name);
  }

  getAllEntities() {
    return _configEngine?.getAllEntities() || [];
  }

  getWorkflow(name) {
    return _configEngine?.getWorkflow(name);
  }

  // === CRUD operations ===

  async list(entity, where = {}, opts = {}) {
    const { list } = await import(resolveModule('./lib/busybase/store.js'));
    return list(entity, where, opts);
  }

  async get(entity, id) {
    const { get } = await import(resolveModule('./lib/busybase/store.js'));
    return get(entity, id);
  }

  async create(entity, data, user) {
    const { create } = await import(resolveModule('./lib/busybase/store.js'));
    return create(entity, data, user);
  }

  // opts.expectedVersion: optional optimistic-concurrency guard (see
  // busybase/store.js update()) -- a caller that read the row's _version can
  // pass it here to detect (via a thrown {code:'conflict'} error) a concurrent
  // writer landing in between, instead of silently clobbering it. `user` stays
  // its own positional param (unused by the store today, kept for API
  // stability with existing callers); opts is a new, optional 5th param.
  async update(entity, id, data, user, opts = {}) {
    const { update } = await import(resolveModule('./lib/busybase/store.js'));
    return update(entity, id, data, opts);
  }

  async delete(entity, id) {
    const { remove } = await import(resolveModule('./lib/busybase/store.js'));
    return remove(entity, id);
  }

  async search(entity, query, where = {}, opts = {}) {
    const { search } = await import(resolveModule('./lib/busybase/store.js'));
    return search(entity, query, where, opts);
  }

  // === Workflow ===

  async transition(entityType, entityId, workflowName, toState, user, reason = '') {
    const { transition } = await import(resolveModule('./lib/workflow-engine.js'));
    return transition(entityType, entityId, workflowName, toState, user, reason);
  }

  async getAvailableTransitions(workflowName, currentState, user, record = null) {
    const { getAvailableTransitions } = await import(resolveModule('./lib/workflow-engine.js'));
    return getAvailableTransitions(workflowName, currentState, user, record);
  }

  // === AuthZ ===

  async can(user, spec, action) {
    const { can } = await import(resolveModule('./services/permission.service.js'));
    return can(user, spec, action);
  }

  async requirePermission(user, spec, action) {
    const { require } = await import(resolveModule('./services/permission.service.js'));
    return require(user, spec, action);
  }

  // === Hooks ===

  async executeHook(event, context) {
    const { executeHook } = await import(resolveModule('./lib/hook-engine.js'));
    return executeHook(event, context);
  }

  // === Database transaction ===

  /**
   * Non-atomic passthrough: busybase has no transaction primitive, so this simply
   * invokes the callback with NO rollback guarantee on partial failure. Callers
   * must not rely on withTransaction() for atomicity; check supportsTransactions
   * to detect this at runtime.
   */
  async withTransaction(callback) {
    return callback();
  }
}

Thatcher.prototype.supportsTransactions = false;

export function createThatcher(options) {
  return new Thatcher(options);
}

export async function startThatcher(options = {}) {
  const t = new Thatcher(options);
  await t.init();
  await t.startServer();
  return t;
}

export default Thatcher;
