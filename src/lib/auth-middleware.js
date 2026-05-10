/**
 * Auth Middleware - Authentication and authorization utilities
 * Adapted from moonlanding/src/lib/auth-middleware.js
 */

import { getUser, lucia } from '../engine.server.js'; // Will need to adapt
import { getSpec } from './spec-helpers.js';
import { can } from '../services/permission.service.js';
import { UnauthorizedError, PermissionError, NotFoundError } from './error-handler.js';

const actionMap = {
  list: 'list',
  get: 'view',
  view: 'view',
  create: 'create',
  update: 'edit',
  edit: 'edit',
  delete: 'delete',
};

/**
 * Get session token from request headers
 * @param {object} req - HTTP request
 * @returns {string|null}
 */
export function getSessionToken(req) {
  const cookieHeader = req?.headers?.cookie || '';
  if (!cookieHeader) return null;
  const cookieName = lucia?.sessionCookieName || 'thatcher_session';
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(cookieName + '='));
  if (!match) return null;
  const value = match.split('=')[1];
  return value ? decodeURIComponent(value.trim()) : null;
}

/**
 * Require authentication (throws if not authenticated)
 * @returns {Promise<object>} User object
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) throw UnauthorizedError('Authentication required');
  return user;
}

/**
 * Require permission for action on spec
 * @param {object} user
 * @param {object} spec
 * @param {string} action
 */
export async function requirePermission(user, spec, action) {
  const mapped = actionMap[action] || action;
  if (!(await can(user, spec, mapped))) {
    throw PermissionError(`Cannot ${action} ${spec.name}`);
  }
}

/**
 * Create authenticated handler wrapper
 * @param {Function} handler
 * @param {string} action
 * @returns {Function}
 */
export function withAuth(handler, action = 'view') {
  return async (request, context) => {
    const user = await requireAuth();
    const entity = context.params?.entity || context.entity;
    const spec = entity ? getSpec(entity) : null;
    if (spec) await requirePermission(user, spec, action);
    return handler(request, { ...context, user, spec });
  };
}

/**
 * Page auth (for HTML page rendering)
 * @param {string} entityName
 * @param {string} action
 * @param {object} options
 * @returns {Promise<{user, spec}>}
 */
export async function withPageAuth(entityName, action = 'view', options = {}) {
  const user = await getUser();
  if (!user) throw UnauthorizedError('Not authenticated');

  let spec;
  try {
    spec = getSpec(entityName);
  } catch {
    throw NotFoundError(`Entity ${entityName} not found`);
  }

  if (options.notEmbedded !== false && spec.embedded) {
    throw NotFoundError('Entity is embedded');
  }

  if (!(await can(user, spec, actionMap[action] || action))) {
    throw PermissionError(`Cannot ${action} ${entityName}`);
  }

  return { user, spec };
}
