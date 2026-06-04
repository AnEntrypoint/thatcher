/**
 * BusyBase-backed audit log — async replacement for the better-sqlite3 audit-logger's
 * logAction(). Writes an audit_logs document through the busybase store.
 *
 * Audit logging must never break the request it records, so logAction is fire-and-
 * forget: it returns immediately and swallows/logs write errors rather than throwing.
 */

import { genId, now } from './id-helpers.js';

let _client = null;

/** Wire the busybase client (same instance as the store). Called at bootstrap. */
export function setBusyBaseClient(client) {
  _client = client;
}

/**
 * Record an entity mutation. Fire-and-forget: does not block or throw into the caller.
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} action - create | update | delete | archive | ...
 * @param {string|null} userId
 * @param {object|null} beforeState
 * @param {object|null} afterState
 */
export function logAction(entityType, entityId, action, userId, beforeState, afterState) {
  const id = genId();
  const timestamp = now();
  // LanceDB infers column types from values and cannot type an all-null column on the
  // first insert, so use '' (typed string) instead of null for optional text columns.
  const row = {
    id,
    entity_type: entityType,
    entity_id: String(entityId),
    action,
    user_id: userId || '',
    before_state: beforeState ? JSON.stringify(beforeState) : '',
    after_state: afterState ? JSON.stringify(afterState) : '',
    created_at: timestamp,
  };
  if (_client) {
    Promise.resolve(_client.from('audit_logs').insert(row))
      .catch(err => console.error('[BusyBaseAudit] logAction failed:', err?.message || err));
  }
  return { id, timestamp };
}
