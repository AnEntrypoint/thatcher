export function safeError(err) {
  if (!err) return { message: 'Unknown error', type: 'Error' };
  if (typeof err === 'string') return { message: err, type: 'String' };

  const safe = {
    message: err.message || String(err),
    type: err.constructor?.name || 'Error',
    code: err.code,
    statusCode: err.statusCode,
    status: err.status
  };

  if (err.stack && typeof err.stack === 'string') {
    safe.stack = err.stack;
  }

  for (const key of Object.keys(err)) {
    if (safe[key] !== undefined) continue;
    const value = err[key];
    const type = typeof value;
    if (value === null || type === 'undefined') continue;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      safe[key] = value;
    } else if (type === 'object' && !Array.isArray(value)) {
      try { safe[key] = safeError(value); } catch { safe[key] = String(value); }
    } else if (Array.isArray(value)) {
      safe[key] = value.map(v => {
        const vType = typeof v;
        if (vType === 'string' || vType === 'number' || vType === 'boolean') return v;
        return String(v);
      });
    } else {
      safe[key] = String(value);
    }
  }
  return safe;
}

export function safeStringify(obj, space = 0) {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof Error) return safeError(value);
      const type = typeof value;
      if (type === 'symbol' || type === 'function' || type === 'undefined') return String(value);
      if (type === 'bigint') return value.toString();
      return value;
    }, space);
  } catch (err) {
    return JSON.stringify({ error: 'Serialization failed', message: String(err) }, null, space);
  }
}
