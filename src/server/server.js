import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';
import { getLucia } from '../engine.server.js';
import { requirePermission } from '../lib/auth-middleware.js';

// Request-scoped session resolution: NOT engine.server.js's getUser(), which
// reads a module-level _currentRequest global -- unsafe here since this raw
// http server handles requests concurrently and that global would let one
// in-flight request's cookie leak into another's session lookup mid-await.
// getLucia() itself holds no per-request state, so calling it directly per
// request and validating against this request's own cookie header is safe.
async function resolveRequestUser(req) {
  let lucia;
  try { lucia = getLucia(); } catch { return null; }
  const cookieHeader = req.headers?.cookie || '';
  if (!cookieHeader) return null;
  const cookieName = lucia.sessionCookieName || 'thatcher_session';
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(cookieName + '='));
  if (!match) return null;
  const sessionId = decodeURIComponent(match.split('=')[1] || '');
  if (!sessionId) return null;
  try {
    const { user, session } = await lucia.validateSession(sessionId);
    if (!user || !session) return null;
    return user;
  } catch { return null; }
}

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

  import('../lib/scheduler-engine.js').then(({ startScheduler }) => startScheduler()).catch(e => log.error(e.message));

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

        const { checkRateLimit } = await import('../lib/rate-limiter.js');
        const rateUser = await resolveRequestUser(req);
        const rateKey = rateUser ? `user:${rateUser.id}` : `ip:${req.socket?.remoteAddress || 'unknown'}`;
        const rate = checkRateLimit(rateKey);
        res.setHeader('X-RateLimit-Limit', String(rate.limit));
        res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(rate.resetMs / 1000)));
        if (!rate.allowed) {
          res.setHeader('Retry-After', String(Math.ceil(rate.resetMs / 1000)));
          res.writeHead(429);
          res.end(JSON.stringify({ error: 'Rate limit exceeded, try again later' }));
          return;
        }
        const parts = pathname.slice(5).split('/').filter(Boolean); // remove /api/

        if (parts.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Entity required' }));
          return;
        }

        const entity = parts[0];
        const id = parts[1] || null;
        const action = parts[2] || null;

        if (req.method === 'GET' && entity === 'auth' && id === 'google' && !action) {
          return await handleOAuthGoogleStart(req, res);
        }

        if (req.method === 'GET' && entity === 'auth' && id === 'google' && action === 'callback') {
          return await handleOAuthGoogleCallback(req, res);
        }

        if (req.method === 'POST' && id && action === 'transition') {
          return await handleEntityTransition(req, res, entity, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && id === 'import' && !action) {
          return await handleCsvImport(req, res, entity, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'organization' && id === 'switch' && !action) {
          return await handleSwitchOrganization(req, res, thatcher, configEngine);
        }

        if (req.method === 'GET' && entity === 'organization' && id === 'memberships' && !action) {
          return await handleListMemberships(req, res, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'workflow' && id && action === 'update') {
          return await handleUpdateWorkflow(req, res, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'permission-template' && id && action === 'update') {
          return await handleUpdatePermissionTemplate(req, res, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'webhook' && id === 'create' && !action) {
          return await handleCreateWebhook(req, res, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'webhook' && id && action === 'update') {
          return await handleUpdateWebhookRecord(req, res, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'webhook' && id && action === 'delete') {
          return await handleDeleteWebhook(req, res, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && id === 'bulk' && !action) {
          return await handleBulkOperation(req, res, entity, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'entity_template' && id === 'create' && !action) {
          return await handleCreateEntityTemplate(req, res, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'entity_template' && id && action === 'delete') {
          return await handleDeleteEntityTemplate(req, res, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'upload' && !id) {
          return await handleFileUpload(req, res, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'scheduled_job' && id === 'create' && !action) {
          return await handleCreateScheduledJob(req, res, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'scheduled_job' && id && action === 'update') {
          return await handleUpdateScheduledJob(req, res, id, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'scheduled_job' && id && action === 'delete') {
          return await handleDeleteScheduledJob(req, res, id, thatcher, configEngine);
        }

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
  if (pathname.startsWith('/uploads/')) {
    // basename strips any traversal the URL decoder let through; uploaded
    // files are served read-only, by their sanitized stored name only.
    const name = path.basename(pathname.slice('/uploads/'.length));
    const filePath = path.join(process.cwd(), 'uploads', name);
    try {
      if (await fileExists(filePath) && path.dirname(filePath) === path.join(process.cwd(), 'uploads')) {
        const content = await fs.promises.readFile(filePath);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.writeHead(200);
        res.end(content);
        return true;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') staticLog.error(`${filePath} ${err.code}`, { message: err.message });
    }
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
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  // Prefer the engine passed down from createServer options (guaranteed the
  // same instance that was initialized at startup); fall back to thatcher /
  // the module singleton only if it wasn't threaded through.
  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  let spec;
  try {
    spec = configEngine.generateEntitySpec(entity);
  } catch (e) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Entity '${entity}' not found` }));
    return;
  }

  const methodAction = { GET: 'list', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' }[req.method] || 'view';
  try {
    await requirePermission(user, spec, id && req.method === 'GET' ? 'view' : methodAction);
  } catch (e) {
    res.writeHead(e?.status || 403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e?.message || 'Forbidden' }));
    return;
  }

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
          result = await thatcher.list(entity, {}, { user });
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

const PERMISSION_ACTIONS = new Set(['list', 'view', 'create', 'edit', 'delete', 'archive', 'export', 'manage_settings']);

async function requireAuthedPartner(req, res) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return null;
  }
  const { isPartner } = await import('../ui/permissions-ui.js');
  if (!isPartner(user)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return null;
  }
  return user;
}

async function handleBulkOperation(req, res, entityName, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  let spec;
  try {
    spec = configEngine.generateEntitySpec(entityName);
  } catch (e) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Entity "${entityName}" not found` }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  const action = body?.action;
  if (!ids) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'ids array required' }));
    return;
  }

  try {
    const { runBulkOperation } = await import('../lib/bulk-operations.js');
    const result = await runBulkOperation(entityName, spec, ids, action, user);
    if (!result.ok) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: result.error }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleEntityTransition(req, res, entityName, id, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  let spec;
  try {
    spec = configEngine.generateEntitySpec(entityName);
  } catch {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Entity "${entityName}" not found` }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const workflowName = body?.workflow || spec.workflow;
  const toState = body?.toState;
  if (!workflowName || !toState) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'workflow and toState required' }));
    return;
  }

  try {
    const { requirePermission } = await import('../lib/auth-middleware.js');
    await requirePermission(user, spec, 'edit');
    const { transition } = await import('../lib/workflow-engine.js');
    // transition() itself now reads via get(...,{user}) -- the same
    // row/org-access-scoped path every other read uses -- so a caller
    // cannot drag-drop a record outside their access into a new stage.
    const updated = await transition(entityName, id, workflowName, toState, user, body?.reason || '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, data: updated }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(err.status || 400);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleCreateEntityTemplate(req, res, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const { entity, name, field_values } = body || {};
  if (!entity || typeof entity !== 'string') {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'entity required' }));
    return;
  }
  try {
    configEngine.generateEntitySpec(entity);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: `Unknown entity "${entity}"` }));
    return;
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'name required' }));
    return;
  }

  try {
    const { create } = await import('../lib/busybase/store.js');
    const record = await create('entity_template', { entity, name: name.trim(), field_values: field_values || {} }, user);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: record.id }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleDeleteEntityTemplate(req, res, templateId, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  try {
    const { remove, get } = await import('../lib/busybase/store.js');
    const existing = await get('entity_template', templateId);
    if (!existing) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Template not found' }));
      return;
    }
    await remove('entity_template', templateId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleCreateScheduledJob(req, res, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const { name, entity, action, filter, interval_minutes } = body || {};
  if (!entity || typeof entity !== 'string') {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'entity required' }));
    return;
  }
  try {
    configEngine.generateEntitySpec(entity);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: `Unknown entity "${entity}"` }));
    return;
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'name required' }));
    return;
  }
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'action.type required' }));
    return;
  }
  const intervalMinutes = Number(interval_minutes);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'interval_minutes must be a positive number' }));
    return;
  }

  try {
    const { create } = await import('../lib/busybase/store.js');
    const { now } = await import('../lib/id-helpers.js');
    const nowTs = now();
    const record = await create('scheduled_job', {
      name: name.trim(),
      entity,
      action,
      filter: filter || {},
      interval_minutes: intervalMinutes,
      last_run_at: null,
      next_run_at: nowTs,
      enabled: true,
      owner_id: user.id,
    }, user);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: record.id }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleUpdateScheduledJob(req, res, jobId, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }

  try {
    const { update, get } = await import('../lib/busybase/store.js');
    const existing = await get('scheduled_job', jobId);
    if (!existing) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Job not found' }));
      return;
    }
    const patch = {};
    if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
    if (typeof body?.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (body?.interval_minutes !== undefined) {
      const intervalMinutes = Number(body.interval_minutes);
      if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'interval_minutes must be a positive number' }));
        return;
      }
      patch.interval_minutes = intervalMinutes;
    }
    if (body?.filter !== undefined) patch.filter = body.filter;
    if (body?.action !== undefined) patch.action = body.action;
    const record = await update('scheduled_job', jobId, patch);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, data: record }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleDeleteScheduledJob(req, res, jobId, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  try {
    const { remove, get } = await import('../lib/busybase/store.js');
    const existing = await get('scheduled_job', jobId);
    if (!existing) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Job not found' }));
      return;
    }
    await remove('scheduled_job', jobId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleCreateWebhook(req, res, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const { entity, trigger, url: targetUrl } = body || {};
  if (!entity || typeof entity !== 'string') {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'entity required' }));
    return;
  }
  if (!['create', 'update', 'delete', 'transition'].includes(trigger)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'trigger must be one of create/update/delete/transition' }));
    return;
  }
  const { validateWebhookUrl } = await import('../lib/webhook-engine.js');
  const validation = await validateWebhookUrl(targetUrl || '');
  if (!validation.ok) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

  try {
    const crypto = await import('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    const { create } = await import('../lib/busybase/store.js');
    const record = await create('webhook', { entity, trigger, url: targetUrl, secret, enabled: true }, user);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: record.id }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleUpdateWebhookRecord(req, res, webhookId, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const patch = {};
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
  if (typeof body?.url === 'string') {
    const { validateWebhookUrl } = await import('../lib/webhook-engine.js');
    const validation = await validateWebhookUrl(body.url);
    if (!validation.ok) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: validation.error }));
      return;
    }
    patch.url = body.url;
  }
  if (!Object.keys(patch).length) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'nothing to update' }));
    return;
  }

  try {
    const { update, get } = await import('../lib/busybase/store.js');
    const existing = await get('webhook', webhookId);
    if (!existing) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Webhook not found' }));
      return;
    }
    await update('webhook', webhookId, patch);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: webhookId }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleDeleteWebhook(req, res, webhookId, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  try {
    const { remove, get } = await import('../lib/busybase/store.js');
    const existing = await get('webhook', webhookId);
    if (!existing) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Webhook not found' }));
      return;
    }
    await remove('webhook', webhookId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleUpdatePermissionTemplate(req, res, templateName, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }
  const { isPartner } = await import('../ui/permissions-ui.js');
  if (!isPartner(user)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  const existingTemplate = configEngine.getConfig().permission_templates?.[templateName];
  if (!existingTemplate) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Permission template "${templateName}" not found` }));
    return;
  }
  const validRoles = new Set(Object.keys(configEngine.getRoles()));

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const roles = body && typeof body.roles === 'object' && !Array.isArray(body.roles) ? body.roles : null;
  if (!roles) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'roles object required' }));
    return;
  }
  for (const [roleName, actions] of Object.entries(roles)) {
    if (!validRoles.has(roleName)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: `unknown role "${roleName}"` }));
      return;
    }
    if (!Array.isArray(actions)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: `actions for role "${roleName}" must be an array` }));
      return;
    }
    for (const a of actions) {
      if (!PERMISSION_ACTIONS.has(a)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: `unknown action "${a}" for role "${roleName}"` }));
        return;
      }
    }
  }

  try {
    configEngine.updatePermissionTemplate(templateName, roles);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, template: templateName, roleCount: Object.keys(roles).length }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleUpdateWorkflow(req, res, workflowName, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }
  const { isPartner } = await import('../ui/permissions-ui.js');
  if (!isPartner(user)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  const existingDef = configEngine.getConfig().workflows?.[workflowName];
  if (!existingDef) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Workflow "${workflowName}" not found` }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const stages = Array.isArray(body?.stages) ? body.stages : null;
  if (!stages || !stages.length) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'stages array required and must be non-empty' }));
    return;
  }
  const seenNames = new Set();
  for (const s of stages) {
    if (!s || typeof s.name !== 'string' || !s.name.trim()) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'every stage requires a non-empty name' }));
      return;
    }
    if (seenNames.has(s.name)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: `duplicate stage name "${s.name}"` }));
      return;
    }
    seenNames.add(s.name);
  }
  const validNames = new Set(stages.map(s => s.name));
  for (const s of stages) {
    for (const target of (s.forward || [])) {
      if (!validNames.has(target)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: `stage "${s.name}" has a forward transition to unknown stage "${target}"` }));
        return;
      }
    }
  }

  try {
    const updatedDef = { ...existingDef, stages };
    configEngine.updateWorkflow(workflowName, updatedDef);
    const { clearWorkflowCache } = await import('../lib/workflow-engine.js');
    clearWorkflowCache(workflowName);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, workflow: workflowName, stageCount: stages.length }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleListMemberships(req, res, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  if (!configEngine.isMultiTenancyEnabled?.()) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Multi-tenancy is not enabled' }));
    return;
  }

  try {
    const { list, get } = await import('../lib/busybase/store.js');
    const memberships = await list('user_organization', { user_id: user.id });
    const orgs = [];
    for (const m of memberships) {
      const org = await get('organization', m.organization_id);
      if (org) orgs.push({ id: org.id, name: org.name });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ organizations: orgs, active: user.organization_id || null }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleSwitchOrganization(req, res, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  if (!configEngine.isMultiTenancyEnabled?.()) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Multi-tenancy is not enabled' }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const targetOrgId = typeof body === 'object' ? body?.organization_id : null;
  if (!targetOrgId) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'organization_id required' }));
    return;
  }

  try {
    const { list, update } = await import('../lib/busybase/store.js');
    const memberships = await list('user_organization', { user_id: user.id });
    const isMember = memberships.some(m => m.organization_id === targetOrgId);
    if (!isMember) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Not a member of that organization' }));
      return;
    }
    const updated = await update('user', user.id, { organization_id: targetOrgId });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, organization_id: updated.organization_id }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleCsvImport(req, res, entity, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let configEngine = configEngineArg || thatcher?.configEngine || globalThis.__thatcherConfigEngine;
  if (!configEngine) {
    const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
    configEngine = getConfigEngineSync();
  }
  let spec;
  try {
    spec = configEngine.generateEntitySpec(entity);
  } catch (e) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Entity '${entity}' not found` }));
    return;
  }

  try {
    await requirePermission(user, spec, 'create');
  } catch (e) {
    res.writeHead(e?.status || 403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e?.message || 'Forbidden' }));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }

  const csvText = typeof body === 'string' ? body : (body?.csv || '');
  if (!csvText) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'CSV body required' }));
    return;
  }

  try {
    const { importCsv } = await import('../lib/csv-import.js');
    const result = await importCsv(entity, spec, csvText, user);
    if (!result.ok) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: result.error }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

function oauthRedirectUri(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}/api/auth/google/callback`;
}

async function handleOAuthGoogleStart(req, res) {
  const { getGoogle } = await import('../engine.server.js');
  let google;
  try {
    google = getGoogle();
  } catch (e) {
    apiLog.error(e.message);
    google = null;
  }
  if (!google) {
    res.writeHead(302, { Location: '/login?error=oauth_not_configured' });
    res.end();
    return;
  }

  const { generateState, generateCodeVerifier } = await import('arctic');
  const { createOAuthState } = await import('../lib/oauth-state-store.js');
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const stateKey = createOAuthState({ state, codeVerifier });

  const url = google.createAuthorizationURL(state, codeVerifier, ['profile', 'email']);
  url.searchParams.set('state', stateKey);

  res.writeHead(302, { Location: url.toString() });
  res.end();
}

async function handleOAuthGoogleCallback(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const stateKey = url.searchParams.get('state');

  const { consumeOAuthState } = await import('../lib/oauth-state-store.js');
  // Single-use consume: a matched key is deleted here on first read, so a
  // replayed callback URL cannot ride the same state twice, and a stateKey
  // this server never issued (or one already spent) fails the lookup outright.
  const stored = stateKey ? consumeOAuthState(stateKey) : null;
  if (!code || !stateKey || !stored) {
    res.writeHead(302, { Location: '/login?error=state_mismatch' });
    res.end();
    return;
  }

  try {
    const { getGoogle, createSession } = await import('../engine.server.js');
    const google = getGoogle();
    if (!google) throw new Error('OAuth not configured');

    const tokens = await google.validateAuthorizationCode(code, stored.codeVerifier);
    const accessToken = tokens.accessToken();

    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) throw new Error('Failed to fetch user info');
    const googleUser = await userInfoRes.json();

    // Never trust an unverified email to link/create a local account -- Google
    // returns email_verified=false for e.g. an unverified alias, and creating
    // or matching an account on that claim would let an attacker who controls
    // an unverified address impersonate a real user's account.
    if (!googleUser.email || googleUser.email_verified !== true) {
      res.writeHead(302, { Location: '/login?error=email_not_verified' });
      res.end();
      return;
    }

    const { getBy, create } = await import('../lib/busybase/store.js');
    let user = await getBy('user', 'email', googleUser.email);
    if (!user) {
      const { getConfigEngineSync } = await import('../lib/config-generator-engine.js');
      const configEngine = getConfigEngineSync();
      const roles = configEngine.getRoles();
      const defaultRole = Object.keys(roles)[0] || 'clerk';
      user = await create('user', {
        email: googleUser.email,
        name: googleUser.name || googleUser.email,
        avatar: googleUser.picture || null,
        type: 'auditor',
        role: defaultRole,
        status: 'active',
      });
    }

    const { sessionCookie } = await createSession(user.id);
    const cookieAttrs = [`Path=${sessionCookie.attributes.path || '/'}`, 'HttpOnly', `SameSite=${sessionCookie.attributes.sameSite || 'Lax'}`];
    if (sessionCookie.attributes.secure) cookieAttrs.push('Secure');
    res.writeHead(302, {
      Location: '/',
      'Set-Cookie': `${sessionCookie.name}=${sessionCookie.value}; ${cookieAttrs.join('; ')}`,
    });
    res.end();
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(302, { Location: '/login?error=oauth_failed' });
    res.end();
  }
}

const UPLOAD_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json']);
const UPLOAD_MAX_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Sanitize to a flat, extension-preserving, path-traversal-safe name: strip
// any directory component, keep only [a-zA-Z0-9._-], cap length. The stored
// filename is never the client-supplied one directly -- a random prefix
// prevents overwrite/collision and the sanitization prevents "../../etc" or
// null-byte tricks reaching fs.writeFile.
function sanitizeUploadFilename(name) {
  const base = path.basename(String(name || 'file')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'file';
  const prefix = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${base}`;
}

async function readMultipartFile(req) {
  const ct = req.headers['content-type'] || '';
  const boundaryMatch = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('Multipart boundary not found');
  const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]).trim();

  const chunks = [];
  let size = 0;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { req.destroy(); reject(new Error('Request timeout')); }, 30000);
    req.on('data', chunk => {
      size += chunk.length;
      if (size > UPLOAD_MAX_SIZE) { clearTimeout(timeout); req.destroy(); reject(new Error('File too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { clearTimeout(timeout); resolve(); });
    req.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });

  const buf = Buffer.concat(chunks);
  const boundaryBuf = Buffer.from(boundary);
  const parts = [];
  let start = buf.indexOf(boundaryBuf);
  while (start !== -1) {
    const next = buf.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (next === -1) break;
    parts.push(buf.slice(start + boundaryBuf.length, next));
    start = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerText = part.slice(0, headerEnd).toString('utf-8');
    if (!/name="file"/i.test(headerText)) continue;
    const filenameMatch = headerText.match(/filename="([^"]*)"/i);
    if (!filenameMatch || !filenameMatch[1]) continue;
    const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    const contentType = (typeMatch ? typeMatch[1] : 'application/octet-stream').trim();
    let body = part.slice(headerEnd + 4);
    if (body.slice(-2).toString() === '\r\n') body = body.slice(0, -2);
    return { filename: filenameMatch[1], contentType, buffer: body };
  }
  throw new Error('No file field found in upload');
}

async function handleFileUpload(req, res, thatcher, configEngineArg) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let file;
  try {
    file = await readMultipartFile(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
    return;
  }

  if (!UPLOAD_ALLOWED_TYPES.has(file.contentType)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: `Unsupported file type: ${file.contentType}` }));
    return;
  }
  if (file.buffer.length === 0) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Empty file' }));
    return;
  }

  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    const storedName = sanitizeUploadFilename(file.filename);
    const destPath = path.join(UPLOAD_DIR, storedName);
    // Belt-and-suspenders: confirm the resolved path is still inside UPLOAD_DIR
    // even though sanitizeUploadFilename already strips traversal sequences.
    if (path.dirname(destPath) !== UPLOAD_DIR) throw new Error('Invalid upload path');
    await fs.promises.writeFile(destPath, file.buffer);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      filename: file.filename,
      stored_name: storedName,
      content_type: file.contentType,
      size: file.buffer.length,
      url: `/uploads/${storedName}`,
      uploaded_by: user.id,
    }));
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
