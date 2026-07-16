import { createLogger } from '../logger.js';

// AppError stays a real class (base error type; `instanceof AppError` works).
export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', status = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

// The specific error types are exported as FACTORY FUNCTIONS, not classes, so
// both `throw UnauthorizedError(x)` (the style moonlanding and ~17 callsites in
// this repo use) and a plain call work. A derived `class X extends AppError`
// cannot be invoked without `new` at all (the engine throws before the body, so
// a new.target guard does not help) — a factory is the portable fix. Each
// returns an AppError instance, so `instanceof AppError` still holds in catch.
export function UnauthorizedError(message = 'Authentication required') {
  const e = new AppError(message, 'UNAUTHORIZED', 401); e.name = 'UnauthorizedError'; return e;
}
export function PermissionError(message = 'Permission denied') {
  const e = new AppError(message, 'PERMISSION_DENIED', 403); e.name = 'PermissionError'; return e;
}
export function NotFoundError(entity = 'Resource', id = null) {
  const msg = id ? `${entity} with id ${id} not found` : `${entity} not found`;
  const e = new AppError(msg, 'NOT_FOUND', 404); e.name = 'NotFoundError'; e.entity = entity; e.id = id; return e;
}
export function ValidationError(message = 'Validation failed', errors = {}) {
  const e = new AppError(message, 'VALIDATION_ERROR', 422); e.name = 'ValidationError'; e.errors = errors; return e;
}
export function DatabaseError(operation = 'Database operation', originalError = null) {
  const e = new AppError(`Database ${operation} failed: ${originalError?.message || 'unknown error'}`, 'DATABASE_ERROR', 500);
  e.name = 'DatabaseError'; e.originalError = originalError; return e;
}
export function ConflictError(message = 'Resource already exists') {
  const e = new AppError(message, 'CONFLICT', 409); e.name = 'ConflictError'; return e;
}
export function BadRequestError(message = 'Invalid request') {
  const e = new AppError(message, 'BAD_REQUEST', 400); e.name = 'BadRequestError'; return e;
}

export function createErrorLogger(context = '') {
  const log = createLogger(`[${context}]`);
  return { error: log.error, warn: log.warn, info: (_msg, _meta = {}) => {}, debug: log.debug };
}

// Ported from moonlanding; kept import-free so this module loads under the plain-node test runner.
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

// Ported from moonlanding.
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
