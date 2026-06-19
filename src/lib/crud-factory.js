// Adapted from moonlanding/src/lib/crud-factory.js

import { createCrudHandlers as buildHandlers } from './crud-handlers.js';
import { getConfigEngineSync } from './config-generator-engine.js';

export function createCrudHandlers(entityName) {
  const configEngine = getConfigEngineSync();
  const spec = configEngine.generateEntitySpec(entityName);

  return {
    GET: async (request, context) => {
      const { params } = context;
      const id = params?.id;

      if (id) {
        return buildHandlers(spec).get(id, request, context);
      } else {
        return buildHandlers(spec).list(request, context);
      }
    },

    POST: async (request, context) => {
      return buildHandlers(spec).create(request, context);
    },

    PUT: async (request, context) => {
      const { params } = context;
      const id = params?.id;
      if (!id) throw new Error('ID required for PUT');
      return buildHandlers(spec).update(id, request, context);
    },

    PATCH: async (request, context) => {
      const { params } = context;
      const id = params?.id;
      if (!id) throw new Error('ID required for PATCH');
      return buildHandlers(spec).update(id, request, context);
    },

    DELETE: async (request, context) => {
      const { params } = context;
      const id = params?.id;
      if (!id) throw new Error('ID required for DELETE');
      return buildHandlers(spec).remove(id, request, context);
    },
  };
}

export function createEntityController(entityName) {
  const configEngine = getConfigEngineSync();
  const spec = configEngine.generateEntitySpec(entityName);
  const handlers = buildHandlers(entityName, spec);

  return {
    list: handlers.list,
    get: handlers.get,
    create: handlers.create,
    update: handlers.update,
    delete: handlers.remove,

    async customAction(action, request, context) {
      const { params } = context;
      const id = params?.id;
      const body = await request.json();
      return handlers.customAction(action, id, body, context);
    },
  };
}
