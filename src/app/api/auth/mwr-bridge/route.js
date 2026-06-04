import { getBy, list, update } from '@/engine';
import { lucia } from '@/engine.server';
import { now } from '@/lib/id-helpers';
import { withErrorHandler } from '@/lib/with-error-handler';
import crypto from 'crypto';

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const { token, email } = body || {};

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  let bridgeRecord = null;
  try {
    const matches = (await list('mwr_bridge_tokens', { token_hash: tokenHash }))
      .filter(r => !r.used || r.used === 0);
    bridgeRecord = matches[0] || null;
  } catch { bridgeRecord = null; }

  const user = await getBy('user', 'email', email.toLowerCase().trim());
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (bridgeRecord) {
    if (bridgeRecord.expires_at < now()) {
      await update('mwr_bridge_tokens', bridgeRecord.id, { used: 1 });
      return new Response(JSON.stringify({ error: 'Bridge token has expired' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (bridgeRecord.email.toLowerCase() !== email.toLowerCase().trim()) {
      return new Response(JSON.stringify({ error: 'Token email mismatch' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    await update('mwr_bridge_tokens', bridgeRecord.id, { used: 1 });
  }

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}; Path=/; HttpOnly; SameSite=Lax${sessionCookie.attributes.secure ? '; Secure' : ''}`;

  return new Response(JSON.stringify({
    status: 'success',
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieHeader }
  });
}, 'Auth:MWRBridge');
