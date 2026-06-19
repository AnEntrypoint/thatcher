/*
 * BusyBase-backed audit log — async replacement for the better-sqlite3 audit-logger's
 * logAction(). Writes an audit_logs document through the busybase store.
 *
 * Audit logging must never break the request it records, so logAction is fire-and-
 * forget: it returns immediately and swallows/logs write errors rather than throwing.
 */

import { createLogger } from './logger.js';
import { genId, now } from './id-helpers.js';

const log = createLogger('[BusyBaseAudit]');

let _client = null;

// Wire the busybase client (same instance as the store). Called at bootstrap.
export function setBusyBaseClient(client) {
  _client = client;
}

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
      .catch(err => log.error('logAction failed:', { message: err?.message || String(err) }));
  }
  return { id, timestamp };
}
