/**
 * Query Engine - Write operations (create, update, delete)
 * Adapted from moonlanding/src/lib/query-engine-write.js
 */

import { getDatabase } from './database-core.js';
import { getSpec } from '../config/spec-helpers.js';
import { RECORD_STATUS } from '../config/constants.js';
import { now, genId } from './database-core.js';
import { executeHook } from './hook-engine.js';
import { broadcastUpdate } from './realtime-server.js'; // Optional
import { createLogger } from './logger.js';
import { getConfigEngineSync } from './config-generator-engine.js';

const db = getDatabase();
const logger = createLogger('[WriteEngine]');

/**
 * Create a new record
 * @param {string} entity - Entity name
 * @param {object} data - Record data
 * @param {object} user - User performing the action
 * @returns {object} Created record
 */
export function create(entity, data, user) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);

  const tableName = entity === 'user' ? 'users' : entity;
  const record = {
    ...data,
    id: genId(),
    created_by: user?.id || null,
    created_at: now(),
    updated_at: null,
    status: data.status || RECORD_STATUS.ACTIVE,
  };

  // Auto fields and field coercion
  for (const [key, field] of Object.entries(spec.fields || {})) {
    if (field.auto === 'increment') {
      // Get max + 1 (simplified)
      const maxRow = db.prepare(`SELECT MAX("${key}") as max FROM "${tableName}"`).get();
      record[key] = (maxRow?.max || 0) + 1;
    }
    if (field.auto === 'uuid' && !record[key]) {
      record[key] = genId();
    }
    if (field.auto === 'timestamp' && !record[key]) {
      record[key] = now();
    }
  }

  // Build INSERT
  const columns = Object.keys(record).filter(k => record[k] !== undefined);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => record[k]);

  const sql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;

  try {
    const info = db.prepare(sql).run(...values);
    record.id = info.lastInsertRowid ? String(info.lastInsertRowid) : record.id;
  } catch (e) {
    logger.error(`Create ${entity} failed`, { error: e.message, data: record });
    throw new Error(`Failed to create ${entity}: ${e.message}`);
  }

  // Execute hooks
  executeHook(`create:${entity}:after`, {
    entity,
    id: record.id,
    data: record,
    user,
  }).catch(err => logger.error('create hook error', err));

  return record;
}

/**
 * Update an existing record
 * @param {string} entity
 * @param {string|number} id
 * @param {object} data - Fields to update
 * @param {object} user - User performing the action
 * @returns {object} Updated record
 */
export function update(entity, id, data, user) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);

  const tableName = entity === 'user' ? 'users' : entity;

  // Fetch existing record
  const existing = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(id);
  if (!existing) {
    throw new Error(`${entity} with id ${id} not found`);
  }

  const updateData = {
    ...data,
    updated_at: now(),
  };

  // Build UPDATE statement
  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      setClauses.push(`"${key}" = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    return existing; // Nothing to update
  }

  values.push(id);
  const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE id = ?`;

  try {
    db.prepare(sql).run(...values);
  } catch (e) {
    logger.error(`Update ${entity} ${id} failed`, { error: e.message, data: updateData });
    throw new Error(`Failed to update ${entity}: ${e.message}`);
  }

  // Fetch updated record
  const updated = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(id);

  // Execute hooks
  executeHook(`update:${entity}:after`, {
    entity,
    id,
    data: updated,
    before: existing,
    after: updated,
    user,
  }).catch(err => logger.error('update hook error', err));

  return updated;
}

/**
 * Delete (soft delete) a record
 * @param {string} entity
 * @param {string|number} id
 * @param {object} user - User performing the action
 * @returns {object} Deleted record
 */
export function remove(entity, id) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);

  const tableName = entity === 'user' ? 'users' : entity;

  const existing = db.prepare(`SELECT * FROM "${tableName}" WHERE id = ?`).get(id);
  if (!existing) {
    throw new Error(`${entity} with id ${id} not found`);
  }

  const hasStatus = spec.fields && 'status' in spec.fields;
  const hasArchived = spec.fields && 'archived' in spec.fields;

  let result;

  if (hasStatus) {
    // Soft delete
    const sql = `UPDATE "${tableName}" SET status = ?, updated_at = ? WHERE id = ?`;
    db.prepare(sql).run(RECORD_STATUS.DELETED, now(), id);
    result = { ...existing, status: RECORD_STATUS.DELETED };
  } else if (hasArchived) {
    // Archive instead
    const sql = `UPDATE "${tableName}" SET archived = 1, updated_at = ? WHERE id = ?`;
    db.prepare(sql).run(now(), id);
    result = { ...existing, archived: 1 };
  } else {
    // Hard delete
    const sql = `DELETE FROM "${tableName}" WHERE id = ?`;
    db.prepare(sql).run(id);
    result = existing;
  }

  // Execute hooks
  executeHook(`delete:${entity}:after`, {
    entity,
    id,
    data: result,
    user,
  }).catch(err => logger.error('delete hook error', err));

  return result;
}

/**
 * Bulk create multiple records
 * @param {string} entity
 * @param {Array<object>} records
 * @param {object} user
 * @returns {Array} Created records
 */
export function bulkCreate(entity, records, user) {
  return db.transaction((recordsData) => {
    return recordsData.map(data => create(entity, data, user));
  })(records);
}

/**
 * Hard delete all records (for cleanup)
 * @param {string} entity
 */
export function hardDeleteAll(entity) {
  const spec = getSpec(entity);
  if (!spec) throw new Error(`Entity not found: ${entity}`);

  const tableName = entity === 'user' ? 'users' : entity;
  const sql = `DELETE FROM "${tableName}"`;
  db.prepare(sql).run();
}
