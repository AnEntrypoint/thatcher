/**
 * Database Migrations - Custom SQL migrations and schema evolution
 * Runs after auto-migration completes
 */

/**
 * Run custom migrations
 * @param {object} db - better-sqlite3 database instance
 */
export function runMigrations(db) {
  // All migrations defined here are idempotent
  const migrations = [
    createTimestampTriggers,
    createActivityLogTable,
    createNotificationTable,
    createSessionsTable,
    createChatTables,
    createAuditLogsTable,
    createRfiTables,
    createPasswordResetTokensTable,
    addHighlightColumns,
    migrateRfiSectionTable,
    createSystemSettingsTable,
    createRecreationLogTable,
    createBugReportTable,
  ];

  for (const migration of migrations) {
    try {
      migration(db);
    } catch (err) {
      console.error('[Migration] Failed:', err.message);
    }
  }
}

/**
 * Create triggers to auto-update updated_at on row changes
 * @param {object} db
 */
function createTimestampTriggers(db) {
  const tables = ['users', 'engagements', 'rfis', 'reviews']; // Could be dynamic

  for (const table of tables) {
    try {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS set_timestamp_${table}
        AFTER UPDATE ON ${table}
        FOR EACH ROW
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `);
    } catch (e) {
      // Table might not exist yet
    }
  }
}

/**
 * Create activity_log table for audit trail
 * @param {object} db
 */
function createActivityLogTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      message TEXT,
      details TEXT,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)`);
}

/**
 * Create notification table
 * @param {object} db
 */
function createNotificationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      data TEXT,
      entity_type TEXT,
      entity_id TEXT,
      created_at INTEGER NOT NULL,
      read_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(user_id, read_at);
  `);
}

/**
 * Create sessions table (Lucia auth)
 * @param {object} db
 */
function createSessionsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

/**
 * Create chat tables (messages + mentions)
 * @param {object} db
 */
function createChatTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      rfi_id TEXT,
      user_id TEXT,
      content TEXT,
      attachments TEXT,
      reactions TEXT DEFAULT '{}',
      mentions TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      FOREIGN KEY (rfi_id) REFERENCES rfi(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_mentions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT,
      resolved BOOLEAN DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_rfi ON chat_messages(rfi_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_mentions_message ON chat_mentions(message_id);
    CREATE INDEX IF NOT EXISTS idx_chat_mentions_user ON chat_mentions(user_id);
  `);
}

/**
 * Create audit_logs table (before/after state audit trail)
 * Distinct from activity_log; preserved as an additive table.
 * @param {object} db
 */
function createAuditLogsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      before_state TEXT,
      after_state TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
  `);
}

/**
 * Create RFI tables (rfis, questions, responses)
 * @param {object} db
 */
function createRfiTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rfis (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (engagement_id) REFERENCES engagement(id)
    );

    CREATE TABLE IF NOT EXISTS rfi_questions (
      id TEXT PRIMARY KEY,
      rfi_id TEXT NOT NULL,
      question TEXT NOT NULL,
      category TEXT,
      assigned_to TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (rfi_id) REFERENCES rfis(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rfi_responses (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      response TEXT,
      attachments TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES rfi_questions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_rfis_engagement ON rfis(engagement_id);
    CREATE INDEX IF NOT EXISTS idx_rfis_status ON rfis(status);
    CREATE INDEX IF NOT EXISTS idx_rfi_questions_rfi ON rfi_questions(rfi_id);
    CREATE INDEX IF NOT EXISTS idx_rfi_questions_status ON rfi_questions(status);
    CREATE INDEX IF NOT EXISTS idx_rfi_responses_question ON rfi_responses(question_id);
  `);
}

/**
 * Create password_reset_tokens table
 * @param {object} db
 */
function createPasswordResetTokensTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
  `);
}

/**
 * Add flags/tags columns to highlight table (idempotent — ignores duplicate-column error)
 * @param {object} db
 */
function addHighlightColumns(db) {
  for (const col of ['flags', 'tags']) {
    try {
      db.exec(`ALTER TABLE highlight ADD COLUMN ${col} TEXT`);
    } catch (e) {
      // Column already exists or table not present yet
    }
  }
}

/**
 * Rebuild rfi_section table if it lacks an id column (legacy shape)
 * @param {object} db
 */
function migrateRfiSectionTable(db) {
  let cols = [];
  try {
    cols = db.prepare('PRAGMA table_info(rfi_section)').all().map(c => c.name);
  } catch (e) {
    return;
  }
  if (!cols.includes('id')) {
    db.exec(`DROP TABLE IF EXISTS rfi_section`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS rfi_section (
        id TEXT PRIMARY KEY,
        engagement_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER,
        FOREIGN KEY (engagement_id) REFERENCES engagement(id)
      );
      CREATE INDEX IF NOT EXISTS idx_rfi_section_engagement ON rfi_section(engagement_id);
    `);
  }
}

/**
 * Create system_settings key/value table
 * @param {object} db
 */
function createSystemSettingsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER
    );
  `);
}

/**
 * Create recreation_log table
 * @param {object} db
 */
function createRecreationLogTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recreation_log (
      id TEXT PRIMARY KEY,
      engagement_id TEXT,
      client_id TEXT,
      engagement_type_id TEXT,
      status TEXT,
      details TEXT,
      error TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recreation_log_created ON recreation_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_recreation_log_status ON recreation_log(status);
  `);
}

/**
 * Create bug_report table
 * @param {object} db
 */
function createBugReportTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bug_report (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      summary TEXT,
      description TEXT,
      url TEXT,
      user_agent TEXT,
      viewport TEXT,
      status TEXT DEFAULT 'open',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bug_report_created ON bug_report(created_at);
  `);
}
