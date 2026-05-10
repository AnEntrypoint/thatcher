/**
 * Validation System - Field and entity validation
 * Adapted from moonlanding/src/lib/validate.js
 */

import { getSpec } from '../config/spec-helpers.js';
import { isValidEmail as checkEmailFormat } from './validators.js';

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Sanitize HTML
 * @param {string} str
 * @returns {string}
 */
function sanitizeHtml(str) {
  return typeof str === 'string' ? str.replace(/[&<>"']/g, c => HTML_ESC[c]) : str;
}

/**
 * Validate a single field
 * @param {object} fieldDef
 * @param {any} value
 * @param {object} options
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateField(fieldDef, value, options = {}) {
  const { fieldName, entityName, existingValue } = options;

  if (fieldDef.auto || fieldDef.auto_generate || fieldDef.readOnly) {
    return { valid: true };
  }

  if (fieldDef.required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `Field '${fieldName}' is required` };
  }

  if (value === null || value === undefined || value === '') {
    return { valid: true }; // Optional field with no value
  }

  // Type validation
  const typeErr = validateType(fieldDef, value, fieldName);
  if (typeErr) return { valid: false, error: typeErr };

  // Enum validation
  if (fieldDef.type === 'enum' && fieldDef.options) {
    const allowed = resolveEnumOptions(fieldDef, entityName);
    if (allowed.length > 0 && !allowed.includes(value)) {
      return {
        valid: false,
        error: `Invalid value for '${fieldName}'. Expected one of: ${allowed.join(', ')}`,
      };
    }
  }

  // Reference validation
  if (fieldDef.type === 'ref' && fieldDef.ref) {
    if (existingValue !== undefined && value === existingValue) {
      return { valid: true };
    }
    try {
      const { get } = await import('./query-engine.js');
      const refTable = fieldDef.ref === 'user' ? 'users' : fieldDef.ref;
      if (!get(refTable, value)) {
        return {
          valid: false,
          error: `${fieldDef.ref.charAt(0).toUpperCase() + fieldDef.ref.slice(1)} with id '${value}' not found`,
        };
      }
    } catch {
      // Reference table might not exist yet
    }
  }

  return { valid: true };
}

/**
 * Validate type of value
 * @param {object} fieldDef
 * @param {any} value
 * @param {string} fieldName
 * @returns {string|null}
 */
function validateType(fieldDef, value, fieldName) {
  const { type, min, max } = fieldDef;

  if (type === 'string' || type === 'text') {
    if (typeof value !== 'string') return `Field '${fieldName}' must be a string`;
  } else if (type === 'number' || type === 'int' || type === 'decimal') {
    if (typeof value !== 'number' || isNaN(value)) return `Field '${fieldName}' must be a number`;
    if (min !== undefined && value < min) return `Field '${fieldName}' must be at least ${min}`;
    if (max !== undefined && value > max) return `Field '${fieldName}' must be at most ${max}`;
  } else if (type === 'boolean' || type === 'bool') {
    if (typeof value !== 'boolean') return `Field '${fieldName}' must be a boolean`;
  } else if (type === 'timestamp' || type === 'date') {
    if (isNaN(Number(value))) return `Field '${fieldName}' must be a valid timestamp`;
  } else if (type === 'json') {
    if (typeof value === 'string') {
      try { JSON.parse(value); } catch { return `Field '${fieldName}' must be valid JSON`; }
    } else if (typeof value !== 'object') {
      return `Field '${fieldName}' must be an object or JSON string`;
    }
  }

  return null;
}

/**
 * Resolve enum options from field definition
 * @param {object} fieldDef
 * @param {string} entityName
 * @returns {Array<string>}
 */
function resolveEnumOptions(fieldDef, entityName) {
  if (Array.isArray(fieldDef.options)) {
    return fieldDef.options.map(o => typeof o === 'object' ? o.value : o);
  }

  if (typeof fieldDef.options === 'string') {
    try {
      const spec = getSpec(entityName);
      const list = spec.options?.[fieldDef.options];
      if (list) return list.map(o => typeof o === 'object' ? o.value : o);
    } catch {
      // Skip
    }
  }

  return [];
}

/**
 * Validate all fields for an entity
 * @param {string} entityName
 * @param {object} data
 * @param {object} existingRecord
 * @returns {Promise<object>} Errors object keyed by field name
 */
export async function validateEntity(entityName, data, existingRecord = null) {
  const spec = getSpec(entityName);
  const errors = {};

  for (const [fieldName, fieldDef] of Object.entries(spec.fields || {})) {
    const value = data[fieldName];
    const result = await validateField(fieldDef, value, {
      fieldName,
      entityName,
      existingValue: existingRecord?.[fieldName],
    });

    if (!result.valid && result.error) {
      errors[fieldName] = result.error;
    }
  }

  return errors;
}

/**
 * Validate update (only changed fields)
 * @param {string} entityName
 * @param {object} changes
 * @param {object} existingRecord
 * @returns {Promise<object>}
 */
export async function validateUpdate(entityName, changes, existingRecord) {
  const spec = getSpec(entityName);
  const errors = {};

  for (const [fieldName, fieldDef] of Object.entries(spec.fields || {})) {
    if (!(fieldName in changes)) continue;

    const value = changes[fieldName];
    const result = await validateField(fieldDef, value, {
      fieldName,
      entityName,
      existingValue: existingRecord?.[fieldName],
    });

    if (!result.valid && result.error) {
      errors[fieldName] = result.error;
    }
  }

  return errors;
}

/**
 * Check if errors object has any errors
 * @param {object} errors
 * @returns {boolean}
 */
export function hasErrors(errors) {
  return errors && Object.keys(errors).length > 0;
}
