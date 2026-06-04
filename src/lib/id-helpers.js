/**
 * Pure ID / timestamp helpers — no DB dependency.
 *
 * Extracted from database-core.js so modules that need genId()/now() (e.g. the
 * busybase store) don't have to import database-core, which pulls in better-sqlite3.
 */

/** Generate a sortable-ish unique id (time prefix + random suffix). */
export function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Current Unix timestamp in seconds. */
export function now() {
  return Math.floor(Date.now() / 1000);
}
