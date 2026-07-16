// Adapted from moonlanding/src/lib/validate.js
// Entity/spec-driven field, record, and status-transition validation.

import { getSpec } from '@/config/spec-helpers';
import { isValidEmail } from '@/lib/validation/format-validators';
import { getValidTransitions } from '@/lib/status-helpers';
import { isBeforeDate } from '@/lib/date-utils';

// Re-export so consumers can reach the email validator from entity-validators.js (parity with moon)
export { isValidEmail };

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function sanitizeHtml(str) {
  return typeof str === 'string' ? str.replace(/[&<>"']/g, c => HTML_ESC[c]) : str;
}

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
      const { getBy } = await import('@/lib/busybase/store');
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

async function checkUnique(fieldDef, value, { fieldName, entityName, existingRecord }) {
  if (!fieldDef.unique) return null;
  if (value == null || value === '') return null;
  const existingValue = existingRecord?.[fieldName];
  if (value === existingValue) return null;
  try {
    const { getBy } = await import('@/lib/busybase/store');
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

export function hasErrors(errors) {
  return errors && Object.keys(errors).length > 0;
}

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

export function validateDateRange(startSeconds, endSeconds, label = 'date') {
  if (!startSeconds || !endSeconds) return { valid: true };
  if (isBeforeDate(endSeconds, startSeconds)) {
    return { valid: false, reason: `End ${label} cannot be before start ${label}` };
  }
  return { valid: true };
}

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
