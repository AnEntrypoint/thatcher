import { createLogger } from './logger.js';
import { genId, now } from '@/lib/id-helpers';

const log = createLogger('[AuditEnhanced]');
import { list, create, remove } from '@/lib/busybase/store';

export const LOG_LEVELS = { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' };
export const OPERATION_TYPES = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', READ: 'read', AUTH: 'auth', AUTHZ: 'authz' };

const MAX_LOG_SIZE = 10000;
const MAX_STACK_DEPTH = 20;

// Structured log writes go to the busybase `structured_logs` table. Fire-and-forget:
// logging must never break the operation it records.
export const logStructured = ({ level = LOG_LEVELS.INFO, operation, entityType, entityId, userId, action, details = {}, error = null, performanceMs = null }) => {
  const id = genId();
  const row = {
    id, timestamp: now(), level, operation: operation || '', entity_type: entityType || '', entity_id: entityId || '',
    user_id: userId || '', action: action || '',
    details: JSON.stringify(details).substring(0, MAX_LOG_SIZE),
    error_message: error ? String(error.message || error).substring(0, MAX_LOG_SIZE) : '',
    error_stack: error && error.stack ? String(error.stack).split('\n').slice(0, MAX_STACK_DEPTH).join('\n') : '',
    performance_ms: performanceMs ?? 0,
  };
  Promise.resolve(create('structured_logs', row)).catch(e => log.error('log failed:', { message: e?.message || String(e) }));
  return id;
};

export const logCreate = (entityType, entityId, userId, afterState) =>
  logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.CREATE, entityType, entityId, userId, action: 'create', details: { after_state: afterState } });

export const logUpdate = (entityType, entityId, userId, beforeState, afterState) =>
  logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.UPDATE, entityType, entityId, userId, action: 'update', details: { before_state: beforeState, after_state: afterState } });

export const logDelete = (entityType, entityId, userId, beforeState) =>
  logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.DELETE, entityType, entityId, userId, action: 'delete', details: { before_state: beforeState } });

export const logAuthSuccess = (userId, method, metadata = {}) =>
  logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.AUTH, entityType: 'auth', entityId: userId, userId, action: 'login_success', details: { method, ...metadata } });

export const logAuthFailure = (email, reason, metadata = {}) =>
  logStructured({ level: LOG_LEVELS.WARN, operation: OPERATION_TYPES.AUTH, entityType: 'auth', entityId: email, userId: null, action: 'login_failure', details: { reason, ...metadata } });

export const logAuthzFailure = (userId, entityType, entityId, requiredPermission, metadata = {}) =>
  logStructured({ level: LOG_LEVELS.WARN, operation: OPERATION_TYPES.AUTHZ, entityType, entityId, userId, action: 'access_denied', details: { required_permission: requiredPermission, ...metadata } });

export const logPerformance = (operation, entityType, durationMs, userId = null, metadata = {}) => {
  const level = durationMs > 1000 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  return logStructured({ level, operation: 'performance', entityType, entityId: null, userId, action: operation, performanceMs: durationMs, details: metadata });
};

export const logError = (error, context = {}) =>
  logStructured({ level: LOG_LEVELS.ERROR, operation: 'error', entityType: context.entityType || 'system', entityId: context.entityId || null, userId: context.userId || null, action: context.action || 'error', error, details: context });

const t = (r) => r.timestamp || 0;

export const searchLogs = async (filters = {}, page = 1, pageSize = 100) => {
  const where = {};
  if (filters.level) where.level = filters.level;
  if (filters.operation) where.operation = filters.operation;
  if (filters.entityType) where.entity_type = filters.entityType;
  if (filters.entityId) where.entity_id = filters.entityId;
  if (filters.userId) where.user_id = filters.userId;
  if (filters.action) where.action = filters.action;
  let rows = await list('structured_logs', where);
  if (filters.fromDate) rows = rows.filter(r => t(r) >= filters.fromDate);
  if (filters.toDate) rows = rows.filter(r => t(r) <= filters.toDate);
  if (filters.searchText) {
    const q = String(filters.searchText).toLowerCase();
    rows = rows.filter(r => [r.details, r.error_message, r.action].some(v => String(v ?? '').toLowerCase().includes(q)));
  }
  rows.sort((a, b) => t(b) - t(a));
  const total = rows.length;
  const items = rows.slice((page - 1) * pageSize, page * pageSize)
    .map(i => ({ ...i, details: i.details ? (() => { try { return JSON.parse(i.details); } catch { return null; } })() : null }));
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
};

const groupCount = (rows, field) => {
  const c = {};
  for (const r of rows) { const k = r[field]; c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).map(([k, count]) => ({ [field]: k, count })).sort((a, b) => b.count - a.count);
};

export const getLogStats = async (fromDate, toDate) => {
  const rows = (await list('structured_logs', {})).filter(r => t(r) >= fromDate && t(r) <= toDate);
  const errors = rows.filter(r => r.level === LOG_LEVELS.ERROR).length;
  const perf = rows.map(r => r.performance_ms).filter(v => typeof v === 'number' && v > 0);
  return {
    byLevel: groupCount(rows, 'level'),
    byOperation: groupCount(rows, 'operation'),
    byEntity: groupCount(rows, 'entity_type').slice(0, 20),
    errorRate: rows.length > 0 ? errors / rows.length : 0,
    avgPerformanceMs: perf.length ? perf.reduce((a, b) => a + b, 0) / perf.length : null,
    maxPerformanceMs: perf.length ? Math.max(...perf) : null,
  };
};

export const rotateLogsOlderThan = async (daysOld = 90) => {
  const cutoff = now() - (daysOld * 24 * 60 * 60);
  const archiveId = genId();
  const archived = (await list('structured_logs', {})).filter(r => t(r) < cutoff);
  if (archived.length > 0) {
    await create('archived_logs', { archive_id: archiveId, archived_at: now(), log_data: JSON.stringify(archived) });
    for (const r of archived) await remove('structured_logs', r.id);
  }
  return { archived: archived.length, archiveId };
};

// busybase is schemaless — tables are created lazily on first insert.
export const ensureTables = () => {};
