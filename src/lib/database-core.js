/**
 * Database Core - SQLite initialization and schema management
 * Adapted from moonlanding/src/lib/database-core.js
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const SQL_TYPES = {
  id: 'TEXT PRIMARY KEY',
  text: 'TEXT',
  textarea: 'TEXT',
  email: 'TEXT',
  int: 'INTEGER',
  decimal: 'REAL',
  bool: 'INTEGER',
  date: 'INTEGER',
  timestamp: 'INTEGER',
  json: 'TEXT',
  image: 'TEXT',
  ref: 'TEXT',
  enum: 'TEXT',
};

let db = null;
let migrationComplete = false;
const moduleCache = new Map();

/**
 * Get or create database instance
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Database} better-sqlite3 database instance
 */
export function getDatabase(dbPath = null) {
  if (db && !dbPath) return db;

  const DB_PATH = dbPath || path.resolve(process.cwd(), 'data', 'app.db');
  const dataDir = path.dirname(DB_PATH);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  const BUSY_TIMEOUT_MS = process.env.DATABASE_BUSY_TIMEOUT_MS || '5000';
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('auto_vacuum = INCREMENTAL');

  return db;
}

/**
 * Generate unique ID using nanoid-like algorithm
 * @returns {string}
 */
export function genId() {
  // Simple but effective ID generation
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Get current Unix timestamp (seconds)
 * @returns {number}
 */
export function now() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Build column definition from field spec
 * @param {string} key - Field name
 * @param {object} field - Field definition
 * @returns {string} SQL column definition
 */
function buildColumnDef(key, field) {
  let col = `"${key}" ${SQL_TYPES[field.type] || 'TEXT'}`;

  if (field.required && field.type !== 'id') {
    col += ' NOT NULL';
  }

  if (field.unique) {
    col += ' UNIQUE';
  }

  if (field.default !== undefined) {
    if (typeof field.default === 'string' || typeof field.default === 'number' || typeof field.default === 'boolean') {
      const defaultVal = typeof field.default === 'string'
        ? `'${field.default.replace(/'/g, "''")}'`
        : field.default;
      col += ` DEFAULT ${defaultVal}`;
    }
  }

  return col;
}

/**
 * Run migrations to create/update tables from entity specs
 * @param {object} configEngine - Config engine with entity specs
 */
export function migrate(configEngine) {
  if (migrationComplete) return;

  const dbInstance = getDatabase();
  let specsToUse = {};

  try {
    const allEntities = configEngine.getAllEntities();
    for (const entityName of allEntities) {
      specsToUse[entityName] = configEngine.generateEntitySpec(entityName);
    }
  } catch (e) {
    console.error('[Database] Failed to get specs from ConfigEngine during migration:', e.message);
    return;
  }

  // Create tables
  for (const spec of Object.values(specsToUse)) {
    if (!spec) continue;

    const tableName = spec.name === 'user' ? 'users' : spec.name;
    const columns = [];
    const foreignKeys = [];

    // Build columns from fields
    for (const [key, field] of Object.entries(spec.fields || {})) {
      columns.push(buildColumnDef(key, field));

      if (field.type === 'ref' && field.ref) {
        const refTable = field.ref === 'user' ? 'users' : field.ref;
        foreignKeys.push(`FOREIGN KEY ("${key}") REFERENCES "${refTable}"(id)`);
      }
    }

    const fkPart = foreignKeys.length ? (',\n' + foreignKeys.join(',\n')) : '';
    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(',\n')}${fkPart})`;

    try {
      dbInstance.exec(sql);
    } catch (e) {
      console.error(`[Database] Table creation failed for ${tableName}:`, e.message, '\nSQL:', sql);
      throw e;
    }

    // Add new columns (ALTER TABLE for schema evolution)
    try {
      const existingCols = new Set(
        dbInstance.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name)
      );

      for (const [key, field] of Object.entries(spec.fields || {})) {
        if (!existingCols.has(key)) {
          let colType = SQL_TYPES[field.type] || 'TEXT';
          let alterSql = `ALTER TABLE "${tableName}" ADD COLUMN "${key}" ${colType}`;

          if (field.default !== undefined && (typeof field.default === 'string' || typeof field.default === 'number' || typeof field.default === 'boolean')) {
            const defaultVal = typeof field.default === 'string'
              ? `'${field.default.replace(/'/g, "''")}'`
              : field.default;
            alterSql += ` DEFAULT ${defaultVal}`;
          }

          dbInstance.exec(alterSql);
        }
      }
    } catch (e) {
      console.error(`[Database] Column migration failed for ${tableName}:`, e.message);
    }
  }

  // Create indexes
  for (const spec of Object.values(specsToUse)) {
    if (!spec) continue;

    const tableName = spec.name === 'user' ? 'users' : spec.name;
    const searchFields = [];

    for (const [key, field] of Object.entries(spec.fields || {})) {
      if (field.type === 'ref' || field.sortable || field.search) {
        try {
          dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${key} ON "${tableName}"("${key}")`);
        } catch (e) {
          console.error(`[Database] Index creation failed for ${tableName}.${key}:`, e.message);
        }
      }

      if (field.search || key === 'name' || key === 'description') {
        searchFields.push(`"${key}"`);
      }
    }

    // Create FTS virtual table for search
    if (searchFields.length > 0) {
      try {
        dbInstance.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName}_fts USING fts5(${searchFields.join(', ')}, content="${tableName}", content_rowid=id)`);
      } catch (e) {
        console.error(`[Database] FTS table creation failed for ${tableName}:`, e.message);
      }
    }
  }

  // Run additional migrations
  runCustomMigrations(dbInstance, specsToUse);

  migrationComplete = true;
}

/**
 * Run custom migration logic (triggers, data migrations, etc.)
 * @param {Database} dbInstance
 * @param {object} specs
 */
function runCustomMigrations(dbInstance, specs) {
  // Placeholder for custom migration logic
  // Can be extended via plugins
  try {
    // Create triggers for updated_at timestamps
    for (const entityName of Object.keys(specs)) {
      const tableName = entityName === 'user' ? 'users' : entityName;
      // Add timestamp triggers if needed
    }
  } catch (e) {
    console.error('[Database] Custom migrations failed:', e.message);
  }
}

/**
 * Ensure database is initialized (lazy migration)
 */
export function ensureInitialized(configEngine) {
  if (!migrationComplete) {
    migrate(configEngine);
  }
}

/**
 * Reset database (for testing)
 */
export function resetDatabase() {
  const DB_PATH = path.resolve(process.cwd(), 'data', 'app.db');
  try {
    if (db) db.close();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
    if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
    db = null;
    migrationComplete = false;
  } catch (e) {
    console.error('[Database] Reset failed:', e.message);
  }
}

export { SQL_TYPES };
