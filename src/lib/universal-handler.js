import { createCrudHandlers } from '@/lib/crud-factory';

export function createUniversalHandler(entityName) {
  return createCrudHandlers(entityName);
}

export { createUniversalHandler as createApiHandler };
