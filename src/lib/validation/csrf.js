import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

if (!global.csrfTokenStore) {
  global.csrfTokenStore = new Map();
}

export function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const expiresAt = Date.now() + CSRF_TOKEN_EXPIRY;
  
  global.csrfTokenStore.set(token, { sessionId, expiresAt });
  
  return token;
}

export function validateCSRFToken(token, sessionId) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'CSRF token required' };
  }
  
  const record = global.csrfTokenStore.get(token);
  
  if (!record) {
    return { valid: false, reason: 'Invalid CSRF token' };
  }
  
  if (Date.now() > record.expiresAt) {
    global.csrfTokenStore.delete(token);
    return { valid: false, reason: 'CSRF token expired' };
  }
  
  if (record.sessionId !== sessionId) {
    return { valid: false, reason: 'CSRF token session mismatch' };
  }
  
  return { valid: true };
}

export function cleanupExpiredCSRFTokens() {
  const now = Date.now();
  for (const [token, record] of global.csrfTokenStore.entries()) {
    if (now > record.expiresAt) {
      global.csrfTokenStore.delete(token);
    }
  }
}

setInterval(cleanupExpiredCSRFTokens, 60 * 60 * 1000);
