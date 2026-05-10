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
