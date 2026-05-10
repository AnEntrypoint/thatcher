/**
 * Generic CRUD Handler - Catch-all API handler for any entity
 * This provides out-of-the-box CRUD for all entities defined in config
 * Users can override by creating their own route files
 */

import { createCrudHandlers } from '../lib/crud-factory.js';
import { getConfigEngineSync } from '../lib/config-generator-engine.js';

/**
 * Get handler for an entity
 * @param {string} entityName
 * @returns {object} {GET, POST, PUT, DELETE}
 */
export function getEntityHandlers(entityName) {
  return createCrudHandlers(entityName);
}

/**
 * Check if entity exists and is accessible
 * @param {string} entityName
 * @returns {boolean}
 */
export function hasEntity(entityName) {
  try {
    const engine = getConfigEngineSync();
    engine.generateEntitySpec(entityName);
    return true;
  } catch {
    return false;
  }
}
