// NOTE (repo audit, 2026-07-16): this barrel and every module it wires together
// (promise-container, supervisor, checkpoint, timeout-wrapper, safe-error,
// cache-invalidator, directory-watcher, debug-exposure) has NO importer anywhere
// in the repo -- grepped for `hot-reload`, `@/lib/hot-reload`, and each filename
// individually across src/, bin/, scripts/, server-bootstrap.js, cli.js. This
// index.js is never imported, so `expose('hotReload', ...)` and the unconditional
// `globalThis.__debug__` assignment in debug-exposure.js never actually fire.
// None of these files gate on NODE_ENV or any dev-only flag internally (the one
// NODE_ENV check in route-wrapper.js only toggles whether a stack trace is
// included in an error body, not whether the module runs) -- so "dev-mode-only"
// is not enforced by this code, it is simply unreferenced.
//
// The ONE exception is mutex.js: `globalManager` is imported directly (bypassing
// this barrel) by src/app/api/auth/google/route.js and
// src/app/api/auth/google/callback/route.js to lock an OAuth token-refresh
// critical section -- a genuinely generic, domain-free primitive with no
// hot-reload-specific coupling, and it is live production code.
//
// Collapse decision: did NOT merge cache-invalidator.js/directory-watcher.js/
// supervisor.js. Since none of the three (nor checkpoint.js, debug-exposure.js,
// route-wrapper.js, promise-container.js, safe-error.js, timeout-wrapper.js) has
// a single live call site, merging them carries real risk (losing individually
// resumable git history, plus this index.js barrel still exports all of them by
// name so any future consumer added via this barrel would need the merge
// un-done) for zero runtime benefit -- there is nothing executing today to make
// faster, safer, or smaller. Generic/extractable-if-ever-needed: mutex.js (already
// proven generic by its live OAuth use), promise-container.js, timeout-wrapper.js,
// safe-error.js -- each is domain-free with no hot-reload-specific coupling.
// Hot-reload-coupled and not generic: cache-invalidator.js (require.cache
// invalidation), directory-watcher.js (fs.watch tree), debug-exposure.js
// (globalThis.__debug__ registry) -- these only make sense together as a dev
// hot-reload feature, but since nothing invokes them, no risky structural
// change was forced. Left as-is, working code, simply dormant.

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const promiseContainerMod = require('./promise-container.js');
export { Mutex, MutexManager, globalManager } from './mutex.js';
import { Supervisor, SupervisorTree, globalTree } from './supervisor.js';
const checkpointMod = require('./checkpoint.js');
const timeoutMod = require('./timeout-wrapper.js');
const safeErrorMod = require('./safe-error.js');
const cacheInvalidatorMod = require('./cache-invalidator.js');
const directoryWatcherMod = require('./directory-watcher.js');
const routeWrapperMod = require('./route-wrapper.js');
const debugExposureMod = require('./debug-exposure.js');

const { PromiseContainer, globalContainer, contain } = promiseContainerMod;

const { CheckpointManager, globalCheckpoint } = checkpointMod;
const { TimeoutError, withTimeout, withAbortableTimeout, retry } = timeoutMod;
const { safeError, safeStringify } = safeErrorMod;
const { CacheInvalidator, globalInvalidator } = cacheInvalidatorMod;
const { DirectoryWatcher, globalWatcher } = directoryWatcherMod;
const { wrapRouteHandler, wrapRouteHandlers } = routeWrapperMod;
const { DebugExposure, globalDebug, expose } = debugExposureMod;

expose('hotReload', {
  promises: globalContainer,
  mutexes: globalManager,
  supervisors: globalTree,
  checkpoints: globalCheckpoint,
  cache: globalInvalidator,
  watcher: globalWatcher,
  debug: globalDebug
}, 'Hot reload infrastructure');

export {
  PromiseContainer, globalContainer, contain,
  Supervisor, SupervisorTree, globalTree,
  CheckpointManager, globalCheckpoint,
  TimeoutError, withTimeout, withAbortableTimeout, retry,
  safeError, safeStringify,
  CacheInvalidator, globalInvalidator,
  DirectoryWatcher, globalWatcher,
  wrapRouteHandler, wrapRouteHandlers,
  DebugExposure, globalDebug, expose
};
