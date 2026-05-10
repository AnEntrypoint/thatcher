/**
 * Structured Logger - Consistent logging across the SDK
 * Simple wrapper with prefix support
 */

const LOG_PREFIXES = {
  API: '[API]',
  DB: '[DB]',
  AUTH: '[AUTH]',
  CONFIG: '[Config]',
  SERVICE: '[Service]',
  system: '[System]',
  email: '[Email]',
  validation: '[Validation]',
  database: '[DB]',
  hook: '[Hook]',
  workflow: '[Workflow]',
};

/**
 * Create a logger with prefix
 * @param {string} prefix - Log prefix (from LOG_PREFIXES or custom)
 * @returns {object} Logger with methods
 */
export function createLogger(prefix) {
  const logger = {
    error: (msg, meta = {}) => {
      console.error(`${prefix} ${msg}`, meta);
    },
    warn: (msg, meta = {}) => {
      console.warn(`${prefix} ${msg}`, meta);
    },
    info: (msg, meta = {}) => {
      console.info(`${prefix} ${msg}`, meta);
    },
    debug: (msg, meta = {}) => {
      if (process.env.DEBUG === 'true') {
        console.debug(`${prefix} ${msg}`, meta);
      }
    },
  };

  return logger;
}

/**
 * Get prefixed logger
 * @param {string} key - Key from LOG_PREFIXES
 * @returns {object}
 */
export function getLogger(key) {
  return createLogger(LOG_PREFIXES[key] || `[${key.toUpperCase()}]`);
}

export { LOG_PREFIXES };
