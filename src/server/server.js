import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';
import { getLucia } from '../engine.server.js';
import { requirePermission } from '../lib/auth-middleware.js';
import { REDIRECT } from '../ui/renderer.js';

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
        // Custom entities are DB rows, not code -- they can only be loaded
        // once both the config engine AND the store are available, which is
        // exactly this first-request boundary (the engine itself must be
        // constructible with no DB dependency, per its existing contract).
        // A bad row must not crash server startup for every other entity, so
        // registration failures are logged and skipped individually.
        try {
          const { list } = await import('../lib/busybase/store.js');
          const customDefs = await list('custom_entity_def', {});
          for (const row of customDefs) {
            try { configEngine.registerCustomEntity(row); }
            catch (e) { log.error(`Failed to register custom entity "${row.name}": ${e.message}`); }
          }
        } catch (e) {
          log.error(`Failed to load custom_entity_def rows: ${e.message}`);
        }
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

        // presence/changes are meta-routes over an (entity,id) pair, not
        // themselves entities -- parts[1]/parts[2] here are the TARGET
        // entity name and record id, distinct from the entity/id/action
        // parsed above for the generic CRUD routes.
        if (req.method === 'POST' && entity === 'presence' && parts[1] && parts[2] && parts[3] === 'heartbeat') {
          return await handlePresenceHeartbeat(req, res, parts[1], parts[2]);
        }

        if (req.method === 'GET' && entity === 'presence' && parts[1] && parts[2] && !parts[3]) {
          return await handlePresenceGet(req, res, parts[1], parts[2]);
        }

        if (req.method === 'GET' && entity === 'changes' && parts[1] && parts[2] && parts[3] === 'since' && parts[4]) {
          return await handleChangesSince(req, res, parts[1], parts[2], parts[4]);
        }

        if (req.method === 'GET' && entity === 'resource-optimizer' && id === 'suggest') {
          return await handleResourceOptimizerSuggest(req, res);
        }

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

        if (req.method === 'POST' && entity === 'custom_entity_def' && id === 'create' && !action) {
          return await handleCreateCustomEntityDef(req, res, thatcher, configEngine);
        }

        if (req.method === 'POST' && entity === 'custom_entity_def' && id && action === 'delete') {
          return await handleDeleteCustomEntityDef(req, res, id, thatcher, configEngine);
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
      if (await serveStaticFile(pathname, req, res)) {
        return;
      }

      // Page routing (UI)
      if (!pathname.startsWith('/api/')) {
        try {
          const { handlePage } = await load(path.join(__dirname, '../ui/page-handler.js'));
          const html = await handlePage(pathname, req, res, configEngine, thatcher);
          // REDIRECT is a sentinel meaning handlePage already wrote the full
          // response itself (a 302 + res.end()) -- writing another response
          // on top crashes with ERR_HTTP_HEADERS_SENT, so it must short-circuit
          // here rather than fall into the `if (html)` HTML-body branch below.
          if (html === REDIRECT) return;
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
  // /ui/* assets (styles2.css, layout.js's stylesheets/scripts, the vendored
  // 247420 design-system dist) are thatcher's own framework-supplied UI, not
  // something a consuming app is expected to mirror into its own public/ dir
  // -- layout.js links them at these exact paths, so this server must be able
  // to answer them itself. 247420.css/247420.js resolve from the vendored
  // submodule's dist/ (not copied into src/ui/) since that is the single
  // source of truth updated by `git submodule update`; every other /ui/*
  // asset resolves directly from src/ui/ (styles2.css, client.js,
  // event-delegation.js, and any future asset placed there).
  if (pathname.startsWith('/ui/')) {
    const name = pathname.slice('/ui/'.length);
    const isVendorDesignAsset = name === '247420.css' || name === '247420.js';
    const uiFilePath = isVendorDesignAsset
      ? path.join(__dirname, '../../vendor/design/dist', name)
      : path.join(__dirname, '../ui', name);
    const uiRoot = isVendorDesignAsset
      ? path.join(__dirname, '../../vendor/design/dist')
      : path.join(__dirname, '../ui');
    try {
      if (await fileExists(uiFilePath) && path.dirname(uiFilePath) === uiRoot) {
        const content = await fs.promises.readFile(uiFilePath);
        const ext = path.extname(uiFilePath);
        const mime = { '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'text/plain';
        res.setHeader('Content-Type', mime);
        // no-cache: browser must revalidate every load instead of trusting
        // its heuristic freshness guess for these no-validator responses --
        // the previous absence of any Cache-Control let a stale disk-cached
        // copy silently outlive a real file change server-side, witnessed
        // as a CSS parse-error fix appearing correct in curl/on disk while
        // the browser (and, separately, a stale service worker registered
        // by an unrelated earlier session on this origin) kept serving the
        // pre-fix bytes.
        res.setHeader('Cache-Control', 'no-cache');
        res.writeHead(200);
        res.end(content);
        return true;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') staticLog.error(`${uiFilePath} ${err.code}`, { message: err.message });
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

    const { permissionService } = await import('../services/permission.service.js');

    switch (req.method) {
      case 'GET':
        if (id) {
          // get(...,{user}) applies the same row/org-access scoping every other
          // read path in the codebase uses -- this generic-CRUD GET-by-id had
          // none at all, so any authenticated user could read any record by id
          // across organizations. filterFields then strips any field the
          // caller's role isn't visible_to, the field-level half of this pass.
          result = await thatcher.get(entity, id, { user });
          if (!result) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }
          result = permissionService.filterFields(user, spec, result);
        } else {
          result = await thatcher.list(entity, {}, { user });
          result = result.map(r => permissionService.filterFields(user, spec, r));
        }
        break;

      case 'POST': {
        // enforceEditPermissions is the authoritative field-level write check --
        // it throws if the payload touches a field the caller's role isn't
        // editable_by, so a hand-crafted request bypassing the rendered form
        // cannot smuggle a restricted field in.
        permissionService.enforceEditPermissions(user, spec, body);
        {
          // Same gap PUT/PATCH had (fixed last pass): this raw-CRUD POST
          // never called any field validation, so required/min-max/enum/ref-
          // existence and entity-specific rules (e.g. stock-movement balance
          // enforcement below) were silently skipped for a hand-crafted create.
          const { validateEntity, hasErrors } = await import('../lib/validation/entity-validators.js');
          const createErrors = await validateEntity(entity, body, null, { actingUser: user });
          if (hasErrors(createErrors)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Validation failed', errors: createErrors }));
            return;
          }
        }
        result = await thatcher.create(entity, body, user);
        const { logAction } = await import('../lib/busybase/audit.js');
        logAction(entity, result.id, 'create', user.id, null, result);
        result = permissionService.filterFields(user, spec, result);
        status = 201;
        break;
      }

      case 'PUT':
      case 'PATCH': {
        if (!id) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'ID required' }));
          return;
        }
        // Same row/org-access gap the GET path had: an update by id must be
        // scoped the same way a read is, or a user could edit a record
        // outside their org purely because PUT was never checked.
        const existingForUpdate = await thatcher.get(entity, id, { user });
        if (!existingForUpdate) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }
        permissionService.enforceEditPermissions(user, spec, body);
        // The edit form renders encrypted:true fields blank with a "leave
        // blank to keep unchanged" note -- a blank submission must not
        // overwrite the stored secret, since update() spreads body directly
        // into the patch and encryptFields only skips ABSENT keys, not
        // empty-string values actually present in the object.
        for (const [fieldKey, fieldDef] of Object.entries(spec.fields || {})) {
          if (fieldDef.encrypted && body[fieldKey] === '') delete body[fieldKey];
        }
        {
          // validateUpdate is the authoritative server-side check for both
          // generic field-type constraints AND entity-specific business
          // rules (e.g. task dependency completion) -- this raw-CRUD path
          // never called it at all, so those rules were UI-only until now.
          const { validateUpdate, hasErrors } = await import('../lib/validation/entity-validators.js');
          const updateErrors = await validateUpdate(entity, body, existingForUpdate);
          if (hasErrors(updateErrors)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Validation failed', errors: updateErrors }));
            return;
          }
        }
        result = await thatcher.update(entity, id, body, user);
        const { logAction: logUpdate } = await import('../lib/busybase/audit.js');
        logUpdate(entity, id, 'update', user.id, existingForUpdate, result);
        result = permissionService.filterFields(user, spec, result);
        break;
      }

      case 'DELETE': {
        if (!id) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'ID required' }));
          return;
        }
        const existingForDelete = await thatcher.get(entity, id, { user });
        if (!existingForDelete) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }
        await thatcher.delete(entity, id);
        const { logAction: logDelete } = await import('../lib/busybase/audit.js');
        logDelete(entity, id, 'delete', user.id, existingForDelete, null);
        res.writeHead(204);
        res.end();
        return;
      }

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

async function handleCreateCustomEntityDef(req, res, thatcher, configEngineArg) {
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
  const { name, label, label_plural, fields } = body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'name required' }));
    return;
  }
  if (!label || typeof label !== 'string' || !label.trim()) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'label required' }));
    return;
  }

  const { validateCustomEntityFields } = await import('../lib/config-generator-engine.js');
  // Same allow-listed field-type vocabulary and reserved-key rejection every
  // custom entity gets, checked here BEFORE the record is ever persisted --
  // a bad definition must never reach the store, let alone registerCustomEntity.
  const fieldValidation = validateCustomEntityFields(fields);
  if (!fieldValidation.valid) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: fieldValidation.error }));
    return;
  }

  try {
    const record = { name: name.trim(), label: label.trim(), label_plural: (label_plural || '').trim() || undefined, fields, owner_id: user.id };
    // Register FIRST -- if the slug collides with an existing entity or the
    // shape is otherwise invalid at the engine level, the definition is
    // never persisted, so a rejected custom_entity_def never lingers as a
    // dead row claiming a slug it was never actually allowed to use.
    const slug = configEngine.registerCustomEntity(record);
    const { create } = await import('../lib/busybase/store.js');
    const created = await create('custom_entity_def', record, user);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: created.id, slug }));
  } catch (err) {
    apiLog.error(err.message);
    res.writeHead(400);
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleDeleteCustomEntityDef(req, res, defId, thatcher, configEngineArg) {
  const user = await requireAuthedPartner(req, res);
  if (!user) return;

  try {
    const { remove, get } = await import('../lib/busybase/store.js');
    const existing = await get('custom_entity_def', defId);
    if (!existing) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Custom entity definition not found' }));
      return;
    }
    await remove('custom_entity_def', defId);
    // Deliberately does NOT unregister the entity from the running config
    // engine -- existing data for that entity must remain readable this
    // session; removal only takes full effect on next restart's fresh
    // custom_entity_def load, the same "config changes need a reload"
    // contract updateWorkflow/updatePermissionTemplate already carry.
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

async function verifyRecordAccess(req, res, entityName, id) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return null;
  }
  const { get } = await import('../lib/busybase/store.js');
  let record;
  try {
    record = await get(entityName, id, { user });
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return null;
  }
  if (!record) {
    // A record the caller cannot access and a record that doesn't exist
    // resolve identically here on purpose -- distinguishing them would leak
    // that a specific id exists to someone who isn't allowed to see it.
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return null;
  }
  return user;
}

async function handlePresenceHeartbeat(req, res, entityName, id) {
  const user = await verifyRecordAccess(req, res, entityName, id);
  if (!user) return;
  const { heartbeat } = await import('../lib/presence-tracker.js');
  heartbeat(entityName, id, user.id, user.name || user.email || user.id);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

async function handleResourceOptimizerSuggest(req, res) {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const startDate = Number(url.searchParams.get('start_date'));
  const endDate = Number(url.searchParams.get('end_date'));
  const hoursNeeded = Number(url.searchParams.get('hours_needed'));
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || !Number.isFinite(hoursNeeded)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'start_date, end_date, and hours_needed are required numeric query params' }));
    return;
  }

  // Self-only unless partner/manager -- the SAME privilege boundary
  // resource_allocation's own checkTimeEntryOwnership-derived ownership
  // check already enforces on write. A non-privileged caller asking for
  // suggestions must not learn how loaded ANY other user is (that leaks
  // workload/capacity across the org), so their candidate pool is
  // themselves alone rather than filtered results from a broader query.
  const isPrivileged = ['partner', 'admin', 'manager'].includes(user.role);
  let candidateUserIds;
  if (isPrivileged) {
    const { list } = await import('../lib/busybase/store.js');
    const users = await list('user', {});
    candidateUserIds = users.map(u => u.id);
  } else {
    candidateUserIds = [user.id];
  }

  const { suggestBestFitUsers } = await import('../lib/resource-optimizer.js');
  const suggestions = await suggestBestFitUsers(candidateUserIds, startDate, endDate, hoursNeeded);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ suggestions }));
}

async function handlePresenceGet(req, res, entityName, id) {
  const user = await verifyRecordAccess(req, res, entityName, id);
  if (!user) return;
  const { getViewers } = await import('../lib/presence-tracker.js');
  const viewers = getViewers(entityName, id, user.id);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ viewers }));
}

async function handleChangesSince(req, res, entityName, id, timestampStr) {
  const user = await verifyRecordAccess(req, res, entityName, id);
  if (!user) return;
  const since = Number(timestampStr);
  if (!Number.isFinite(since)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid timestamp' }));
    return;
  }
  const { getEntityAuditTrail } = await import('../lib/busybase/audit-reads.js');
  const trail = await getEntityAuditTrail(entityName, id);
  const changed = trail.some(entry => (entry.createdAt || 0) > since);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ changed }));
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
