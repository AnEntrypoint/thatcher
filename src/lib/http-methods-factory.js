import { createUniversalHandler } from '@/lib/universal-handler';
import { setCurrentRequest } from '@/engine.server';

function createMethodHandler(entityNameOrGetter) {
  return async function(request, context) {
    setCurrentRequest(request);
    const entityName = typeof entityNameOrGetter === 'function'
      ? await entityNameOrGetter(context)
      : entityNameOrGetter;

    const handler = createUniversalHandler(entityName);
    return await handler(request, context);
  };
}

export function createHttpMethods(entityNameOrGetter) {
  const handler = createMethodHandler(entityNameOrGetter);
  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
