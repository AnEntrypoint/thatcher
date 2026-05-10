import { serverCreateEntity, serverUpdateEntity, serverDeleteEntity } from '@/lib/action-factory';

export function createCRUDActions(entityName) {
  return {
    create: (data) => serverCreateEntity(entityName, data),
    update: (id, data) => serverUpdateEntity(entityName, id, data),
    delete: (id) => serverDeleteEntity(entityName, id),
  };
}

export function createEntityAction(entityName, actionName, permission, handler) {
  return async (...args) => {
    'use server';
    const { requireUser, check } = await import('@/engine.server');
    const { getSpec } = await import('@/config');
    const user = await requireUser();
    const spec = getSpec(entityName);
    await check(user, spec, permission);
    return handler(user, spec, ...args);
  };
}
