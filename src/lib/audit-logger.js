import { getDatabase, genId, now } from '@/lib/database-core';
import { Mutex } from '@/lib/hot-reload/mutex';

const db = getDatabase();
const auditMutex = new Mutex('audit-logger');

export const ACTIVITY_TYPES = {
  RFI_QUESTION_VIEW: 'rfi_question_view',
  RFI_QUESTION_RESPOND: 'rfi_question_respond',
  RFI_QUESTION_COMMENT: 'rfi_question_comment',
  RFI_QUESTION_CREATE: 'rfi_question_create',
  RFI_QUESTION_UPDATE: 'rfi_question_update',
  RFI_QUESTION_DELETE: 'rfi_question_delete',
  RFI_QUESTION_ASSIGN: 'rfi_question_assign',
  RFI_QUESTION_DEADLINE: 'rfi_question_deadline',
  HIGHLIGHT_CREATE: 'highlight_create',
  HIGHLIGHT_RESOLVE: 'highlight_resolve',
  HIGHLIGHT_REOPEN: 'highlight_reopen',
  HIGHLIGHT_DELETE: 'highlight_delete',
  REVIEW_CREATE: 'review_create',
  REVIEW_UPDATE: 'review_update',
  REVIEW_ARCHIVE: 'review_archive',
  COLLABORATOR_ADD: 'collaborator_add',
  COLLABORATOR_REMOVE: 'collaborator_remove',
  PERMISSION_CHANGE: 'permission_change',
  ROLE_CHANGE: 'role_change',
};

const parseJson = (val) => val ? JSON.parse(val) : null;

const parseRow = (row) => row ? {
  ...row,
  old_permissions: parseJson(row.old_permissions),
  new_permissions: parseJson(row.new_permissions),
  metadata: parseJson(row.metadata),
  before_state: parseJson(row.before_state),
  after_state: parseJson(row.after_state),
} : null;

export const logAction = (entityType, entityId, action, userId, beforeState, afterState) => {
  const id = genId();
  const timestamp = now();
  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, user_id, before_state, after_state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, action, userId || null,
    beforeState ? JSON.stringify(beforeState) : null,
    afterState ? JSON.stringify(afterState) : null,
    timestamp
  );
  return { id, timestamp };
};

export const getAuditHistory = (filters = {}, page = 1, pageSize = 50) => {
  const wc = [], params = [];
  if (filters.entityType) { wc.push('entity_type = ?'); params.push(filters.entityType); }
  if (filters.entityId) { wc.push('entity_id = ?'); params.push(filters.entityId); }
  if (filters.userId) { wc.push('user_id = ?'); params.push(filters.userId); }
  if (filters.action) { wc.push('action = ?'); params.push(filters.action); }
  if (filters.fromDate) { wc.push('created_at >= ?'); params.push(filters.fromDate); }
  if (filters.toDate) { wc.push('created_at <= ?'); params.push(filters.toDate); }
  const where = wc.length ? 'WHERE ' + wc.join(' AND ') : '';
  const { count: total } = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`).get(...params);
  const offset = (page - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  return {
    items: items.map(i => ({
      id: i.id, entityType: i.entity_type, entityId: i.entity_id, action: i.action,
      userId: i.user_id, beforeState: parseJson(i.before_state), afterState: parseJson(i.after_state), createdAt: i.created_at,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
};

export const getEntityAuditTrail = (entityType, entityId) => {
  return db.prepare(`SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`).all(entityType, entityId)
    .map(i => ({ id: i.id, action: i.action, userId: i.user_id, beforeState: parseJson(i.before_state), afterState: parseJson(i.after_state), createdAt: i.created_at }));
};

const statsSql = (col) => `SELECT ${col}, COUNT(*) as count FROM audit_logs WHERE created_at >= ? AND created_at <= ? GROUP BY ${col} ORDER BY count DESC`;
export const getActionStats = (fromDate, toDate) => db.prepare(statsSql('action')).all(fromDate, toDate);
export const getUserStats = (fromDate, toDate) => db.prepare(statsSql('user_id')).all(fromDate, toDate);

export const logPermissionChange = ({
  userId, entityType, entityId, action, oldPermissions = null, newPermissions = null,
  reason = null, reasonCode = 'other', affectedUserId = null, ipAddress = null, sessionId = null, metadata = null,
}) => {
  if (!userId || !entityType || !entityId || !action) throw new Error('Missing required audit fields');
  const auditId = genId();
  const timestamp = now();
  db.prepare(`
    INSERT INTO permission_audit (id, user_id, entity_type, entity_id, action, old_permissions, new_permissions,
      reason, reason_code, timestamp, ip_address, session_id, affected_user_id, metadata, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(auditId, userId, entityType, entityId, action,
    oldPermissions ? JSON.stringify(oldPermissions) : null, newPermissions ? JSON.stringify(newPermissions) : null,
    reason, reasonCode, timestamp, ipAddress, sessionId, affectedUserId,
    metadata ? JSON.stringify(metadata) : null, timestamp, timestamp, userId, userId
  );
  return auditId;
};

export const auditPermissionChange = async ({ user, entityType, entityId, action, oldPermissions = null,
  newPermissions = null, affectedUserId = null, reason = null, reasonCode = 'admin_action', metadata = null }) => {
  return auditMutex.runExclusive(() => {
    try {
      logPermissionChange({ userId: user.id, entityType, entityId, action, oldPermissions, newPermissions,
        reason: reason || `Permission ${action}`, reasonCode, affectedUserId, metadata });
    } catch (error) {
      console.error('[Audit] Failed to log permission change:', error);
    }
  });
};

export const auditRoleChange = async ({ user, targetUserId, oldRole, newRole, reason = null, metadata = null }) => {
  await auditPermissionChange({ user, entityType: 'user', entityId: targetUserId, action: 'role_change',
    oldPermissions: { role: oldRole }, newPermissions: { role: newRole },
    affectedUserId: targetUserId, reason: reason || `Role changed from ${oldRole} to ${newRole}`,
    reasonCode: 'role_change', metadata: { ...metadata, old_role: oldRole, new_role: newRole } });
};

export const auditCollaboratorAdded = async ({ user, reviewId, collaboratorId, collaboratorUserId, permissions = null, reason = null, metadata = null }) => {
  await auditPermissionChange({ user, entityType: 'review', entityId: reviewId, action: 'grant',
    newPermissions: permissions || { access: 'collaborator' }, affectedUserId: collaboratorUserId,
    reason: reason || 'Collaborator added to review', reasonCode: 'collaborator_added',
    metadata: { ...metadata, collaborator_id: collaboratorId, review_id: reviewId } });
};

export const auditCollaboratorRemoved = async ({ user, reviewId, collaboratorId, collaboratorUserId, permissions = null, reason = null, metadata = null }) => {
  await auditPermissionChange({ user, entityType: 'review', entityId: reviewId, action: 'revoke',
    oldPermissions: permissions || { access: 'collaborator' }, affectedUserId: collaboratorUserId,
    reason: reason || 'Collaborator removed from review', reasonCode: 'collaborator_removed',
    metadata: { ...metadata, collaborator_id: collaboratorId, review_id: reviewId } });
};

export const auditLifecycleTransition = async ({ user, entityType, entityId, fromStage, toStage, metadata = null }) => {
  await auditPermissionChange({ user, entityType, entityId, action: 'modify',
    oldPermissions: { stage: fromStage }, newPermissions: { stage: toStage },
    reason: `Lifecycle transition: ${fromStage} -> ${toStage}`, reasonCode: 'lifecycle_transition',
    metadata: { ...metadata, from_stage: fromStage, to_stage: toStage } });
};

export const auditPermissionModify = async ({ user, entityType, entityId, oldPermissions, newPermissions,
  affectedUserId = null, reason = null, reasonCode = 'admin_action', metadata = null }) => {
  await auditPermissionChange({ user, entityType, entityId, action: 'modify',
    oldPermissions, newPermissions, affectedUserId, reason: reason || 'Permissions modified', reasonCode, metadata });
};

export const getPermissionAuditTrail = ({ entityType, entityId, userId, affectedUserId, limit = 100, offset = 0 }) => {
  let sql = 'SELECT * FROM permission_audit WHERE 1=1';
  const params = [];
  if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
  if (entityId) { sql += ' AND entity_id = ?'; params.push(entityId); }
  if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
  if (affectedUserId) { sql += ' AND affected_user_id = ?'; params.push(affectedUserId); }
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  return db.prepare(sql).all(...params, limit, offset).map(parseRow);
};

export const getPermissionAuditById = (auditId) => parseRow(db.prepare('SELECT * FROM permission_audit WHERE id = ?').get(auditId));
export const getPermissionAuditStats = () => db.prepare(`SELECT COUNT(*) as total_audits, COUNT(DISTINCT user_id) as unique_users, COUNT(DISTINCT entity_type) as entity_types, MIN(timestamp) as earliest_change, MAX(timestamp) as latest_change FROM permission_audit`).get();
export const getPermissionAuditBreakdown = (field) => db.prepare(`SELECT ${field}, COUNT(*) as count FROM permission_audit GROUP BY ${field} ORDER BY count DESC`).all();

export const searchPermissionAudit = (searchTerm, limit = 100) => {
  const pattern = `%${searchTerm}%`;
  return db.prepare(`SELECT * FROM permission_audit WHERE reason LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? ORDER BY timestamp DESC LIMIT ?`)
    .all(pattern, pattern, pattern, limit).map(parseRow);
};

export const getPermissionAuditByDateRange = (startDate, endDate, limit = 100) =>
  db.prepare(`SELECT * FROM permission_audit WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?`).all(startDate, endDate, limit).map(parseRow);

export const exportPermissionAuditCSV = async (filters = {}) => {
  const trail = getPermissionAuditTrail({ ...filters, limit: 10000 });
  const h = 'Timestamp,Changed By,Entity Type,Entity ID,Action,Reason Code,Reason,Affected User,IP Address';
  const rows = trail.map(a => [new Date(a.timestamp * 1000).toISOString(), a.user_id, a.entity_type,
    a.entity_id, a.action, a.reason_code, a.reason || '', a.affected_user_id || '', a.ip_address || '']
    .map(c => `"${c}"`).join(','));
  return [h, ...rows].join('\n');
};

export const logQuestionActivity = (questionId, action, userId, details = null) => {
  return logAction('rfi_question', questionId, action, userId, null, details);
};

export const getPermissionDiff = (oldPerms, newPerms) => {
  const diff = { added: [], removed: [], unchanged: [] };
  const oldSet = new Set(Array.isArray(oldPerms) ? oldPerms : []);
  const newSet = new Set(Array.isArray(newPerms) ? newPerms : []);
  for (const p of newSet) { if (!oldSet.has(p)) diff.added.push(p); else diff.unchanged.push(p); }
  for (const p of oldSet) { if (!newSet.has(p)) diff.removed.push(p); }
  return diff;
};
