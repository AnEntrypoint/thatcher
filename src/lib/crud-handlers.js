/**
 * CRUD Handlers - HTTP handler implementations for entity operations
 * This is where request/response handling, validation, auth, and business logic meet
 */

import { list, get, listWithPagination, searchWithPagination } from './query-engine.js';
import { create, update, remove } from './query-engine-write.js';
import { validateEntity, validateUpdate, sanitizeData } from './validate.js';
import { requirePermission, getSessionToken } from './auth-middleware.js';
import { executeHook } from './hook-engine.js';
import { AppError, NotFoundError, ValidationError } from './error-handler.js';
import { ok, created, paginated, noContent, error } from './response-formatter.js';
import { HTTP } from '../config/constants.js';
import { permissionService } from '../services/permission.service.js';
import { parse as parseQuery } from './query-string-adapter.js';
import { now } from './database-core.js';
import { getConfigEngineSync } from './config-generator-engine.js';

/**
 * Build a complete set of CRUD handlers for an entity
 * @param {object} spec - Entity specification
 * @returns {object}
 */
export function createCrudHandlers(entityName, spec) {
  if (!spec) {
    spec = getConfigEngineSync().generateEntitySpec(entityName);
  }

  return {
    /**
     * List entities (GET /api/:entity)
     */
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
        const result = await searchWithPagination(entityName, q, {}, finalPage, finalPageSize);
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
        const result = await listWithPagination(entityName, coercedFilters, finalPage, finalPageSize);
        items = result.items;
        pagination = result.pagination;
      }

      const filtered = permissionService.filterRecords(user, spec, items);
      const filteredItems = filtered.map(i => permissionService.filterFields(user, spec, i));

      return paginated(filteredItems, pagination);
    },

    /**
     * Get single entity (GET /api/:entity/:id)
     */
    get: async (id, req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'view');

      if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);

      const item = get(entityName, id);
      if (!item) throw NotFoundError(entityName, id);

      if (!permissionService.checkRowAccess(user, spec, item)) {
        throw new AppError('Access denied', 'FORBIDDEN', HTTP.FORBIDDEN);
      }

      return ok(permissionService.filterFields(user, spec, item));
    },

    /**
     * Create entity (POST /api/:entity)
     */
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
      const record = create(entityName, sanitized, user);

      // Execute hooks
      executeHook(`create:${entityName}:after`, {
        entity: entityName,
        id: record.id,
        data: record,
        user,
      }).catch(console.error);

      return created(permissionService.filterFields(user, spec, record));
    },

    /**
     * Update entity (PUT/PATCH /api/:entity/:id)
     */
    update: async (id, req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'edit');

      if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);

      const existing = get(entityName, id);
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
      const record = update(entityName, id, sanitized, user);

      executeHook(`update:${entityName}:after`, {
        entity: entityName,
        id,
        data: record,
        before: existing,
        after: record,
        user,
      }).catch(console.error);

      return ok(permissionService.filterFields(user, spec, record));
    },

    /**
     * Delete entity (DELETE /api/:entity/:id)
     */
    remove: async (id, req, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'delete');

      if (!id) throw new AppError('ID required', 'BAD_REQUEST', HTTP.BAD_REQUEST);

      const existing = get(entityName, id);
      if (!existing) throw NotFoundError(entityName, id);

      if (!permissionService.checkRowAccess(user, spec, existing)) {
        throw new AppError('Access denied', 'FORBIDDEN', HTTP.FORBIDDEN);
      }

      const result = remove(entityName, id);

      executeHook(`delete:${entityName}:after`, {
        entity: entityName,
        id,
        data: result,
        user,
      }).catch(console.error);

      return noContent();
    },

    /**
     * Custom action handler
     */
    customAction: async (action, id, data, context) => {
      const { user } = context;
      await requirePermission(user, spec, 'edit'); // Simplified permission check

      const record = get(entityName, id);
      if (!record) throw NotFoundError(entityName, id);

      // Custom action logic (upload, manage_flags, etc.)
      if (action === 'upload_files') {
        const files = Array.isArray(data.files) ? data.files : [data.files];
        executeHook(`upload_files:${entityName}:after`, {
          entity: entityName,
          id,
          data: { id, uploaded_files: files },
          user,
        });
        return ok({ id, uploaded_files: files });
      }

      // More actions can be added here
      throw new AppError(`Unknown action: ${action}`, 'BAD_REQUEST', HTTP.BAD_REQUEST);
    },
  };
}

/**
 * Coerce field value to correct type
 * @param {any} value
 * @param {string} type
 * @returns {any}
 */
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
