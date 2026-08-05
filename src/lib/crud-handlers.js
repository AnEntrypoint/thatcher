import { createLogger } from './logger.js';
import { get, listWithPagination, searchWithPagination, create, update, remove } from './busybase/store.js';

const log = createLogger('[CRUD]');
import { validateEntity, validateUpdate, sanitizeData } from './validation/index.js';
import { requirePermission } from './auth-middleware.js';
import { executeHook } from './hook-engine.js';
import { AppError, NotFoundError, ValidationError } from './errors/index.js';
import { ok, created, paginated, noContent } from './response-formatter.js';
import { HTTP } from '../config/constants.js';
import { permissionService } from '../services/permission.service.js';
import { parse as parseQuery } from './query-string-adapter.js';
import { now } from './id-helpers.js';
import { getConfigEngineSync } from './config-generator-engine.js';
import { logAction } from './busybase/audit.js';

export function createCrudHandlers(entityName, spec) {
  if (!spec) {
    spec = getConfigEngineSync().generateEntitySpec(entityName);
  }

  return {
    list: async (req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'list');

      const { q, page, pageSize, filters } = await parseQuery(req);
      const config = getConfigEngineSync().getConfig();
      const paginationCfg = config.system?.pagination || { default_page_size: 50, max_page_size: 500 };

      const finalPage = page || 1;
      if (!Number.isInteger(finalPage) || finalPage < 1) {
        throw new AppError('page must be >= 1', 'BAD_REQUEST', HTTP.BAD_REQUEST);
      }

      const requestedPageSize = pageSize || paginationCfg.default_page_size;
      if (!Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
        throw new AppError('pageSize must be >= 1', 'BAD_REQUEST', HTTP.BAD_REQUEST);
      }

      const finalPageSize = Math.min(requestedPageSize, paginationCfg.max_page_size || 500);

      let items, pagination;

      if (q) {
        const result = await searchWithPagination(entityName, q, {}, finalPage, finalPageSize, { user });
        items = result.items;
        pagination = result.pagination;
      } else {
        const coercedFilters = {};
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            const fd = spec.fields?.[key];
            coercedFilters[key] = fd ? coerceFieldValue(value, fd.type) : value;
          }
        }
        const result = await listWithPagination(entityName, coercedFilters, finalPage, finalPageSize, { user });
        items = result.items;
        pagination = result.pagination;
      }

      const filtered = permissionService.filterRecords(user, spec, items);
      const filteredItems = filtered.map(i => permissionService.filterFields(user, spec, i));

      return paginated(filteredItems, pagination);
    },

    get: async (id, req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'view');

      if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);

      const item = await get(entityName, id);
      if (!item) throw NotFoundError(entityName, id);

      if (!permissionService.checkRowAccess(user, spec, item)) {
        throw new AppError('Access denied', 'FORBIDDEN', HTTP.FORBIDDEN);
      }

      return ok(permissionService.filterFields(user, spec, item));
    },

    create: async (req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'create');

      const rawData = await req.json();
      permissionService.enforceEditPermissions(user, spec, rawData);

      const errors = await validateEntity(entityName, rawData);
      if (Object.keys(errors).length > 0) {
        throw new ValidationError('Validation failed', errors);
      }

      const sanitized = sanitizeData(entityName, rawData, spec);
      const record = await create(entityName, sanitized, user);

      // Audit log (ported from moon)
      logAction(entityName, record.id, 'create', user?.id, null, record);

      executeHook(`create:${entityName}:after`, {
        entity: entityName,
        id: record.id,
        data: record,
        user,
      }).catch(e => log.error(e.message));

      return created(permissionService.filterFields(user, spec, record));
    },

    update: async (id, req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'edit');

      if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);

      const existing = await get(entityName, id);
      if (!existing) throw NotFoundError(entityName, id);

      if (!permissionService.checkRowAccess(user, spec, existing)) {
        throw new AppError('Access denied', 'FORBIDDEN', HTTP.FORBIDDEN);
      }

      const rawData = await req.json();
      permissionService.enforceEditPermissions(user, spec, rawData);

      const errors = await validateUpdate(entityName, rawData, existing);
      if (Object.keys(errors).length > 0) {
        throw new ValidationError('Validation failed', errors);
      }

      const sanitized = sanitizeData(entityName, rawData, spec, existing);
      const record = await update(entityName, id, sanitized, user);

      // Audit log (ported from moon)
      logAction(entityName, id, 'update', user?.id, existing, record);

      executeHook(`update:${entityName}:after`, {
        entity: entityName,
        id,
        data: record,
        before: existing,
        after: record,
        user,
      }).catch(e => log.error(e.message));

      return ok(permissionService.filterFields(user, spec, record));
    },

    remove: async (id, req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'delete');

      if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);

      const existing = await get(entityName, id);
      if (!existing) throw NotFoundError(entityName, id);

      if (!permissionService.checkRowAccess(user, spec, existing)) {
        throw new AppError('Access denied', 'FORBIDDEN', HTTP.FORBIDDEN);
      }

      // Delete strategy (ported from moon): immutable entities are archived,
      // entities with a status field are soft-deleted, otherwise hard-removed.
      let result;
      if (spec.immutable === true && spec.immutable_strategy === 'move_to_archive') {
        const archiveData = { archived: true, archived_at: now(), archived_by: user?.id };
        result = await update(entityName, id, archiveData, user);
        logAction(entityName, id, 'archive', user?.id, existing, archiveData);
      } else if (spec.fields?.status) {
        result = await update(entityName, id, { status: 'deleted' }, user);
        logAction(entityName, id, 'delete', user?.id, existing, { status: 'deleted' });
      } else {
        result = await remove(entityName, id);
        logAction(entityName, id, 'delete', user?.id, existing, null);
      }

      executeHook(`delete:${entityName}:after`, {
        entity: entityName,
        id,
        data: result,
        user,
      }).catch(e => log.error(e.message));

      return noContent();
    },

    customAction: async (action, id, data, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'edit'); // Simplified permission check

      const record = await get(entityName, id);
      if (!record) throw NotFoundError(entityName, id);

      if (action === 'upload_files') {
        const files = Array.isArray(data.files) ? data.files : [data.files];
        executeHook(`upload_files:${entityName}:after`, {
          entity: entityName,
          id,
          data: { id, uploaded_files: files },
          user,
        }).catch(e => log.error(e.message));
        return ok({ id, uploaded_files: files });
      }

      throw new AppError(`Unknown action: ${action}`, 'BAD_REQUEST', HTTP.BAD_REQUEST);
    },
  };
}

function coerceFieldValue(value, type) {
  if (value === null || value === undefined) return value;

  switch (type) {
    case 'int':
    case 'decimal':
      return Number(value);
    case 'bool':
      return Boolean(value);
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    case 'date':
    case 'timestamp':
      return Number(value);
    default:
      return String(value);
  }
}
