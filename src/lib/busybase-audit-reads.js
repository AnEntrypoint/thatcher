/*
 * BusyBase-backed audit READ API — replaces the SQLite audit-logger read functions.
 * busybase has no SQL GROUP BY / aggregates, so stats are computed in JS over the
 * audit_logs and permission_audit tables.
 */

import { list, create } from '@/lib/busybase-store.js';
import { genId, now } from '@/lib/id-helpers.js';

const parseJson = (val) => { try { return val ? JSON.parse(val) : null; } catch { return null; } };

const parsePermRow = (row) => row ? {
  ...row,
  old_permissions: parseJson(row.old_permissions),
  new_permissions: parseJson(row.new_permissions),
  metadata: parseJson(row.metadata),
  before_state: parseJson(row.before_state),
  after_state: parseJson(row.after_state),
} : null;

function ts(r) { return r.timestamp || r.created_at || 0; }

export async function getAuditHistory(filters = {}, page = 1, pageSize = 50) {
  const where = {};
  if (filters.entityType) where.entity_type = filters.entityType;
  if (filters.entityId) where.entity_id = filters.entityId;
  if (filters.userId) where.user_id = filters.userId;
  if (filters.action) where.action = filters.action;
  let rows = await list('audit_logs', where);
  if (filters.fromDate) rows = rows.filter(r => ts(r) >= filters.fromDate);
  if (filters.toDate) rows = rows.filter(r => ts(r) <= filters.toDate);
  rows.sort((a, b) => ts(b) - ts(a));
  const total = rows.length;
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map(i => ({
    id: i.id, entityType: i.entity_type, entityId: i.entity_id, action: i.action,
    userId: i.user_id, beforeState: parseJson(i.before_state), afterState: parseJson(i.after_state), createdAt: ts(i),
  }));
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getEntityAuditTrail(entityType, entityId) {
  const rows = (await list('audit_logs', { entity_type: entityType, entity_id: entityId })).sort((a, b) => ts(b) - ts(a));
  return rows.map(i => ({ id: i.id, action: i.action, userId: i.user_id, beforeState: parseJson(i.before_state), afterState: parseJson(i.after_state), createdAt: ts(i) }));
}

async function rangeStats(field, fromDate, toDate) {
  const rows = (await list('audit_logs', {})).filter(r => ts(r) >= fromDate && ts(r) <= toDate);
  const counts = {};
  for (const r of rows) { const k = r[field]; counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).map(([k, count]) => ({ [field]: k, count })).sort((a, b) => b.count - a.count);
}
export const getActionStats = (fromDate, toDate) => rangeStats('action', fromDate, toDate);
export const getUserStats = (fromDate, toDate) => rangeStats('user_id', fromDate, toDate);

export async function getPermissionAuditTrail({ entityType, entityId, userId, affectedUserId, limit = 100, offset = 0 }) {
  const where = {};
  if (entityType) where.entity_type = entityType;
  if (entityId) where.entity_id = entityId;
  if (userId) where.user_id = userId;
  if (affectedUserId) where.affected_user_id = affectedUserId;
  const rows = (await list('permission_audit', where)).sort((a, b) => ts(b) - ts(a));
  return rows.slice(offset, offset + limit).map(parsePermRow);
}

export async function getPermissionAuditById(auditId) {
  const rows = await list('permission_audit', { id: auditId });
  return parsePermRow(rows[0] || null);
}

export async function getPermissionAuditStats() {
  const rows = await list('permission_audit', {});
  const users = new Set(rows.map(r => r.user_id).filter(Boolean));
  const types = new Set(rows.map(r => r.entity_type).filter(Boolean));
  const times = rows.map(ts).filter(Boolean);
  return {
    total_audits: rows.length,
    unique_users: users.size,
    entity_types: types.size,
    earliest_change: times.length ? Math.min(...times) : null,
    latest_change: times.length ? Math.max(...times) : null,
  };
}

export async function getPermissionAuditBreakdown(field) {
  const rows = await list('permission_audit', {});
  const counts = {};
  for (const r of rows) { const k = r[field]; counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).map(([k, count]) => ({ [field]: k, count })).sort((a, b) => b.count - a.count);
}

export async function getPermissionAuditByDateRange(startDate, endDate, limit = 100) {
  const rows = (await list('permission_audit', {})).filter(r => ts(r) >= startDate && ts(r) <= endDate).sort((a, b) => ts(b) - ts(a));
  return rows.slice(0, limit).map(parsePermRow);
}

export async function searchPermissionAudit(searchTerm, limit = 100) {
  const q = String(searchTerm || '').toLowerCase();
  const rows = (await list('permission_audit', {}))
    .filter(r => [r.reason, r.entity_type, r.entity_id].some(v => String(v ?? '').toLowerCase().includes(q)))
    .sort((a, b) => ts(b) - ts(a));
  return rows.slice(0, limit).map(parsePermRow);
}

export async function exportPermissionAuditCSV(filters = {}) {
  const rows = await getPermissionAuditTrail({ ...filters, limit: 100000, offset: 0 });
  const cols = ['id', 'user_id', 'entity_type', 'entity_id', 'action', 'reason', 'reason_code', 'timestamp', 'affected_user_id'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = cols.join(',');
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(','));
  return [header, ...lines].join('\n');
}

export async function logPermissionChange({
  userId, entityType, entityId, action, oldPermissions = null, newPermissions = null,
  reason = null, reasonCode = 'other', affectedUserId = null, ipAddress = null, sessionId = null, metadata = null,
}) {
  if (!userId || !entityType || !entityId || !action) throw new Error('Missing required audit fields');
  const auditId = genId();
  const timestamp = now();
  await create('permission_audit', {
    id: auditId, user_id: userId, entity_type: entityType, entity_id: entityId, action,
    old_permissions: oldPermissions ? JSON.stringify(oldPermissions) : '',
    new_permissions: newPermissions ? JSON.stringify(newPermissions) : '',
    reason: reason || '', reason_code: reasonCode, timestamp, ip_address: ipAddress || '',
    session_id: sessionId || '', affected_user_id: affectedUserId || '',
    metadata: metadata ? JSON.stringify(metadata) : '', created_at: timestamp, updated_at: timestamp,
    created_by: userId, updated_by: userId,
  });
  return auditId;
}

// Pure diff (no DB) — kept here so consumers import everything audit-read from one place.
export function getPermissionDiff(oldPerms, newPerms) {
  const o = oldPerms || {}, n = newPerms || {};
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])];
  const changes = [];
  for (const k of keys) {
    const before = o[k], after = n[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field: k, before, after });
  }
  return changes;
}
