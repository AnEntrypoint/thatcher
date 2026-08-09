import crypto from 'crypto';

// Short-lived (5 min), single-use state store for OAuth CSRF protection. A
// long-lived state (e.g. reusing the session TTL, as the orphaned
// app/api/auth/google route did) widens the CSRF window far past what an
// authorization-code round trip needs; 5 minutes is generous for a login flow
// and small for an attacker to exploit.
const TTL_MS = 5 * 60 * 1000;
const store = new Map();

let sweepHandle = null;
function ensureSweep() {
  if (sweepHandle) return;
  sweepHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) store.delete(key);
    }
  }, TTL_MS);
  if (sweepHandle.unref) sweepHandle.unref();
}

export function createOAuthState(data) {
  ensureSweep();
  const key = crypto.randomBytes(32).toString('hex');
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
  return key;
}

// Single-use: a matched state is deleted on first read, so a replayed
// callback URL (e.g. from browser history or a leaked Referer) cannot
// re-consume the same state a second time.
export function consumeOAuthState(key) {
  const entry = store.get(key);
  if (!entry) return null;
  store.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry.data;
}
