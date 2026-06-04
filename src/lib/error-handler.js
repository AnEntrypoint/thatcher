/**
 * Error Handling - Centralized error types and utilities
 */

export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', status = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 'PERMISSION_DENIED', 403);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Resource', id = null) {
    const msg = id ? `${entity} with id ${id} not found` : `${entity} not found`;
    super(msg, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    this.entity = entity;
    this.id = id;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = {}) {
    super(message, 'VALIDATION_ERROR', 422);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class DatabaseError extends AppError {
  constructor(operation = 'Database operation', originalError = null) {
    super(`Database ${operation} failed: ${originalError?.message || 'unknown error'}`, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 'BAD_REQUEST', 400);
    this.name = 'BadRequestError';
  }
}

/**
 * Create an error logger
 * @param {string} context
 * @returns {object}
 */
export function createErrorLogger(context = '') {
  return {
    error: (msg, meta = {}) => {
      console.error(`[${context}] ${msg}`, meta);
    },
    warn: (msg, meta = {}) => {
      console.warn(`[${context}] ${msg}`, meta);
    },
    info: (_msg, _meta = {}) => {},
    debug: (msg, meta = {}) => {
      if (process.env.DEBUG) {
        console.debug(`[${context}] Debug:`, msg, meta);
      }
    },
  };
}

/**
 * Normalize an arbitrary thrown value into one of thatcher's AppError-class
 * instances. AppError instances (and anything already shaped like one — a
 * numeric `status` + a `code`) pass through untouched; common low-level
 * errors are mapped to the appropriate thatcher error class.
 *
 * (Ported from moonlanding, adapted to thatcher's class-based hierarchy and
 * its `status`/`code`/`details` shape. Kept import-free so the module stays
 * loadable under the plain-node test runner.)
 * @param {unknown} error
 * @returns {AppError}
 */
export function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error && typeof error === 'object' && typeof error.status === 'number' && error.code) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new BadRequestError('Invalid request format');
  }

  if (error instanceof TypeError) {
    return new AppError('Invalid operation', 'TYPE_ERROR', 400, { originalMessage: error.message });
  }

  const message = error && error.message ? String(error.message) : '';

  if (message.includes('database is locked')) {
    return new DatabaseError('operation', error);
  }

  if (message.includes('UNIQUE constraint failed')) {
    const field = message.match(/UNIQUE constraint failed: (.+)/)?.[1] || 'record';
    return new ConflictError(`${field} already exists`);
  }

  return new AppError(message || 'An unexpected error occurred', 'INTERNAL_ERROR', 500, {
    originalMessage: message,
    stack: error && error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : undefined,
  });
}

/**
 * Build a JSON-serializable error response body from any thrown value.
 * (Ported from moonlanding, adapted to thatcher's error shape.)
 * @param {unknown} error
 * @param {boolean} [includeStack=false]
 * @returns {object}
 */
export function formatErrorResponse(error, includeStack = false) {
  const normalized = normalizeError(error);
  const response = {
    status: 'error',
    message: normalized.message,
    code: normalized.code,
    statusCode: normalized.status,
  };

  if (normalized.details) response.details = normalized.details;
  if (normalized.errors) response.errors = normalized.errors;

  if (includeStack && error && error.stack) {
    response.stack = error.stack.split('\n').slice(0, 5);
  }

  return response;
}
