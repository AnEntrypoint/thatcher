/**
 * Thatcher HTTP Server - Simplified generic CRUD router
 * Provides out-of-the-box API for all entities
 */

import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import * as thatcherLib from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(options) {
  const { thatcher, config, configEngine, port, host } = options;
  const PORT = port || 3000;
  const SERVER_START = Date.now();

  let systemInitialized = false;
  const moduleCache = new Map();

  // Debug registry
  globalThis.__debug__ = globalThis.__debug__ || {};
  globalThis.__debug__.moduleCache = { get size() { return moduleCache.size; }, entries: () => [...moduleCache.keys()] };
  globalThis.__debug__.activeRequests = { count: 0 };
  globalThis.__debug__.hooks = null;
  globalThis.__debug__.serverStart = SERVER_START;
  globalThis.__debug__.uptime = () => Date.now() - SERVER_START;

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
    const t0 = Date.now();
    globalThis.__debug__.activeRequests.count++;

    try {
      // Initialize on first request
      if (!systemInitialized) {
        const { loadPlugins } = await load(path.join(__dirname, '../plugins/index.js'));
        await loadPlugins(configEngine);
        systemInitialized = true;
        console.log('[Server] System ready');
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
        return await handleGenericCrud(req, res, entity, id, action, thatcher);
      }

      // Static file serving (simplified)
      if (serveStaticFile(pathname, req, res, load)) {
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
          console.error('[Page]', e.message);
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));

    } catch (err) {
      console.error('[Server]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      globalThis.__debug__.activeRequests.count--;
    }
  });

  return server;
}

/**
 * Serve static file if exists
 */
async function serveStaticFile(pathname, req, res, load) {
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
  } catch {}
  return false;
}

/**
 * File exists check
 */
function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Send response appropriately
 */
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

/**
 * Generic CRUD handler
 */
async function handleGenericCrud(req, res, entity, id, action, thatcher) {
  // Simple auth: get from cookie or header
  let user = null;
  // In a real implementation, we'd decode session token
  // For now, default to system user for testing
  user = { id: 'system', role: 'admin' };

  const { configEngine } = thatcher;
  let spec;
  try {
    spec = configEngine.generateEntitySpec(entity);
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
    console.error('[API]', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Read request body
 */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(data);
      }
    });
    req.on('error', reject);
  });
}
