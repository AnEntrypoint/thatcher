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

  // Multi-select: value validated as array by validateType above; membership checked here (needs entityName for option-list resolution, same as enum)
  if (fieldDef.type === 'multiselect' && fieldDef.options) {
    const allowed = resolveEnumOptions(fieldDef, entityName);
    const arr = Array.isArray(value) ? value : (typeof value === 'string' ? JSON.parse(value) : []);
    if (allowed.length > 0 && arr.some(v => !allowed.includes(v))) {
      return {
        valid: false,
        error: `Invalid value(s) for '${fieldName}'. Expected values from: ${allowed.join(', ')}`,
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

  // Multi-ref: array-of-ids referencing another entity (e.g. task.depends_on
  // referencing other task ids) -- every id must resolve to a real record,
  // the same existence guarantee a single 'ref' field already gets.
  if (fieldDef.type === 'multiref' && fieldDef.ref) {
    const arr = Array.isArray(value) ? value : (typeof value === 'string' ? JSON.parse(value) : []);
    try {
      const { getBy } = await import('@/lib/busybase/store');
      const refTable = fieldDef.ref === 'user' ? 'users' : fieldDef.ref;
      for (const refId of arr) {
        if (!(await getBy(refTable, 'id', refId))) {
          return {
            valid: false,
            error: `${fieldDef.ref.charAt(0).toUpperCase() + fieldDef.ref.slice(1)} with id '${refId}' not found`,
          };
        }
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
  } else if (type === 'number' || type === 'int' || type === 'decimal' || type === 'currency') {
    if (typeof value !== 'number' || isNaN(value)) return `Field '${fieldName}' must be a number`;
    if (type === 'currency' && !Number.isInteger(value)) return `Field '${fieldName}' must be an integer number of cents`;
    if (fieldDef.step && (value % fieldDef.step !== 0)) return `Field '${fieldName}' must be a multiple of ${fieldDef.step}`;
    if (min !== undefined && value < min) return `Field '${fieldName}' must be at least ${min}`;
    if (max !== undefined && value > max) return `Field '${fieldName}' must be at most ${max}`;
  } else if (type === 'boolean' || type === 'bool') {
    if (typeof value !== 'boolean') return `Field '${fieldName}' must be a boolean`;
  } else if (type === 'timestamp' || type === 'date') {
    if (isNaN(Number(value))) return `Field '${fieldName}' must be a valid timestamp`;
  } else if (type === 'multiselect' || type === 'multiref') {
    const arr = Array.isArray(value) ? value : (typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : null);
    if (!Array.isArray(arr)) return `Field '${fieldName}' must be an array`;
  } else if (type === 'file' || type === 'attachment') {
    const f = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
    if (!f || typeof f !== 'object' || typeof f.stored_name !== 'string' || typeof f.url !== 'string') {
      return `Field '${fieldName}' must be file metadata with stored_name and url`;
    }
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

// Stock movements are immutable history (checked at creation only, never on
// edit -- there is no update path for them). An outbound movement (negative
// quantity) that would drive the running balance below zero is invalid: the
// balance is the sum of every OTHER movement for this product plus the new
// one, computed fresh from stored data, never trusting a client-supplied
// "current stock" value that doesn't exist as an editable field.
async function checkStockBalance(entityName, data) {
  if (entityName !== 'stock_movement') return null;
  const quantity = Number(data.quantity);
  if (!Number.isFinite(quantity) || quantity >= 0) return null;
  if (!data.product_id) return null;

  const { list } = await import('@/lib/busybase/store');
  const existingMovements = await list('stock_movement', { product_id: data.product_id });
  const currentBalance = existingMovements.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
  const resultingBalance = currentBalance + quantity;
  if (resultingBalance < 0) {
    return `Insufficient stock: current balance is ${currentBalance}, this movement would result in ${resultingBalance}`;
  }
  return null;
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

  const stockErr = await checkStockBalance(entityName, data);
  if (stockErr) errors.quantity = stockErr;

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

// Task completion cannot be a client-side/UI-only rule -- a raw API PATCH
// setting status=done must be rejected server-side the same as any other
// write, or dependency ordering is purely cosmetic. depends_on is checked
// against the CURRENT stored state of each referenced task (never trusting
// a value the caller might also be trying to change in the same payload).
async function checkTaskDependencies(entityName, changes, existingRecord) {
  if (entityName !== 'task') return null;
  if (changes.status !== 'done') return null;

  const dependsOn = changes.depends_on !== undefined ? changes.depends_on : existingRecord?.depends_on;
  const ids = Array.isArray(dependsOn) ? dependsOn : (typeof dependsOn === 'string' && dependsOn ? (() => { try { return JSON.parse(dependsOn); } catch { return []; } })() : []);
  if (!ids.length) return null;

  const { get } = await import('@/lib/busybase/store');
  const incomplete = [];
  for (const depId of ids) {
    const dep = await get('task', depId);
    if (!dep || dep.status !== 'done') incomplete.push(depId);
  }
  if (incomplete.length) {
    return `Cannot mark done: depends on incomplete task(s) ${incomplete.join(', ')}`;
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

  const depErr = await checkTaskDependencies(entityName, changes, existingRecord);
  if (depErr) errors.status = depErr;

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
