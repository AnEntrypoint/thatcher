import { getBy, verifyPassword, migrate } from '@/engine';
import { initializeSystemConfig } from '@/config/system-config-loader';
import { withErrorHandler } from '@/lib/with-error-handler';
import { lucia } from '@/engine.server';

let initialized = false;

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (Date.now() - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.firstAttempt + LOCKOUT_MS - Date.now()) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip) {
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  record.count++;
  loginAttempts.set(ip, record);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

export const POST = withErrorHandler(async (request) => {
  if (!initialized) {
    initialized = true;
    try {
      await initializeSystemConfig();
      migrate();
    } catch (e) {
      console.error('[Login] Init failed:', e.message);
      return new Response(JSON.stringify({ error: 'System init failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const ip = request.headers?.get?.('x-forwarded-for') || request.headers?.['x-forwarded-for'] || 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ error: 'Too many login attempts. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) }
    });
  }

  try {
    let email, password;
    const body = request.body;

    if (typeof body === 'object' && body !== null) {
      email = body.email;
      password = body.password;
    } else if (typeof body === 'string') {
      const params = new URLSearchParams(body);
      email = params.get('email');
      password = params.get('password');
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const user = getBy('user', 'email', email);
    if (!user) {
      recordFailedAttempt(ip);
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!user.password_hash) {
      recordFailedAttempt(ip);
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      recordFailedAttempt(ip);
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    clearAttempts(ip);

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}; Path=/; HttpOnly; SameSite=Lax${sessionCookie.attributes.secure ? '; Secure' : ''}`;

    const responseBody = JSON.stringify({
      status: 'success',
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

    return new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader
      }
    });
  } catch (err) {
    console.error('[Login] Error:', err.message);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}, 'Auth:Login');
