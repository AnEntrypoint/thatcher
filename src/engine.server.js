/**
 * Auth Engine - Lucia session management and Google OAuth
 * Simplified extraction from moonlanding/src/engine.server.js
 */

import { Lucia } from 'lucia';
import { BetterSqlite3Adapter } from '@lucia-auth/adapter-sqlite';
import { Google } from 'arctic';
import bcrypt from 'bcrypt';
import { getDatabase } from './database-core.js';
import { buildConfig, hasGoogleAuth } from '../config/env.js';

let _lucia = null;
let _google = null;
let _adapter = null;

/**
 * Initialize auth engine with database and config
 * @param {object} [config] - Optional config override
 */
export function initAuth(config = null) {
  const cfg = config || buildConfig();
  const db = getDatabase(cfg.db.path);

  _adapter = new BetterSqlite3Adapter(db, { user: 'users', session: 'sessions' });

  _lucia = new Lucia(_adapter, {
    sessionCookie: {
      expires: cfg.auth.session.expires,
      attributes: {
        secure: cfg.auth.session.secure,
        httpOnly: true,
        sameSite: 'lax',
      },
    },
    getUserAttributes: (row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      type: row.type,
      role: row.role,
    }),
  });

  if (hasGoogleAuth(cfg)) {
    _google = new Google(
      cfg.auth.google.clientId,
      cfg.auth.google.clientSecret,
      cfg.auth.google.redirectUri
    );
  }

  return { lucia: _lucia, google: _google };
}

/**
 * Get Lucia instance
 * @returns {Lucia}
 */
export function getLucia() {
  if (!_lucia) initAuth();
  return _lucia;
}

/**
 * Get Google OAuth client
 * @returns {Google|null}
 */
export function getGoogle() {
  if (!_google) initAuth();
  return _google;
}

/**
 * Parse cookies from header
 * @param {string} cookieHeader
 * @returns {object}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

let _currentRequest = null;

/**
 * Set current request context (for auth)
 * @param {object} req
 */
export function setCurrentRequest(req) {
  _currentRequest = req;
}

/**
 * Get current user from session
 * @returns {object|null}
 */
export async function getUser() {
  try {
    const request = _currentRequest;
    if (!request) return null;

    const lucia = getLucia();
    const cookies = parseCookies(request.headers?.cookie || '');
    const sessionId = cookies[lucia.sessionCookieName];
    if (!sessionId) return null;

    const { user, session } = await lucia.validateSession(sessionId);
    if (!user || !session) return null;

    return user;
  } catch {
    return null;
  }
}

/**
 * Require user (throw if not authenticated)
 * @returns {Promise<object>}
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

/**
 * Create a new session
 * @param {string} userId
 * @returns {{session: object, sessionCookie: object}}
 */
export async function createSession(userId) {
  const lucia = getLucia();
  // Note: cookies() requires Next.js polyfill in moonlanding; for SDK we return session data
  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  return { session, sessionCookie };
}

/**
 * Invalidate current session
 */
export async function invalidateSession() {
  const lucia = getLucia();
  // Simplified - caller handles cookie clearing
  // In full app this uses @lucia-auth/adapter-sqlite's cookie management
}

/**
 * Hash password with bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Verify password
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Get user by email
 * @param {string} email
 * @returns {object|null}
 */
export function getUserByEmail(email) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

/**
 * Create a new user
 * @param {object} userData
 * @returns {object}
 */
export async function createUser(userData) {
  const hashedPassword = await hashPassword(userData.password);
  const { create } = await import('./query-engine-write.js');
  return create('user', {
    ...userData,
    password: hashedPassword,
  }, { id: 'system' });
}

/**
 * Authenticate user with credentials
 * @param {string} email
 * @param {string} password
 * @returns {object|null} User if valid, null otherwise
 */
export async function authenticate(email, password) {
  const user = getUserByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password);
  if (!valid) return null;

  return user;
}
