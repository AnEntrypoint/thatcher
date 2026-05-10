/**
 * Utility Functions - Common helpers
 */

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
