/**
 * Core constants for Thatcher SDK
 * HTTP codes, status values, display limits, etc.
 */

/**
 * HTTP status codes
 */
export const HTTP = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Error message templates
 */
export const ERROR_MESSAGES = {
  notFound: (entity = 'Resource') => `${entity} not found`,
  invalidRequest: (reason = 'Invalid request') => reason,
  operationFailed: (operation = 'Operation') => `${operation} failed`,
  permission: {
    denied: 'Permission denied',
  },
};

/**
 * Success message templates
 */
export const SUCCESS_MESSAGES = {
  created: (entity = 'Item') => `${entity} created successfully`,
  updated: (entity = 'Item') => `${entity} updated successfully`,
  deleted: (entity = 'Item') => `${entity} deleted successfully`,
  saved: 'Changes saved successfully',
};

/**
 * Record status constants
 */
export const RECORD_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
  ARCHIVED: 'archived',
};

/**
 * Email status
 */
export const EMAIL_STATUS = 'pending';

/**
 * Display/UI constants
 */
export const DISPLAY = {
  MAX_API_CALLS_HISTORY: 100,
  API_TIMEOUT_MS: 30000,
  POLLING_INTERVAL_MS: 2000,
  MAX_INLINE_ITEMS: 5,
  MAX_UPLOAD_SIZE_MB: 100,
  MAX_FILE_NAME_LENGTH: 255,
  MAX_FIELD_NAME_LENGTH: 100,
  TOAST_DURATION_MS: 3000,
  MAX_NOTIFICATIONS: 50,
  DEBOUNCE_SEARCH_MS: 300,
  DEBOUNCE_FORM_CHANGE_MS: 500,
};

/**
 * Validation patterns
 */
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
};

/**
 * Log prefixes for structured logging
 */
export const LOG_PREFIXES = {
  API: '[API]',
  DB: '[DB]',
  AUTH: '[AUTH]',
  CONFIG: '[Config]',
  SERVICE: '[Service]',
  system: '[System]',
  email: '[Email]',
  validation: '[Validation]',
  database: '[DB]',
};

/**
 * SQL type mapping
 */
export const SQL_TYPES = {
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

/**
 * Authentication scopes (Google, etc.)
 */
export const AUTH_SCOPES = {
  google: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};
