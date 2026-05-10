/**
 * Field Registry - Type coercion and field utilities
 */

/**
 * Coerce value to field type
 * @param {any} value
 * @param {string} type
 * @returns {any}
 */
export function coerceFieldValue(value, type) {
  if (value === null || value === undefined) return value;

  switch (type) {
    case 'int':
    case 'decimal':
      return Number(value);
    case 'bool':
    case 'boolean':
      return value === true || value === 'true' || value === 1;
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    case 'date':
    case 'timestamp':
      const num = Number(value);
      return isNaN(num) ? null : num;
    case 'ref':
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Serialize field value for database
 * @param {any} value
 * @param {string} type
 * @returns {any}
 */
export function serializeField(value, type) {
  return coerceFieldValue(value, type);
}

/**
 * Deserialize field value from database
 * @param {any} value
 * @param {string} type
 * @returns {any}
 */
export function deserializeField(value, type) {
  if (value === null) return null;

  switch (type) {
    case 'json':
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return {};
      }
    case 'bool':
      return Boolean(value);
    case 'date':
    case 'timestamp':
      return Number(value);
    default:
      return value;
  }
}
