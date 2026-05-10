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
