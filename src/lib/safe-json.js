export const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str || 'null') ?? fallback;
  } catch {
    console.warn('[SafeJSON] Parse failed:', str?.substring(0, 50));
    return fallback;
  }
};
