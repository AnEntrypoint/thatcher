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
