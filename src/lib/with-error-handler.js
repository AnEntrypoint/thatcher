import { AppError, normalizeError, createErrorLogger } from '@/lib/error-handler';
import { apiError } from '@/lib/response-formatter';
import { HTTP } from '@/config/constants';

export const withErrorHandler = (handler, operation = 'Operation') => {
  const logger = createErrorLogger(operation);

  return async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      const error = normalizeError(e);
      logger.error(error.code, error.context);
      return apiError(error);
    }
  };
};

export const withAsyncErrorHandler = (handler, context = '') => {
  const logger = createErrorLogger(context);

  return async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      const error = e instanceof AppError ? e : new AppError(e.message, 'INTERNAL_ERROR', HTTP.INTERNAL_ERROR, { originalMessage: e.message });
      logger.error(error.code || 'ERROR', error.context || {});
      throw error;
    }
  };
};
