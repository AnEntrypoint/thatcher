/**
 * Thatcher SDK - Configuration-Driven Application Framework
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Forward-declare so we can set later
let _configEngine = null;
let _databaseInitialized = false;
let _pluginsLoaded = false;
let _server = null;
let _hotReloadWatchers = [];

/**
 * Resolve a path relative to this package's src directory as an import URL
 * @param {string} relative - Path like './src/lib/database-core.js'
 * @returns {string} file:// URL
 */
function resolveModule(relative) {
  const abs = path.resolve(__dirname, relative);
  return pathToFileURL(abs).href;
}

/**
 * Thatcher class - main API
 */
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

  /**
   * Initialize the system (config, DB, plugins)
   */
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

  /**
   * Load master configuration
   */
  async loadConfig() {
    const { config } = this.options;
    let masterConfig;

    if (typeof config === 'string') {
      const configPath = path.resolve(process.cwd(), config);
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      const content = fs.readFileSync(configPath, 'utf-8');
      const { default: yaml } = await import('js-yaml');
      masterConfig = yaml.load(content);
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
          const { default: yaml } = await import('js-yaml');
          masterConfig = yaml.load(content);
          break;
        }
      }
    }

    if (!masterConfig) {
      throw new Error('No configuration provided. Supply config path or object.');
    }

    // Init config engine
    const { ConfigGeneratorEngine } = await import(resolveModule('./src/lib/config-generator-engine.js'));
    _configEngine = new ConfigGeneratorEngine(masterConfig);

    // Debug exposure
    if (globalThis.__debug__) {
      globalThis.__debug__.expose('configEngine', _configEngine, 'Config Engine');
    }

    this.config = masterConfig;
  }

  /**
   * Initialize database with schema from config
   */
  async initDatabase() {
    if (_databaseInitialized) return;
    const { migrate } = await import(resolveModule('./lib/database-core.js'));
    migrate(_configEngine);
    const { getDatabase } = await import(resolveModule('./lib/database-core.js'));
    getDatabase(); // prime the connection
    _databaseInitialized = true;
  }

  /**
   * Load .plugin.js files
   */
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
            console.error(`[plugins] Failed to load ${file}:`, e.message);
          }
        }
      }
    }

    _pluginsLoaded = true;
  }

  /**
   * Setup hot reload watchers
   */
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
            console.log(`[HotReload] ${filename} changed`);
            this.invalidateCache();
          }
        });
        _hotReloadWatchers.push(watcher);
      } catch (err) {
        console.warn(`[HotReload] Failed to watch ${dir}:`, err.message);
      }
    }
  }

  invalidateCache() {
    if (_configEngine) {
      _configEngine.invalidateCache();
    }
  }

  /**
   * Start HTTP server
   */
  async startServer(opts = {}) {
    if (!this.initialized) throw new Error('Call init() first');

    const port = opts.port || this.options.server.port;
    const host = opts.host || this.options.server.host;

    const { createServer } = await import(resolveModule('./src/server/server.js'));
    _server = createServer({
      thatcher: this,
      config: this.config,
      configEngine: _configEngine,
      port,
      host,
    });

    return new Promise((resolve) => {
      _server.listen(port, host, () => {
        console.log(`\n▲ Thatcher Server\n- Local: http://localhost:${port}\n✓ Ready\n`);
        resolve(_server);
      });
    });
  }

  /**
   * Stop server
   */
  async stop() {
    if (_server) {
      _server.close();
      _server = null;
    }
    for (const w of _hotReloadWatchers) w.close();
    _hotReloadWatchers = [];
  }

  /**
   * Get config engine
   */
  getConfigEngine() {
    return _configEngine;
  }

  /**
   * Get entity spec
   */
  getEntitySpec(name) {
    return _configEngine?.generateEntitySpec(name);
  }

  /**
   * List all entities
   */
  getAllEntities() {
    return _configEngine?.getAllEntities() || [];
  }

  /**
   * Get workflow definition
   */
  getWorkflow(name) {
    return _configEngine?.getWorkflow(name);
  }

  // === CRUD operations ===

  async list(entity, where = {}, opts = {}) {
    const { list } = await import(resolveModule('./src/lib/query-engine.js'));
    return list(entity, where, opts);
  }

  async get(entity, id) {
    const { get } = await import(resolveModule('./src/lib/query-engine.js'));
    return get(entity, id);
  }

  async create(entity, data, user) {
    const { create } = await import(resolveModule('./src/lib/query-engine-write.js'));
    return create(entity, data, user);
  }

  async update(entity, id, data, user) {
    const { update } = await import(resolveModule('./src/lib/query-engine-write.js'));
    return update(entity, id, data, user);
  }

  async delete(entity, id) {
    const { remove } = await import(resolveModule('./src/lib/query-engine-write.js'));
    return remove(entity, id);
  }

  async search(entity, query, where = {}, opts = {}) {
    const { search } = await import(resolveModule('./src/lib/query-engine.js'));
    return search(entity, query, where, opts);
  }

  // === Workflow ===

  async transition(entityType, entityId, workflowName, toState, user, reason = '') {
    const { transition } = await import(resolveModule('./src/lib/workflow-engine.js'));
    return transition(entityType, entityId, workflowName, toState, user, reason);
  }

  async getAvailableTransitions(workflowName, currentState, user, record = null) {
    const { getAvailableTransitions } = await import(resolveModule('./src/lib/workflow-engine.js'));
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

  async withTransaction(callback) {
    const { withTransaction } = await import(resolveModule('./lib/query-engine.js'));
    return withTransaction(callback);
  }
}

/**
 * Create thatcher instance
 */
export function createThatcher(options) {
  return new Thatcher(options);
}

/**
 * Quick-start helper
 */
export async function startThatcher(options = {}) {
  const t = new Thatcher(options);
  await t.init();
  await t.startServer();
  return t;
}

export default Thatcher;
