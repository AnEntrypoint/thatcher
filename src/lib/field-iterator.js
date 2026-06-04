/**
 * Field Iterator - Iterate over all fields (including nested/computed) in a spec
 */

/**
 * Iterate over all fields in an entity spec
 * @param {object} spec - Entity specification
 * @param {Function} callback - (key, fieldDef) => void
 * @param {object} options - { includeComputed, includeHidden }
 */
export function forEachField(spec, callback, options = {}) {
  const { includeComputed = false, includeHidden = false } = options;

  for (const [key, field] of Object.entries(spec.fields || {})) {
    if (!includeHidden && field.hidden) continue;
    if (!includeComputed && field.computed) continue;
    callback(key, field);
  }
}

/**
 * Get all field names
 * @param {object} spec
 * @returns {string[]}
 */
export function getFieldNames(spec) {
  return Object.keys(spec.fields || {});
}

/**
 * Get only editable fields
 * @param {object} spec
 * @returns {string[]}
 */
export function getEditableFields(spec) {
  return Object.entries(spec.fields || {})
    .filter(([key, field]) => !field.readonly && !field.auto && !field.auto_generate)
    .map(([key]) => key);
}

/**
 * Get field by type
 * @param {object} spec
 * @param {string} type
 * @returns {Array<{key: string, field: object}>}
 */
export function getFieldsByType(spec, type) {
  return Object.entries(spec.fields || {})
    .filter(([key, field]) => field.type === type);
}

/* ------------------------------------------------------------------ *
 * Predicate-based field query helpers (ported from moonlanding).
 * Additive: these do not change thatcher's existing forEachField /
 * getEditableFields / getFieldNames / getFieldsByType signatures.
 * ------------------------------------------------------------------ */

/**
 * Query the fields of a spec with one or more predicates.
 * @param {object} spec
 * @param {Function|Function[]} predicates - (field, key) => boolean
 * @param {object} [options] - { keysOnly }
 * @returns {Array<string|object>} keys when keysOnly, else { key, ...field }
 */
export function fieldQuery(spec, predicates, options = {}) {
  const preds = Array.isArray(predicates) ? predicates : [predicates];
  const results = [];
  for (const [key, field] of Object.entries(spec.fields || {})) {
    if (preds.every(pred => pred(field, key))) {
      results.push(options.keysOnly ? key : { key, ...field });
    }
  }
  return results;
}

/**
 * Reusable field predicates for fieldQuery.
 */
export const is = {
  notId: f => f.type !== 'id',
  notHidden: f => !f.hidden,
  notReadOnly: f => !f.readOnly,
  required: f => f.required,
  searchable: f => f.search,
  listable: f => f.list === true,
  ref: f => f.type === 'ref' && f.ref,
  editable: f => !f.hidden && !f.readOnly && f.type !== 'id' && !f.auto && f.type !== 'auto_timestamp' && !f.auto_generate,
  displayable: f => !f.hidden && f.type !== 'id',
  ofType: type => f => f.type === type,
  hasProperty: prop => f => f[prop] !== undefined,
};

/**
 * Editable fields as full { key, ...field } objects (form rendering).
 * Distinct from thatcher's getEditableFields (which returns names only).
 */
export function getFormFields(spec) {
  if (spec.system_entity) return [];
  return fieldQuery(spec, is.editable);
}

/**
 * Listable fields as full { key, ...field } objects.
 */
export function getListFields(spec) {
  return fieldQuery(spec, is.listable);
}

/**
 * Displayable fields as full { key, ...field } objects.
 */
export function getDisplayFields(spec) {
  return fieldQuery(spec, is.displayable);
}

/**
 * Required field names.
 */
export function getRequiredFields(spec) {
  return fieldQuery(spec, is.required, { keysOnly: true });
}

/**
 * Searchable field names.
 */
export function getSearchFields(spec) {
  return fieldQuery(spec, is.searchable, { keysOnly: true });
}

/**
 * Filterable fields, resolved from list.filters config.
 */
export function getFilterableFields(spec) {
  return (spec.list?.filters || [])
    .map(filterKey => spec.fields?.[filterKey])
    .filter(Boolean);
}

/**
 * Reference (ref) fields as full { key, ...field } objects.
 */
export function getRefFields(spec) {
  return fieldQuery(spec, is.ref);
}

/**
 * Get a single field definition by key.
 */
export function getField(spec, fieldKey) {
  return spec.fields?.[fieldKey];
}

/**
 * Get a single field's type by key.
 */
export function getFieldType(spec, fieldKey) {
  return spec.fields?.[fieldKey]?.type;
}

/**
 * Iterate editable fields on create. callback = (key, field) => void
 */
export function iterateCreateFields(spec, callback) {
  for (const { key, ...field } of fieldQuery(spec, is.editable)) {
    callback(key, field);
  }
}

/**
 * Iterate editable fields on update. callback = (key, field) => void
 */
export function iterateUpdateFields(spec, callback) {
  for (const { key, ...field } of fieldQuery(spec, is.editable)) {
    callback(key, field);
  }
}
