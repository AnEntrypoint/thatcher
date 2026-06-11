/**
 * Validation System - Field and entity validation
 * Adapted from moonlanding/src/lib/validate.js
 */

import { getSpec } from '../config/spec-helpers.js';
import { isValidEmail as checkEmailFormat, isValidEmail } from './validators.js';
import { getValidTransitions } from './status-helpers.js';
import { isBeforeDate } from './date-utils.js';

// Re-export so consumers can reach the email validator from validate.js (parity with moon)
export { isValidEmail };

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
      const { getBy } = await import('./busybase-store.js');
      const refTable = fieldDef.ref === 'user' ? 'users' : fieldDef.ref;
      if (!(await getBy(refTable, 'id', value))) {
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

    const uniqueErr = await checkUnique(fieldDef, value, {
      fieldName,
      entityName,
      existingRecord,
    });
    if (uniqueErr && !errors[fieldName]) errors[fieldName] = uniqueErr;
  }

  return errors;
}

/**
 * Enforce a field's `unique` constraint against the datastore.
 * Returns an error string if a duplicate exists, otherwise null.
 * @param {object} fieldDef
 * @param {any} value
 * @param {object} options - { fieldName, entityName, existingRecord }
 * @returns {Promise<string|null>}
 */
async function checkUnique(fieldDef, value, { fieldName, entityName, existingRecord }) {
  if (!fieldDef.unique) return null;
  if (value == null || value === '') return null;
  const existingValue = existingRecord?.[fieldName];
  if (value === existingValue) return null;
  try {
    const { getBy } = await import('./busybase-store.js');
    const table = entityName === 'user' ? 'users' : entityName;
    const dup = await getBy(table, fieldName, value);
    if (dup && (!existingRecord || dup.id !== existingRecord.id)) {
      return `Field '${fieldName}' must be unique`;
    }
  } catch {
    // Table might not exist yet; skip uniqueness enforcement
  }
  return null;
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

    const uniqueErr = await checkUnique(fieldDef, value, {
      fieldName,
      entityName,
      existingRecord,
    });
    if (uniqueErr && !errors[fieldName]) errors[fieldName] = uniqueErr;
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

/**
 * Validate a status/stage transition is permitted.
 * Uses thatcher's STAGE_TRANSITIONS graph via getValidTransitions.
 * @param {string} entityType
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {{valid: boolean, reason?: string}}
 */
export function validateStatusTransition(entityType, currentStatus, newStatus) {
  if (!currentStatus || !newStatus) {
    return { valid: false, reason: 'Status values required' };
  }
  if (currentStatus === newStatus) return { valid: true };
  const allowed = getValidTransitions(currentStatus) || [];
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      reason: `Cannot transition ${entityType} from '${currentStatus}' to '${newStatus}'`,
    };
  }
  return { valid: true };
}

/**
 * Validate that an end date is not before a start date.
 * @param {number} startSeconds - Unix timestamp (seconds)
 * @param {number} endSeconds - Unix timestamp (seconds)
 * @param {string} label
 * @returns {{valid: boolean, reason?: string}}
 */
export function validateDateRange(startSeconds, endSeconds, label = 'date') {
  if (!startSeconds || !endSeconds) return { valid: true };
  if (isBeforeDate(endSeconds, startSeconds)) {
    return { valid: false, reason: `End ${label} cannot be before start ${label}` };
  }
  return { valid: true };
}

/**
 * Validate a deadline: required, not before a reference date, within maxYears.
 * @param {number} deadlineSeconds - Unix timestamp (seconds)
 * @param {number} [referenceSeconds] - Unix timestamp (seconds)
 * @param {number} [maxYears=2]
 * @returns {{valid: boolean, reason?: string}}
 */
export function validateDeadline(deadlineSeconds, referenceSeconds, maxYears = 2) {
  if (!deadlineSeconds) return { valid: false, reason: 'Deadline is required' };
  if (referenceSeconds && isBeforeDate(deadlineSeconds, referenceSeconds)) {
    return { valid: false, reason: 'Deadline cannot be before the reference date' };
  }
  // Upper-bound window check (moon isWithinYears semantics: deadline must be within maxYears ahead).
  // Inlined rather than reusing thatcher's isWithinYears(ts, minYearsAgo, maxYearsAhead) whose
  // 2nd positional arg differs in meaning.
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + maxYears);
  if (new Date(deadlineSeconds * 1000) > limit) {
    return { valid: false, reason: `Deadline must be within ${maxYears} years` };
  }
  return { valid: true };
}

/**
 * Sanitize string/text fields of a record using the entity spec.
 * @param {object} data
 * @param {object} spec
 * @returns {object} Sanitized shallow copy
 */
export function sanitizeData(data, spec) {
  const sanitized = { ...data };
  for (const [fieldName, value] of Object.entries(sanitized)) {
    const fieldDef = spec?.fields?.[fieldName];
    if (fieldDef && (fieldDef.type === 'string' || fieldDef.type === 'text') && typeof value === 'string') {
      sanitized[fieldName] = sanitizeHtml(value);
    }
  }
  return sanitized;
}
