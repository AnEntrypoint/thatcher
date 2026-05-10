import { createCrudHandlers } from '@/lib/crud-factory';
import { setCurrentRequest } from '@/engine.server';

function wrapHandler(method) {
  return async (request, context) => {
    setCurrentRequest(request);
    const params = await context.params;
    const pathArray = params.path || [];
    const entityName = params.entity;
    const parentEntity = params.parentEntity || null;
    const parentId = params.parentId || null;

    const enhancedContext = {
      ...context,
      params: {
        entity: entityName,
        id: pathArray[0] || null,
        childKey: pathArray[1] || null,
        parentEntity,
        parentId,
      },
    };

    const handlers = createCrudHandlers(entityName);
    return handlers(request, enhancedContext);
  };
}

export const GET = wrapHandler('GET');
export const POST = wrapHandler('POST');
export const PUT = wrapHandler('PUT');
export const PATCH = wrapHandler('PATCH');
export const DELETE = wrapHandler('DELETE');
