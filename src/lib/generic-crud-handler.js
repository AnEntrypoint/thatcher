import { createCrudHandlers } from '../lib/crud-factory.js';
import { getConfigEngineSync } from '../lib/config-generator-engine.js';

export function getEntityHandlers(entityName) {
  return createCrudHandlers(entityName);
}

export function hasEntity(entityName) {
  try {
    const engine = getConfigEngineSync();
    engine.generateEntitySpec(entityName);
    return true;
  } catch {
    return false;
  }
}
