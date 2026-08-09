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

  // A formula field is never stored -- computed fresh from the record's own
  // other fields at every read (busybase/store.js's computeFormulaFields).
  // Unlike a generic readOnly field (which silently ignores a client-
  // supplied value), a write attempt against a formula field is rejected
  // outright: the caller almost certainly intended to set an input field,
  // not the derived output, and silently swallowing that mistake would hide
  // a real bug rather than surface it.
  if (fieldDef.type === 'formula') {
    if (value === null || value === undefined || value === '') return { valid: true };
    return { valid: false, error: `Field '${fieldName}' is computed and cannot be set directly` };
  }

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

// A non-privileged user may only log time against their own user_id -- a
// clerk POSTing another user's id must be rejected the same way it would be
// UI-side, but server-side is the authoritative check per this session's SEC
// pattern. Privileged roles (partner/manager) may log time for anyone, e.g.
// entering a team member's hours on their behalf.
// Shared self-only check: a non-privileged actingUser may only write a
// record whose user_id matches their own id; partner/admin/manager may write
// for anyone. One function so every self-only entity enforces identically
// rather than each growing its own slightly-different copy over time.
function checkSelfOnlyOwnership(data, options, actionDescription) {
  const actingUser = options?.actingUser;
  if (!actingUser) return null;
  if (['partner', 'admin', 'manager'].includes(actingUser.role)) return null;
  if (data.user_id !== undefined && data.user_id !== actingUser.id) {
    return `Cannot ${actionDescription} for another user`;
  }
  return null;
}

function checkTimeEntryOwnership(entityName, data, options) {
  if (entityName !== 'time_entry') return null;
  return checkSelfOnlyOwnership(data, options, 'log time');
}

function checkResourceAllocationOwnership(entityName, data, options) {
  if (entityName !== 'resource_allocation') return null;
  return checkSelfOnlyOwnership(data, options, 'create a resource allocation');
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

// A contract whose end_date is not strictly after its start_date is invalid
// regardless of what the form happened to allow -- checked wherever either
// date is present in the payload so it also catches a create that only sets
// one of the two dates against an existing record's other date on update.
function checkContractDateOrder(entityName, data, existingRecord) {
  if (entityName !== 'contract') return null;
  const startDate = data.start_date !== undefined ? data.start_date : existingRecord?.start_date;
  const endDate = data.end_date !== undefined ? data.end_date : existingRecord?.end_date;
  if (startDate == null || endDate == null) return null;
  if (Number(endDate) <= Number(startDate)) {
    return `end_date must be after start_date`;
  }
  return null;
}

const CROSS_ENTITY_OPERATORS = {
  equals: (a, b) => a === b,
  not_equals: (a, b) => a !== b,
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
};

// Generic cross-entity rule evaluator: reads a field's cross_entity_rule
// definition off the SAME spec.fields[key] shape every other field metadata
// (visible_to/editable_by/encrypted) already lives on, so it works for any
// entity -- built-in or custom_entity_def-registered -- carrying one, not
// hardcoded to a single entity name the way checkStockBalance/
// checkContractDateOrder/checkResourceCapacity are. Two shapes:
// - simple: {ref_field, related_field, operator, value} compares the
//   related record's field against a literal value.
// - aggregate: {ref_field, aggregate:'sum', aggregate_field, operator,
//   limit_field} sums a field across every OTHER record referencing the
//   same related entity via ref_field, and compares against a limit read
//   from the related record's limit_field.
// Uses the same unscoped internal get()/list() lookup pattern
// checkContractDateOrder/checkStockBalance/checkResourceCapacity already
// use -- these run from validateEntity/validateUpdate, which today has no
// user context threaded through, so this does not introduce a new
// access-control gap relative to those three existing checks; it matches
// their established behavior exactly rather than inventing a new one.
async function checkCrossEntityRules(entityName, data, existingRecord) {
  const spec = getSpec(entityName);
  for (const [fieldKey, fieldDef] of Object.entries(spec.fields || {})) {
    const rule = fieldDef.cross_entity_rule;
    if (!rule || !rule.ref_field) continue;

    const refId = data[rule.ref_field] !== undefined ? data[rule.ref_field] : existingRecord?.[rule.ref_field];
    if (refId == null) continue;

    const refFieldDef = spec.fields[rule.ref_field];
    const relatedEntity = refFieldDef?.ref;
    if (!relatedEntity) continue;

    const { get, list } = await import('@/lib/busybase/store');
    const related = await get(relatedEntity, refId);
    if (!related) continue;

    const operatorFn = CROSS_ENTITY_OPERATORS[rule.operator];
    if (!operatorFn) continue;

    if (rule.aggregate === 'sum') {
      const relatedEntitySelfEntity = entityName;
      const siblingRecords = await list(relatedEntitySelfEntity, { [rule.ref_field]: refId });
      const selfId = existingRecord?.id;
      const thisValue = Number(data[rule.aggregate_field] !== undefined ? data[rule.aggregate_field] : existingRecord?.[rule.aggregate_field]) || 0;
      const othersTotal = siblingRecords
        .filter(r => r.id !== selfId)
        .reduce((sum, r) => sum + (Number(r[rule.aggregate_field]) || 0), 0);
      const resultingTotal = othersTotal + thisValue;
      const limit = Number(related[rule.limit_field]);
      if (!Number.isFinite(limit)) continue;
      if (!operatorFn(resultingTotal, limit)) {
        return `${fieldKey}: sum of ${rule.aggregate_field} across ${relatedEntitySelfEntity} for this ${rule.ref_field} would be ${resultingTotal}, violating ${rule.operator} ${limit}`;
      }
      continue;
    }

    if (!rule.related_field) continue;
    const relatedValue = related[rule.related_field];
    if (!operatorFn(relatedValue, rule.value)) {
      return `${fieldKey}: related ${relatedEntity}.${rule.related_field} (${relatedValue}) fails rule "${rule.operator} ${rule.value}"`;
    }
  }
  return null;
}

// A user's total weekly allocation across every project they're assigned to,
// for any date range that overlaps the new/changed allocation, must not
// exceed a configurable weekly capacity. Checked against EVERY OTHER
// existing allocation for that user (excluding the record being updated, if
// any) plus the new one -- never trusting a client-supplied total. The
// overlap/load math itself lives in resource-capacity.js, shared with
// resource-optimizer.js's suggestion ranking so both compute a user's
// committed load identically.
async function checkResourceCapacity(entityName, data, existingRecord) {
  if (entityName !== 'resource_allocation') return null;
  const userId = data.user_id !== undefined ? data.user_id : existingRecord?.user_id;
  const startDate = data.start_date !== undefined ? data.start_date : existingRecord?.start_date;
  const endDate = data.end_date !== undefined ? data.end_date : existingRecord?.end_date;
  const hours = Number(data.allocated_hours_per_week !== undefined ? data.allocated_hours_per_week : existingRecord?.allocated_hours_per_week);
  if (!userId || startDate == null || endDate == null || !Number.isFinite(hours)) return null;

  const { userCommittedHours, DEFAULT_WEEKLY_CAPACITY_HOURS } = await import('@/lib/resource-capacity');
  const overlappingTotal = await userCommittedHours(userId, startDate, endDate, existingRecord?.id);
  const resultingTotal = overlappingTotal + hours;
  if (resultingTotal > DEFAULT_WEEKLY_CAPACITY_HOURS) {
    return `Over-allocated: this would bring the user's weekly total to ${resultingTotal}h against overlapping allocations, exceeding the ${DEFAULT_WEEKLY_CAPACITY_HOURS}h capacity`;
  }
  return null;
}

export async function validateEntity(entityName, data, existingRecord = null, options = {}) {
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

  const ownershipErr = checkTimeEntryOwnership(entityName, data, options) || checkResourceAllocationOwnership(entityName, data, options);
  if (ownershipErr) errors.user_id = ownershipErr;

  const dateOrderErr = checkContractDateOrder(entityName, data, existingRecord);
  if (dateOrderErr) errors.end_date = dateOrderErr;

  const capacityErr = await checkResourceCapacity(entityName, data, existingRecord);
  if (capacityErr) errors.allocated_hours_per_week = capacityErr;

  const crossEntityErr = await checkCrossEntityRules(entityName, data, existingRecord);
  if (crossEntityErr) errors._cross_entity = crossEntityErr;

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

  const dateOrderErr = checkContractDateOrder(entityName, changes, existingRecord);
  if (dateOrderErr) errors.end_date = dateOrderErr;

  const capacityErr = await checkResourceCapacity(entityName, changes, existingRecord);
  if (capacityErr) errors.allocated_hours_per_week = capacityErr;

  const crossEntityErr = await checkCrossEntityRules(entityName, changes, existingRecord);
  if (crossEntityErr) errors._cross_entity = crossEntityErr;

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
