import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'app.db');
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

export function createBackup(options = {}) {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;
  const backupDir = options.backupDir || DEFAULT_BACKUP_DIR;
  const label = options.label || 'backup';

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `app-${label}-${timestamp}.db`);

  const db = new Database(dbPath);
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, backupPath);
  } finally {
    db.close();
  }

  const sourceSize = fs.statSync(dbPath).size;
  const backupSize = fs.statSync(backupPath).size;

  if (sourceSize !== backupSize) {
    throw new Error(`Backup size mismatch: source=${sourceSize}, backup=${backupSize}`);
  }

  return { path: backupPath, size: backupSize, timestamp };
}

export function restoreBackup(backupPath, options = {}) {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  const verifyDb = new Database(backupPath, { readonly: true });
  try {
    const result = verifyDb.pragma('integrity_check');
    if (result[0]?.integrity_check !== 'ok') {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(result)}`);
    }
  } finally {
    verifyDb.close();
  }

  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';

  fs.copyFileSync(backupPath, dbPath);
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  return { restored: true, from: backupPath, to: dbPath };
}

export function listBackups(options = {}) {
  const backupDir = options.backupDir || DEFAULT_BACKUP_DIR;

  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.db') && f.startsWith('app-'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      size: fs.statSync(path.join(backupDir, f)).size,
      created: fs.statSync(path.join(backupDir, f)).mtime,
    }))
    .sort((a, b) => b.created - a.created);
}

export function pruneBackups(options = {}) {
  const maxBackups = options.maxBackups || 10;
  const backups = listBackups(options);

  if (backups.length <= maxBackups) return { pruned: 0 };

  const toDelete = backups.slice(maxBackups);
  for (const backup of toDelete) {
    fs.unlinkSync(backup.path);
  }

  return { pruned: toDelete.length };
}
