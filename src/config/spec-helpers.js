import { createLogger } from '../lib/logger.js';

const log = createLogger('[SpecHelpers]');

export function getSpec(name, configEngine) {
  // Callers across the framework invoke getSpec(name) without threading the engine
  // (moon's getSpec self-resolved it). Fall back to the singleton when omitted.
  if (!configEngine) {
    const g = globalThis.__thatcherConfigEngine;
    if (g) configEngine = g;
  }
  try {
    return configEngine.generateEntitySpec(name);
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Unknown entity')) {
      return null;
    }
    throw error;
  }
}

export function getAllEntityNames(configEngine) {
  if (!configEngine) {
    const g = globalThis.__thatcherConfigEngine;
    if (g) configEngine = g;
  }
  if (!configEngine) return [];
  try {
    return configEngine.getAllEntities().filter(name => {
      const spec = getSpec(name, configEngine);
      return spec && !spec.embedded && !spec.system_entity;
    });
  } catch {
    return [];
  }
}

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
    log.error('getNavItems error:', { message: error.message });
    return [];
  }
}

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

export function getParentEntity(spec) {
  return spec.parent || null;
}

export function getDefaultSort(spec) {
  return spec.list?.defaultSort || { field: 'created_at', dir: 'desc' };
}

export function getAvailableFilters(spec) {
  return spec.list?.filters || [];
}

export function getPageSize(spec, systemPagination = { default_page_size: 20 }) {
  return spec.list?.pageSize || systemPagination.default_page_size;
}

export function getEntityLabel(spec, plural = false) {
  return plural ? (spec.labelPlural || spec.label) : spec.label;
}

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

export function isEmbeddedEntity(spec) {
  return spec.embedded === true;
}

export function isParentEntity(spec) {
  return !spec.embedded && !spec.parent;
}

export function hasChildRelationships(spec) {
  return !!spec.children && Object.keys(spec.children).length > 0;
}

export function getOptions(spec, optionKey) {
  return spec.options?.[optionKey] || [];
}

export function getOptionLabel(spec, optionKey, value) {
  const option = getOptions(spec, optionKey).find(o => o.value === value);
  return option?.label || String(value);
}

export function getOptionColor(spec, optionKey, value) {
  const option = getOptions(spec, optionKey).find(o => o.value === value);
  return option?.color || 'gray';
}

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
        const perms = configEngine.getRolePermissions(user.role, item.name);
        return perms.includes('list') || perms.includes('view') || perms.includes('all');
      });
    }

    return items;
  } catch (error) {
    log.error('buildNavigation error:', { message: error.message });
    return [];
  }
}
