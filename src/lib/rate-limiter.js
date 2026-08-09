// Fixed-window per-key rate limiter, in-memory. Keyed by authenticated user id
// when available, otherwise by remote IP, so one anonymous IP hammering the
// API can't exhaust a budget shared with real users behind the same NAT --
// each authenticated user gets their own independent window.
const WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 300;
const buckets = new Map();

let sweepHandle = null;
function ensureSweep() {
  if (sweepHandle) return;
  sweepHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
    }
  }, WINDOW_MS);
  if (sweepHandle.unref) sweepHandle.unref();
}

export function checkRateLimit(key, limit = DEFAULT_LIMIT) {
  ensureSweep();
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  const resetMs = bucket.windowStart + WINDOW_MS - now;
  return { allowed: bucket.count <= limit, remaining, resetMs, limit };
}

export function resetRateLimiter() {
  buckets.clear();
}
