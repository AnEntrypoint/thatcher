import { createLogger } from './logger.js';
import crypto from 'crypto';
import { HTTP } from '@/config/constants';

const log = createLogger('[CSRF]');

const tokens = new Map();
const TOKEN_TTL = 3600000;

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokens.entries()) {
    if (now - data.createdAt > TOKEN_TTL) {
      tokens.delete(token);
    }
  }
}

export function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { createdAt: Date.now() });
  if (tokens.size > 10000) cleanExpiredTokens();
  return token;
}

export function validateToken(token) {
  if (!token || typeof token !== 'string') return false;
  const data = tokens.get(token);
  if (!data) return false;
  if (Date.now() - data.createdAt > TOKEN_TTL) {
    tokens.delete(token);
    return false;
  }
  tokens.delete(token);
  return true;
}

export async function withCsrfValidation(handler) {
  return async (request, context) => {
    const method = request.method?.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return handler(request, context);
    }

    try {
      const token = request.headers.get('x-csrf-token');

      if (!token || !validateToken(token)) {
        log.warn(`invalid token for ${method}`);
        return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
          status: HTTP.FORBIDDEN,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      log.error('validation error:', { message: e.message });
      return new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
        status: HTTP.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(request, context);
  };
}
