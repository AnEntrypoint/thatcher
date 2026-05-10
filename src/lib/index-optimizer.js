import { getDatabase } from '@/lib/database-core';

const COMPOSITE_INDEXES = [
  { name: 'idx_engagement_client_stage', table: 'engagement', columns: ['client_id', 'stage'], where: "status != 'deleted'" },
  { name: 'idx_engagement_status_created', table: 'engagement', columns: ['status', 'created_at'] },
  { name: 'idx_engagement_stage_created', table: 'engagement', columns: ['stage', 'created_at'] },
  { name: 'idx_rfi_engagement_client_status', table: 'rfi', columns: ['engagement_id', 'client_status'] },
  { name: 'idx_rfi_engagement_auditor_status', table: 'rfi', columns: ['engagement_id', 'auditor_status'] },
  { name: 'idx_rfi_engagement_status', table: 'rfi', columns: ['engagement_id', 'status'] },
  { name: 'idx_users_client_role', table: 'users', columns: ['client_id', 'role', 'status'] },
  { name: 'idx_users_email_active', table: 'users', columns: ['email'], where: "status = 'active'" },
  { name: 'idx_users_type_status', table: 'users', columns: ['type', 'status'] },
  { name: 'idx_sessions_expires', table: 'sessions', columns: ['expires_at'] },
  { name: 'idx_sessions_user_expires', table: 'sessions', columns: ['user_id', 'expires_at'] },
  { name: 'idx_audit_composite', table: 'audit_logs', columns: ['entity_type', 'entity_id', 'created_at'] },
  { name: 'idx_audit_user_created', table: 'audit_logs', columns: ['user_id', 'created_at'] },
  { name: 'idx_email_status_created', table: 'email', columns: ['status', 'created_at'] },
  { name: 'idx_email_recipient', table: 'email', columns: ['recipient_email', 'created_at'] },
  { name: 'idx_rfi_questions_rfi_status', table: 'rfi_questions', columns: ['rfi_id', 'status'] },
  { name: 'idx_rfi_questions_assigned', table: 'rfi_questions', columns: ['assigned_to', 'status'] },
  { name: 'idx_chat_messages_rfi_created', table: 'chat_messages', columns: ['rfi_id', 'created_at'] },
  { name: 'idx_chat_mentions_user_resolved', table: 'chat_mentions', columns: ['user_id', 'resolved'] },
  { name: 'idx_password_reset_expires', table: 'password_reset_tokens', columns: ['expires_at', 'used'] }
];

const indexExists = (db, indexName) => {
  try {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(indexName);
    return !!result;
  } catch {
    return false;
  }
};

export const createOptimizedIndexes = () => {
  const db = getDatabase();
  const created = [];
  const skipped = [];
  const errors = [];

  for (const idx of COMPOSITE_INDEXES) {
    if (indexExists(db, idx.name)) {
      skipped.push(idx.name);
      continue;
    }

    try {
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(idx.table);
      if (!tableExists) {
        skipped.push(`${idx.name} (table ${idx.table} not found)`);
        continue;
      }

      const columns = idx.columns.map(c => `"${c}"`).join(', ');
      const wherePart = idx.where ? ` WHERE ${idx.where}` : '';
      const sql = `CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${idx.table}"(${columns})${wherePart}`;

      db.exec(sql);
      created.push(idx.name);
    } catch (e) {
      errors.push({ index: idx.name, error: e.message });
    }
  }

  return { created, skipped, errors, total: COMPOSITE_INDEXES.length };
};

export const analyzeQuery = (sql) => {
  const db = getDatabase();
  try {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    return plan;
  } catch (e) {
    return [{ error: e.message }];
  }
};

export const getIndexUsage = () => {
  const db = getDatabase();
  try {
    const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name").all();
    return indexes;
  } catch {
    return [];
  }
};

export const optimizeDatabase = () => {
  const db = getDatabase();
  try {
    db.exec('ANALYZE');
    return { status: 'success', message: 'Database statistics updated' };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
};
