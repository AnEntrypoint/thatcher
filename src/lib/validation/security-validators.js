import { sanitizeHtml } from '@/lib/validate';

const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /eval\(/gi,
  /expression\(/gi
];

const SQL_INJECTION_PATTERNS = [
  /('|(\-\-)|(;)|(\|\|)|(\/\*)|(\*\/)|xp_)/gi,
  /(union|select|insert|update|delete|drop|create|alter|exec|execute)\s/gi,
  /0x[0-9a-f]+/gi,
  /char\(/gi,
  /concat\(/gi
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\\\/]/g,
  /\.\.%/g,
  /%2e%2e/gi,
  /\.\.\./g
];

export function detectXSS(input) {
  if (typeof input !== 'string') return { safe: true };
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: 'Potential XSS attack detected', pattern: pattern.toString() };
    }
  }
  return { safe: true };
}

export function detectSQLInjection(input) {
  if (typeof input !== 'string') return { safe: true };
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: 'Potential SQL injection detected', pattern: pattern.toString() };
    }
  }
  return { safe: true };
}

export function detectPathTraversal(input) {
  if (typeof input !== 'string') return { safe: true };
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: 'Path traversal attempt detected', pattern: pattern.toString() };
    }
  }
  return { safe: true };
}

export function sanitizeDeep(data) {
  if (typeof data === 'string') {
    const xssCheck = detectXSS(data);
    if (!xssCheck.safe) return '';
    const sqlCheck = detectSQLInjection(data);
    if (!sqlCheck.safe) return '';
    return sanitizeHtml(data);
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeDeep);
  }
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeDeep(value);
    }
    return sanitized;
  }
  return data;
}
