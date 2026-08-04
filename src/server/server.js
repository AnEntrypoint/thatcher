import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';

const log = createLogger('[Server]');
const pageLog = createLogger('[Page]');
const staticLog = createLogger('[Static]');
const apiLog = createLogger('[API]');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(options) {
  const { thatcher, configEngine } = options;
  const SERVER_START = Date.now();

  let systemInitialized = false;
  const moduleCache = new Map();

  // Debug registry. expose/get/list MUST exist before any module that calls
  // __debug__.expose() at load time (config-generator-engine, hook-engine,
  // observability) is imported, or every request that loads them crashes.
  const _debugExposed = new Map();
  globalThis.__debug__ = globalThis.__debug__ || {};
  globalThis.__debug__.moduleCache = { get size() { return moduleCache.size; }, entries: () => [...moduleCache.keys()] };
  globalThis.__debug__.activeRequests = { count: 0 };
  globalThis.__debug__.configStats = { specCacheHits: 0, specCacheMisses: 0 };
  globalThis.__debug__.hooks = null;
  globalThis.__debug__.serverStart = SERVER_START;
  globalThis.__debug__.uptime = () => Date.now() - SERVER_START;
  globalThis.__debug__.expose = globalThis.__debug__.expose || function (key, value, description = '') {
    _debugExposed.set(key, { value, description, exposedAt: new Date().toISOString() });
    if (!globalThis[key]) globalThis[key] = value;
    return value;
  };
  globalThis.__debug__.get = globalThis.__debug__.get || function (key) { const e = _debugExposed.get(key); return e ? e.value : undefined; };
  globalThis.__debug__.list = globalThis.__debug__.list || function () { return [..._debugExposed.entries()].map(([key, e]) => ({ key, description: e.description, exposedAt: e.exposedAt, type: typeof e.value })); };

  // Load module with caching
  const load = (p) => {
    const cached = moduleCache.get(p);
    if (cached) return cached;
    return import(`file://${p}?t=${Date.now()}`).then(mod => {
      moduleCache.set(p, mod);
      return mod;
    });
  };

  const server = http.createServer(async (req, res) => {
    globalThis.__debug__.activeRequests.count++;

    try {
      // Initialize on first request
      if (!systemInitialized) {
        const { loadPlugins } = await load(path.join(__dirname, '../plugins/index.js'));
        await loadPlugins(configEngine);
        systemInitialized = true;
        log.info('System ready');
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      // API routes
      if (pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const parts = pathname.slice(5).split('/').filter(Boolean); // remove /api/

        if (parts.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Entity required' }));
          return;
        }

        const entity = parts[0];
        const id = parts[1] || null;
        const action = parts[2] || null;

        // Check if user has custom route for this
        const userRoutePath = path.join(process.cwd(), 'app/api', ...parts, 'route.js');
        const routeExists = await fileExists(userRoutePath);

        if (routeExists) {
          const mod = await load(userRoutePath);
          const handler = mod[req.method] || mod.default;
          if (handler) {
            const response = await handler(req, { params: { entity, id, action, path: parts.slice(1) }, configEngine });
            return sendResponse(res, response);
          }
        }

        // Fall back to generic CRUD
        return await handleGenericCrud(req, res, entity, id, action, thatcher, configEngine);
      }

      // Static file serving (simplified)
      if (serveStaticFile(pathname, req, res)) {
        return;
      }

      // Page routing (UI)
      if (!pathname.startsWith('/api/')) {
        try {
          const { handlePage } = await load(path.join(__dirname, '../ui/page-handler.js'));
          const html = await handlePage(pathname, req, res, configEngine, thatcher);
          if (html) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
            res.writeHead(200);
            res.end(html);
            return;
          }
        } catch (e) {
          pageLog.error(e.message);
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));

    } catch (err) {
      log.error(err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      globalThis.__debug__.activeRequests.count--;
    }
  });

  return server;
}

async function serveStaticFile(pathname, req, res) {
  if (pathname === '/' || pathname === '/index.html') {
    // Could serve SPA
    return false;
  }
  // Try to serve from public/ or static/
  const filePath = path.join(process.cwd(), 'public', pathname);
  try {
    if (await fileExists(filePath)) {
      const content = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath);
      const mime = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      }[ext] || 'text/plain';
      res.setHeader('Content-Type', mime);
      res.writeHead(200);
      res.end(content);
      return true;
    }
  } catch (err) {
    // A missing file is a normal 404; anything else (permission denied, file
    // locked) is a real problem worth surfacing rather than silently swallowing.
    if (err.code !== 'ENOENT') staticLog.error(`${filePath} ${err.code}`, { message: err.message });
  }
  return false;
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function sendResponse(res, response) {
  const headerObj = {};
  if (response.headers) {
    for (const [k, v] of response.headers) {
      headerObj[k] = v;
    }
  }

  if (response.status >= 300 && response.status < 400) {
    res.writeHead(response.status, headerObj);
    res.end();
    return;
  }

  const ct = (headerObj['Content-Type'] || '').toLowerCase();
  const isJson = !ct || ct.includes('json');
  let bodyOut;

  if (isJson) {
    bodyOut = JSON.stringify(await response.json());
    if (!headerObj['Content-Type']) headerObj['Content-Type'] = 'application/json; charset=utf-8';
  } else {
    bodyOut = await response.text();
  }

  headerObj['Content-Length'] = Buffer.byteLength(bodyOut).toString();
  res.writeHead(response.status, headerObj);
  res.end(bodyOut);
}

async function handleGenericCrud(req, res, entity, id, action, thatcher, configEngineArg) {
  // Simple auth: get from cookie or header
  let user = null;
  // In a real implementation, we'd decode session token
  // For now, default to system user for testing
  user = { id: 'system', role: 'admin' };

  // Prefer the engine passed down from createServer options (guaranteed the
  // same instance that was initialized at startup); fall back to thatcher /
  // the module singleton only if it wasn't threaded through.
  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  try {
    configEngine.generateEntitySpec(entity);
  } catch (e) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Entity '${entity}' not found` }));
    return;
  }

  // Permission check would go here via thatcher.can(user, spec, action)

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  try {
    let result;
    let status = 200;

    switch (req.method) {
      case 'GET':
        if (id) {
          result = await thatcher.get(entity, id);
          if (!result) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }
        } else {
          result = await thatcher.list(entity);
        }
        break;

      case 'POST':
        result = await thatcher.create(entity, body, user);
        status = 201;
        break;

      case 'PUT':
      case 'PATCH':
        if (!id) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'ID required' }));
          return;
        }
        result = await thatcher.update(entity, id, body, user);
        break;

      case 'DELETE':
        if (!id) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'ID required' }));
          return;
        }
        await thatcher.delete(entity, id);
        res.writeHead(204);
        res.end();
        return;

      default:
        res.writeHead(405);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB cap: an unbounded body is an OOM/DoS vector
    const timeout = setTimeout(() => { req.destroy(); reject(new Error('Request timeout')); }, 30000); // slowloris guard
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_SIZE) { clearTimeout(timeout); req.destroy(); reject(new Error('Request body too large')); return; }
      data += chunk;
    });
    req.on('end', () => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(data);
      }
    });
    req.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}
