// Previously `@/engine` resolved to a non-existent module; this barrel makes it
// concrete and points the data layer at busybase-store.

// Data layer (busybase)
export {
  list, get, getBy, count, listWithPagination, searchWithPagination, search,
  create, update, remove, bulkCreate, getChildren, batchGetChildren,
  setBusyBaseClient,
} from '@/lib/busybase-store.js';

// IDs / time
export { genId, now } from '@/lib/id-helpers.js';

// Auth helpers
export { hashPassword, verifyPassword } from '@/engine.server.js';

// Audit
export { logAction } from '@/lib/busybase-audit.js';

// Legacy SQLite shims (data layer is busybase now). busybase is schemaless so there
// is no migration step; migrate() is a no-op kept for callers that still invoke it.
export function migrate() { /* no-op: busybase creates tables lazily on first insert */ }

