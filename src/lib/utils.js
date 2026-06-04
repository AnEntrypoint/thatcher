/**
 * Utility Functions - Common helpers
 */

import { list } from './busybase-store.js';
import { getSpec } from '../config/spec-helpers.js';

/**
 * Load ref-field options for a spec's form (ported from moonlanding).
 * For each `ref` field, fetch the referenced entity's rows and build
 * `{ value, label }` option lists. `engagement` refs get a richer label
 * and skip archived rows. Failures degrade to an empty option list.
 * @param {object} spec - Entity spec with a `fields` map
 * @returns {Promise<Record<string, Array<{value:any,label:string}>>>}
 */
export async function loadFormOptions(spec) {
  const options = {};
  for (const [key, field] of Object.entries(spec.fields || {})) {
    if (field.type === 'ref' && field.ref) {
      try {
        const data = await list(field.ref);
        if (field.ref === 'engagement') {
          options[key] = data
            .filter(r => r.status !== 'archived')
            .map(r => ({
              value: r.id,
              label: `${r.client_name || 'No Client'} - ${r.name} (${r.financial_year || r.year || 'N/A'})`,
            }));
        } else {
          options[key] = data.map(r => ({
            value: r.id,
            label: r.name || r.email || r.id,
          }));
        }
      } catch {
        options[key] = [];
      }
    }
  }
  return options;
}

/**
 * Error thrown when an entity spec cannot be resolved (ported from moonlanding).
 */
export class SpecError extends Error {
  constructor(entity) {
    super(`Unknown entity: ${entity}`);
    this.code = 'UNKNOWN_ENTITY';
    this.name = 'SpecError';
  }
}

/**
 * Resolve an entity spec, throwing a typed SpecError on failure (ported from
 * moonlanding). Uses thatcher's single-arg getSpec convention.
 * @param {string} entity
 * @returns {Promise<object>}
 */
export async function resolveSpec(entity) {
  try {
    const spec = getSpec(entity);
    if (!spec) throw new SpecError(entity);
    return spec;
  } catch (e) {
    if (e instanceof SpecError) throw e;
    throw new SpecError(entity);
  }
}

/**
 * Get display name for user
 * @param {object} user - User with name or email
 * @returns {string}
 */
export function getDisplayName(user) {
  if (!user) return 'Unknown';
  return user.name || user.email || user.id || 'Unknown';
}

/**
 * Get initials from name or email
 * @param {string|object} userOrName
 * @returns {string}
 */
export function getInitials(userOrName) {
  let name = typeof userOrName === 'string' ? userOrName : getDisplayName(userOrName);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get user role
 * @param {object} user
 * @returns {string}
 */
export function getUserRole(user) {
  return user?.role || 'user';
}

/**
 * Slugify string (URL-safe)
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate text
 * @param {string} text
 * @param {number} maxLength
 * @param {string} suffix
 * @returns {string}
 */
export function truncate(text, maxLength = 50, suffix = '...') {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Deep merge objects
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
export function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

/**
 * Generate a random color
 * @returns {string} Hex color
 */
export function randomColor() {
  const colors = [
    '#228be6', '#40c057', '#fab005', '#fa5252', '#15aabf',
    '#7950f2', '#f03e3e', '#2f9e44', '#e67700', '#cc5de8',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Determine whether a user record is active (ported from moonlanding).
 * Treats explicit inactive/disabled/suspended status, falsy `is_active`,
 * or a set `deleted_at` as inactive.
 * @param {object} user
 * @returns {boolean}
 */
export function isUserActive(user) {
  if (!user) return false;
  if (user.is_active === false || user.is_active === 0) return false;
  if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'suspended') return false;
  if (user.deleted_at) return false;
  return true;
}
