import { getDatabase, genId, now } from '@/lib/database-core';
import { Mutex } from '@/lib/hot-reload/mutex';

const db = getDatabase();
const auditMutex = new Mutex('audit-logger-enhanced');

export const LOG_LEVELS = { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' };
export const OPERATION_TYPES = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', READ: 'read', AUTH: 'auth', AUTHZ: 'authz' };

const MAX_LOG_SIZE = 10000;
const MAX_STACK_DEPTH = 20;

export const logStructured = ({ level = LOG_LEVELS.INFO, operation, entityType, entityId, userId, action, details = {}, error = null, performanceMs = null }) => {
  return auditMutex.runExclusive(() => {
    const id = genId();
    const timestamp = now();
    const logEntry = {
      id, timestamp, level, operation, entity_type: entityType, entity_id: entityId, user_id: userId, action,
      details: JSON.stringify(details).substring(0, MAX_LOG_SIZE),
      error_message: error ? String(error.message || error).substring(0, MAX_LOG_SIZE) : null,
      error_stack: error && error.stack ? String(error.stack).split('\n').slice(0, MAX_STACK_DEPTH).join('\n') : null,
      performance_ms: performanceMs,
    };
    db.prepare(`INSERT INTO structured_logs (id, timestamp, level, operation, entity_type, entity_id, user_id, action, details, error_message, error_stack, performance_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, timestamp, level, operation, entityType, entityId, userId, action, logEntry.details, logEntry.error_message, logEntry.error_stack, performanceMs
    );
    return id;
  });
};

export const logCreate = (entityType, entityId, userId, afterState) => {
  return logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.CREATE, entityType, entityId, userId, action: 'create', details: { after_state: afterState } });
};

export const logUpdate = (entityType, entityId, userId, beforeState, afterState) => {
  return logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.UPDATE, entityType, entityId, userId, action: 'update', details: { before_state: beforeState, after_state: afterState } });
};

export const logDelete = (entityType, entityId, userId, beforeState) => {
  return logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.DELETE, entityType, entityId, userId, action: 'delete', details: { before_state: beforeState } });
};

export const logAuthSuccess = (userId, method, metadata = {}) => {
  return logStructured({ level: LOG_LEVELS.INFO, operation: OPERATION_TYPES.AUTH, entityType: 'auth', entityId: userId, userId, action: 'login_success', details: { method, ...metadata } });
};

export const logAuthFailure = (email, reason, metadata = {}) => {
  return logStructured({ level: LOG_LEVELS.WARN, operation: OPERATION_TYPES.AUTH, entityType: 'auth', entityId: email, userId: null, action: 'login_failure', details: { reason, ...metadata } });
};

export const logAuthzFailure = (userId, entityType, entityId, requiredPermission, metadata = {}) => {
  return logStructured({ level: LOG_LEVELS.WARN, operation: OPERATION_TYPES.AUTHZ, entityType, entityId, userId, action: 'access_denied', details: { required_permission: requiredPermission, ...metadata } });
};

export const logPerformance = (operation, entityType, durationMs, userId = null, metadata = {}) => {
  const level = durationMs > 1000 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  return logStructured({ level, operation: 'performance', entityType, entityId: null, userId, action: operation, performanceMs: durationMs, details: metadata });
};

export const logError = (error, context = {}) => {
  return logStructured({ level: LOG_LEVELS.ERROR, operation: 'error', entityType: context.entityType || 'system', entityId: context.entityId || null, userId: context.userId || null, action: context.action || 'error', error, details: context });
};

export const searchLogs = (filters = {}, page = 1, pageSize = 100) => {
  const wc = [], params = [];
  if (filters.level) { wc.push('level = ?'); params.push(filters.level); }
  if (filters.operation) { wc.push('operation = ?'); params.push(filters.operation); }
  if (filters.entityType) { wc.push('entity_type = ?'); params.push(filters.entityType); }
  if (filters.entityId) { wc.push('entity_id = ?'); params.push(filters.entityId); }
  if (filters.userId) { wc.push('user_id = ?'); params.push(filters.userId); }
  if (filters.action) { wc.push('action = ?'); params.push(filters.action); }
  if (filters.fromDate) { wc.push('timestamp >= ?'); params.push(filters.fromDate); }
  if (filters.toDate) { wc.push('timestamp <= ?'); params.push(filters.toDate); }
  if (filters.searchText) { wc.push('(details LIKE ? OR error_message LIKE ? OR action LIKE ?)'); const escaped = filters.searchText.replace(/[%_]/g, c => '\\' + c); const pat = `%${escaped}%`; params.push(pat, pat, pat); }
  const where = wc.length ? 'WHERE ' + wc.join(' AND ') : '';
  const { count: total } = db.prepare(`SELECT COUNT(*) as count FROM structured_logs ${where}`).get(...params);
  const offset = (page - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM structured_logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  return { items: items.map(i => ({ ...i, details: i.details ? JSON.parse(i.details) : null })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
};

export const getLogStats = (fromDate, toDate) => {
  const byLevel = db.prepare('SELECT level, COUNT(*) as count FROM structured_logs WHERE timestamp >= ? AND timestamp <= ? GROUP BY level').all(fromDate, toDate);
  const byOperation = db.prepare('SELECT operation, COUNT(*) as count FROM structured_logs WHERE timestamp >= ? AND timestamp <= ? GROUP BY operation ORDER BY count DESC').all(fromDate, toDate);
  const byEntity = db.prepare('SELECT entity_type, COUNT(*) as count FROM structured_logs WHERE timestamp >= ? AND timestamp <= ? GROUP BY entity_type ORDER BY count DESC LIMIT 20').all(fromDate, toDate);
  const errorRate = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN level = ? THEN 1 ELSE 0 END) as errors FROM structured_logs WHERE timestamp >= ? AND timestamp <= ?').get(LOG_LEVELS.ERROR, fromDate, toDate);
  const avgPerf = db.prepare('SELECT AVG(performance_ms) as avg, MAX(performance_ms) as max FROM structured_logs WHERE timestamp >= ? AND timestamp <= ? AND performance_ms IS NOT NULL').get(fromDate, toDate);
  return { byLevel, byOperation, byEntity, errorRate: errorRate.total > 0 ? errorRate.errors / errorRate.total : 0, avgPerformanceMs: avgPerf.avg, maxPerformanceMs: avgPerf.max };
};

export const rotateLogsOlderThan = (daysOld = 90) => {
  const cutoffTimestamp = now() - (daysOld * 24 * 60 * 60);
  const archiveId = genId();
  const archived = db.prepare('SELECT * FROM structured_logs WHERE timestamp < ?').all(cutoffTimestamp);
  if (archived.length > 0) {
    db.prepare('INSERT INTO archived_logs (archive_id, archived_at, log_data) VALUES (?, ?, ?)').run(archiveId, now(), JSON.stringify(archived));
    db.prepare('DELETE FROM structured_logs WHERE timestamp < ?').run(cutoffTimestamp);
  }
  return { archived: archived.length, archiveId };
};

export const ensureTables = () => {
  db.exec(`CREATE TABLE IF NOT EXISTS structured_logs (
    id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, level TEXT NOT NULL, operation TEXT, entity_type TEXT,
    entity_id TEXT, user_id TEXT, action TEXT, details TEXT, error_message TEXT, error_stack TEXT, performance_ms REAL
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_structured_logs_timestamp ON structured_logs(timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_structured_logs_level ON structured_logs(level)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_structured_logs_entity ON structured_logs(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_structured_logs_user ON structured_logs(user_id)`);
  db.exec(`CREATE TABLE IF NOT EXISTS archived_logs (
    archive_id TEXT PRIMARY KEY, archived_at INTEGER NOT NULL, log_data TEXT NOT NULL
  )`);
};

ensureTables();
