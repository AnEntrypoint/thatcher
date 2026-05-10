import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, setupProcessGuards, setupHotReload, loadModule as _loadModule, setSecurityHeaders } from './src/lib/server-bootstrap.js';
import { registerGlobals, NextRequest, readBody, normalizeHeaderName } from './src/lib/next-compat.js';
import { serveStatic, html404 } from './src/lib/static-server.js';
import { resolveRoute } from './src/lib/route-resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const SERVER_START = Date.now();

loadEnv(path.join(__dirname, '.env'));
setupProcessGuards();
registerGlobals();

let systemInitialized = false;
const moduleCache = new Map();
globalThis.__reloadTs__ = Date.now();
const _debugExposed = new Map();
globalThis.__debug__ = {
  moduleCache: { get size() { return moduleCache.size; }, entries: () => [...moduleCache.keys()] },
  activeRequests: { count: 0 },
  configStats: { specCacheHits: 0, specCacheMisses: 0 },
  hooks: null,
  serverStart: SERVER_START,
  uptime: () => Date.now() - SERVER_START,
  expose(key, value, description = '') {
    _debugExposed.set(key, { value, description, exposedAt: new Date().toISOString() });
    if (!globalThis[key]) globalThis[key] = value;
    return value;
  },
  get(key) { const e = _debugExposed.get(key); return e ? e.value : undefined; },
  list() { return [..._debugExposed.entries()].map(([key, e]) => ({ key, description: e.description, exposedAt: e.exposedAt, type: typeof e.value })); },
};

setupHotReload(__dirname, moduleCache, () => { systemInitialized = false; });

const load = (p) => _loadModule(moduleCache, p);

let _recordRequest = null;
let _reqCounter = 0;
async function ensureMetrics() {
  if (!_recordRequest) {
    try { const m = await import('./src/lib/metrics-collector.js'); _recordRequest = m.recordRequest; }
    catch { _recordRequest = () => {}; }
  }
}
const genId = () => `${Date.now().toString(36)}-${(++_reqCounter).toString(36)}`;
const track = (req, code, t0) => {
  if (_recordRequest) _recordRequest(req.url.split('?')[0], req.method, Date.now() - t0, code);
  console.log(`[${req.method}] ${req.url} ${code} ${Date.now() - t0}ms rid=${req._reqId || '-'}`);
};

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  req._reqId = req.headers['x-request-id'] || genId();
  res.setHeader('X-Request-ID', req._reqId);
  setSecurityHeaders(res, process.env.NODE_ENV);
  await ensureMetrics();
  globalThis.__debug__.activeRequests.count++;

  try {
    const { setCurrentRequest } = await load(path.join(__dirname, 'src/engine.server.js'));
    setCurrentRequest(req);

    if (!systemInitialized) {
      const m = await load(path.join(__dirname, 'src/config/system-config-loader.js'));
      await m.initializeSystemConfig();
      const { loadPlugins } = await import('./src/plugins/index.js');
      const { getConfigEngineSync } = await import('./src/lib/config-generator-engine.js');
      await loadPlugins(getConfigEngineSync());
      systemInitialized = true;
      console.log('[Server] System initialized');
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const { compress, getCacheHeaders } = await load(path.join(__dirname, 'src/lib/compression.js'));

    if (serveStatic(pathname, req, res, compress, getCacheHeaders, load)) {
      track(req, res.statusCode || 200, t0); return;
    }

    if (!pathname.startsWith('/api/')) {
      try {
        if (pathname === '/test') {
          const { generateTestPage } = await load(path.join(__dirname, 'src/ui/test-page.js'));
          const html = generateTestPage();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
          res.writeHead(200); res.end(html); track(req, 200, t0); return;
        }
        if (pathname === '/login') {
          const { renderStandaloneLogin } = await load(path.join(__dirname, 'src/ui/standalone-login.js'));
          const { hasGoogleAuth } = await load(path.join(__dirname, 'src/config/env.js'));
          const html = renderStandaloneLogin(hasGoogleAuth());
          if (html) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
            res.writeHead(200); res.end(html); track(req, 200, t0); return;
          }
        }
        const { handlePage } = await load(path.join(__dirname, 'src/ui/page-handler.js'));
        const { REDIRECT } = await load(path.join(__dirname, 'src/ui/renderer.js'));
        const html = await handlePage(pathname, req, res);
        if (html === REDIRECT) { track(req, res.statusCode, t0); return; }
        if (html) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
            res.writeHead(200);
          }
          if (!res.writableEnded) res.end(html);
          track(req, 200, t0); return;
        }
      } catch (err) {
        console.error('[Page Handler] Error:', err.message);
        if (err.stack) console.error(err.stack);
        if (res.headersSent) return;
      }
    }

    if (pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const { routeFile, params, isDomain, firstPart, pathParts } = resolveRoute(__dirname, pathname, url);

      if (!fs.existsSync(routeFile)) {
        res.writeHead(404); res.end(JSON.stringify({ error: 'API route not found' }));
        track(req, 404, t0); return;
      }

      let mod = await load(routeFile);
      let handler = mod[req.method] || mod.default;

      if (!handler && isDomain) {
        const fb = path.join(__dirname, 'src/app/api/[entity]/[[...path]]/route.js');
        url.searchParams.set('domain', firstPart);
        const dp = pathParts.slice(1);
        mod = await load(fb); handler = mod[req.method] || mod.default;
        Object.assign(params, { entity: dp[0], path: dp.slice(1) });
      }

      if (!handler) {
        res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' }));
        track(req, 405, t0); return;
      }

      let body;
      try { body = await readBody(req); }
      catch { res.writeHead(413); res.end(JSON.stringify({ error: 'Request body too large' })); return; }

      try {
        const response = await handler(new NextRequest(req, body, url), { params });
        const headerObj = {};
        if (response.headers) for (const [k, v] of response.headers) headerObj[normalizeHeaderName(k)] = v;
        if (response.status >= 300 && response.status < 400) {
          res.writeHead(response.status, headerObj); res.end(); track(req, response.status, t0); return;
        }
        const ct = (headerObj['Content-Type'] || '').toLowerCase();
        const isJson = !ct || ct.includes('json');
        const isText = ct.startsWith('text/') || ct.includes('xml') || ct.includes('csv') || ct.includes('javascript') || ct.includes('css');
        let bodyOut;
        if (isJson) {
          bodyOut = JSON.stringify(await response.json());
          if (!headerObj['Content-Type']) headerObj['Content-Type'] = 'application/json; charset=utf-8';
        } else if (isText) {
          bodyOut = await response.text();
        } else {
          bodyOut = Buffer.from(await response.arrayBuffer());
        }
        headerObj['Content-Length'] = Buffer.byteLength(bodyOut).toString();
        res.writeHead(response.status, headerObj); res.end(bodyOut);
        track(req, response.status, t0);
      } catch (err) {
        console.error('[API] Handler error:', err.message || err);
        const e = JSON.stringify({ error: err.message || String(err) });
        res.writeHead(500, { 'Content-Length': Buffer.byteLength(e, 'utf-8') }); res.end(e);
        track(req, 500, t0);
      }
      return;
    }

    if (!res.headersSent) {
      const body = html404();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(body, 'utf-8'));
      res.writeHead(404); res.end(body); track(req, 404, t0);
    }
  } catch (err) {
    console.error('[Server] Error:', err);
    if (!res.headersSent) {
      const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
      const e = JSON.stringify({ error: msg });
      res.writeHead(500, { 'Content-Length': Buffer.byteLength(e, 'utf-8') }); res.end(e);
    }
    track(req, 500, t0);
  } finally {
    globalThis.__debug__.activeRequests.count--;
  }
});

server.listen(PORT, '0.0.0.0', async () => {
  try { const { validateEnv } = await import('./src/config/env.js'); validateEnv(); } catch {}
  console.log(`\n▲ Zero-Build Runtime Server\n- Local: http://localhost:${PORT}\n✓ Ready in ${Date.now() - SERVER_START}ms\n`);

  try {
    const { hookEngine } = await import('./src/lib/hook-engine.js');
    globalThis.__debug__.hooks = { stats: () => hookEngine.stats(), engine: hookEngine };
    globalThis.__hookEngine = hookEngine;
  } catch {}

  try { const { startLifecycle } = await import('./src/lib/dr-lifecycle.js'); startLifecycle(server); }
  catch (err) { console.error('[Server] DR lifecycle init failed:', err.message); }
});
