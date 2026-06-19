// Simplified extraction from moonlanding/src/engine.server.js
import { Lucia } from 'lucia';
import { Google } from 'arctic';
import bcrypt from 'bcrypt';
import { BusyBaseLuciaAdapter } from './lib/busybase-lucia-adapter.js';
import { buildConfig, hasGoogleAuth } from './config/env.js';

let _lucia = null;
let _google = null;
let _adapter = null;

export function initAuth(config = null) {
  const cfg = config || buildConfig();

  _adapter = new BusyBaseLuciaAdapter();

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

export function getLucia() {
  if (!_lucia) initAuth();
  return _lucia;
}

export function getGoogle() {
  if (!_google) initAuth();
  return _google;
}

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

export function setCurrentRequest(req) {
  _currentRequest = req;
}

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

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createSession(userId) {
  const lucia = getLucia();
  // Note: cookies() requires Next.js polyfill in moonlanding; for SDK we return session data
  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  return { session, sessionCookie };
}

export async function invalidateSession() {
  const lucia = getLucia();
  // Simplified - caller handles cookie clearing
  // In full app this uses @lucia-auth/adapter-sqlite's cookie management
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function getUserByEmail(email) {
  const { getBy } = await import('./lib/busybase-store.js');
  return getBy('user', 'email', email);
}

export async function createUser(userData) {
  const hashedPassword = await hashPassword(userData.password);
  const { create } = await import('./lib/busybase-store.js');
  return create('user', {
    ...userData,
    password: hashedPassword,
  }, { id: 'system' });
}

export async function authenticate(email, password) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password);
  if (!valid) return null;

  return user;
}
