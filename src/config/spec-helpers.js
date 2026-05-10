/**
 * Spec Helpers - Utility functions for entity specifications
 * Provides easy access to entity specs, navigation, and derived properties
 */

/**
 * Get entity spec by name
 * @param {string} name - Entity name
 * @param {object} configEngine - Config engine instance
 * @returns {object|null} Entity specification or null if not found
 */
export function getSpec(name, configEngine) {
  try {
    return configEngine.generateEntitySpec(name);
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Unknown entity')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get all navigable entities (top-level, non-embedded)
 * @param {object} configEngine
 * @returns {Array} Sorted array of entity specs
 */
export function getNavItems(configEngine) {
  try {
    const allEntities = configEngine.getAllEntities();
    return allEntities
      .map(e => configEngine.generateEntitySpec(e))
      .filter(s => !s.embedded && !s.parent && !s.system_entity)
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(s => ({
        name: s.name,
        label: s.labelPlural || s.label,
        icon: s.icon,
        href: `/${s.name}`,
      }));
  } catch (error) {
    console.error('[spec-helpers] getNavItems error:', error.message);
    return [];
  }
}

/**
 * Get child entity definitions for a parent spec
 * @param {object} spec - Parent entity spec
 * @returns {Array} Child entity configs
 */
export function getChildEntities(spec) {
  if (!spec.children) return [];
  return Object.entries(spec.children).map(([key, child]) => ({
    key,
    entity: child.entity,
    label: child.label,
    fk: child.fk,
    filter: child.filter,
    component: child.component,
  }));
}

/**
 * Get parent entity name
 * @param {object} spec
 * @returns {string|null}
 */
export function getParentEntity(spec) {
  return spec.parent || null;
}

/**
 * Get default sort configuration
 * @param {object} spec
 * @returns {{field: string, dir: string}}
 */
export function getDefaultSort(spec) {
  return spec.list?.defaultSort || { field: 'created_at', dir: 'desc' };
}

/**
 * Get available filters for entity
 * @param {object} spec
 * @returns {Array}
 */
export function getAvailableFilters(spec) {
  return spec.list?.filters || [];
}

/**
 * Get page size for entity
 * @param {object} spec
 * @returns {number}
 */
export function getPageSize(spec, systemPagination = { default_page_size: 20 }) {
  return spec.list?.pageSize || systemPagination.default_page_size;
}

/**
 * Get entity label (singular or plural)
 * @param {object} spec
 * @param {boolean} plural
 * @returns {string}
 */
export function getEntityLabel(spec, plural = false) {
  return plural ? (spec.labelPlural || spec.label) : spec.label;
}

/**
 * Get default initial state for entity (empty record with defaults)
 * @param {object} spec
 * @returns {object}
 */
export function getInitialState(spec) {
  const state = {};
  for (const [key, field] of Object.entries(spec.fields)) {
    if (field.type === 'id') continue;
    if (field.default !== undefined) {
      state[key] = field.default;
    } else if (field.type === 'bool') {
      state[key] = false;
    } else if (field.type === 'int' || field.type === 'decimal') {
      state[key] = 0;
    } else if (field.type === 'json') {
      state[key] = [];
    } else if (field.type === 'date' || field.type === 'timestamp') {
      state[key] = null;
    } else {
      state[key] = '';
    }
  }
  return state;
}

/**
 * Check if entity is embedded (used in parent contexts)
 * @param {object} spec
 * @returns {boolean}
 */
export function isEmbeddedEntity(spec) {
  return spec.embedded === true;
}

/**
 * Check if entity is a top-level parent
 * @param {object} spec
 * @returns {boolean}
 */
export function isParentEntity(spec) {
  return !spec.embedded && !spec.parent;
}

/**
 * Check if entity has child relationships
 * @param {object} spec
 * @returns {boolean}
 */
export function hasChildRelationships(spec) {
  return !!spec.children && Object.keys(spec.children).length > 0;
}

/**
 * Get entity options (enums, picklists)
 * @param {object} spec
 * @param {string} optionKey
 * @returns {Array}
 */
export function getOptions(spec, optionKey) {
  return spec.options?.[optionKey] || [];
}

/**
 * Get display label for an option value
 * @param {object} spec
 * @param {string} optionKey
 * @param {string} value
 * @returns {string}
 */
export function getOptionLabel(spec, optionKey, value) {
  const option = getOptions(spec, optionKey).find(o => o.value === value);
  return option?.label || String(value);
}

/**
 * Get color for an option value (for UI badges)
 * @param {object} spec
 * @param {string} optionKey
 * @param {string} value
 * @returns {string}
 */
export function getOptionColor(spec, optionKey, value) {
  const option = getOptions(spec, optionKey).find(o => o.value === value);
  return option?.color || 'gray';
}

/**
 * Build navigation structure for menus
 * @param {object} configEngine
 * @param {object} user - Optional user for permission filtering
 * @returns {Array} Navigation items
 */
export function buildNavigation(configEngine, user = null) {
  try {
    const allEntities = configEngine.getAllEntities();
    const items = allEntities
      .map(e => configEngine.generateEntitySpec(e))
      .filter(s => !s.embedded && !s.parent && !s.system_entity)
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(s => ({
        name: s.name,
        label: s.labelPlural || s.label,
        icon: s.icon,
        href: `/${s.name}`,
        badge: s.badge,
      }));

    // Filter by user permissions if provided
    if (user && configEngine.getRolePermissions) {
      return items.filter(item => {
        const spec = configEngine.generateEntitySpec(item.name);
        const perms = configEngine.getRolePermissions(user.role, item.name);
        return perms.includes('list') || perms.includes('view') || perms.includes('all');
      });
    }

    return items;
  } catch (error) {
    console.error('[spec-helpers] buildNavigation error:', error.message);
    return [];
  }
}
