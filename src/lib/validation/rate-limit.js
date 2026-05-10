export function rateLimitCheck(identifier, maxRequests = 100, windowMs = 60000) {
  if (!global.rateLimitStore) global.rateLimitStore = {};
  
  const now = Date.now();
  const key = `rate:${identifier}`;
  const record = global.rateLimitStore[key] || { count: 0, resetAt: now + windowMs };
  
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  
  record.count++;
  global.rateLimitStore[key] = record;
  
  if (record.count > maxRequests) {
    return { allowed: false, reason: 'Rate limit exceeded', resetAt: record.resetAt };
  }
  
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

setInterval(() => {
  if (!global.rateLimitStore) return;
  const now = Date.now();
  for (const key of Object.keys(global.rateLimitStore)) {
    if (global.rateLimitStore[key].resetAt < now) {
      delete global.rateLimitStore[key];
    }
  }
}, 60000);
