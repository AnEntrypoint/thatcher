import { HTTP } from '@/config/constants';

export class AppError extends Error {
  constructor(message, code = 'ERROR', statusCode = HTTP.INTERNAL_ERROR, context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }

  toJSON() {
    return {
      status: 'error',
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = {}) {
    super(message, 'VALIDATION_ERROR', HTTP.BAD_REQUEST);
    this.errors = errors;
  }

  toJSON() {
    return {
      status: 'error',
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      errors: this.errors,
      context: this.context,
    };
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', HTTP.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 'FORBIDDEN', HTTP.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', HTTP.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT', HTTP.CONFLICT);
  }
}

export class ServerError extends AppError {
  constructor(message = 'Server error', code = 'SERVER_ERROR') {
    super(message, code, HTTP.INTERNAL_ERROR);
  }
}
