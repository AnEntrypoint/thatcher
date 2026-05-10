import { NextResponse } from '@/lib/next-polyfills';
import { SESSION } from '@/config/auth-config';
import { HTTP } from '@/config/constants';

const oauthStateStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of oauthStateStore) {
    if (data.expiresAt < now) {
      oauthStateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function validateOAuthProvider(provider) {
  if (!provider) {
    return {
      valid: false,
      error: 'OAuth not configured',
    };
  }
  return { valid: true };
}

export async function setOAuthCookie(name, value, options = {}) {
  const timestamp = Date.now();
  const key = `oauth-${timestamp}-${Math.random().toString(36).substring(7)}`;
  const expiresAt = timestamp + (SESSION.cookieMaxAge * 1000);

  oauthStateStore.set(key, {
    value,
    expiresAt,
    createdAt: timestamp,
  });

  return key;
}

export async function getOAuthCookie(name) {
  const key = name;

  const data = oauthStateStore.get(key);

  if (!data) {
    return null;
  }

  if (data.expiresAt < Date.now()) {
    oauthStateStore.delete(key);
    return null;
  }

  return data.value;
}

export async function deleteOAuthCookie(name) {
  const key = name;
  if (key) {
    oauthStateStore.delete(key);
  }
}

export function buildOAuthErrorResponse(message, request) {
  if (request) {
    return NextResponse.redirect(new URL(`/login?error=${message}`, request.url));
  }
  return NextResponse.json({ error: message }, { status: HTTP.INTERNAL_ERROR });
}

export function buildOAuthSuccessRedirect(path, request) {
  return NextResponse.redirect(new URL(path, request.url));
}

export function validateOAuthState(code, state, storedState, storedCodeVerifier) {
  if (!code || !state) {
    return { valid: false, error: 'invalid_state' };
  }
  if (!storedState || !storedCodeVerifier) {
    return { valid: false, error: 'state_not_found' };
  }
  return { valid: true };
}
