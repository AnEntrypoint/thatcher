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
  };
}
