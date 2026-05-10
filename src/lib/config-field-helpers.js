/**
 * Config Field Helpers - Field definition processing and validation
 */

import { getSpec } from './spec-helpers.js';

/**
 * Generate fields from field overrides
 */
export function generateFieldsFromOverrides(overrides, baseFields) {
  const result = { ...baseFields };
  if (!overrides) return result;

  for (const [key, def] of Object.entries(overrides)) {
    if (def === null || def === undefined) {
      delete result[key];
    } else {
      result[key] = { ...result[key], ...def };
    }
  }

  return result;
}

/**
 * Generate default field definitions for implicit fields
 */
export function generateDefaultFields(entityDef) {
  const defaults = {};

  // Add common fields
  if (!entityDef.fields) return defaults;

  for (const [key, field] of Object.entries(entityDef.fields)) {
    if (field.type === 'ref') {
      defaults[`${key}_display`] = {
        type: 'text',
        label: field.label ? `${field.label} Name` : key,
        computed: true,
        hidden: true,
      };
    }
  }

  return defaults;
}

/**
 * Build enum options from various sources (array, ref to status enum, etc.)
 */
export function buildEnumOptions(fieldDef, entityName, configEngine) {
  if (Array.isArray(fieldDef.options)) {
    return fieldDef.options.map(o => typeof o === 'object' ? o.value : o);
  }

  if (typeof fieldDef.options === 'string') {
    try {
      const spec = getSpec(entityName, configEngine);
      const list = spec.options?.[fieldDef.options];
      if (list) return list.map(o => typeof o === 'object' ? o.value : o);
    } catch {
      // fall through
    }
  }

  if (typeof fieldDef.options === 'string' && fieldDef.options.startsWith('status:')) {
    const statusName = fieldDef.options.replace('status:', '');
    try {
      const statuses = configEngine.getStatuses(statusName);
      return Object.keys(statuses);
    } catch {
      // fall through
    }
  }

  return [];
}

/**
 * Ensure all fields have labels
 */
export function ensureFieldLabels(fields) {
  const result = {};
  for (const [key, field] of Object.entries(fields)) {
    result[key] = {
      ...field,
      label: field.label || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    };
  }
  return result;
}
