import { createLogger } from './logger.js';

const log = createLogger('[SafeJSON]');

export const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str || 'null') ?? fallback;
  } catch {
    log.warn('parse failed:', { preview: str?.substring(0, 50) });
    return fallback;
  }
};
