import { getBy } from '@/engine';
import { lucia } from '@/engine.server';
import { getDatabase, now } from '@/lib/database-core';
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
  const db = getDatabase();

  let bridgeRecord;
  try {
    bridgeRecord = db.prepare('SELECT * FROM mwr_bridge_tokens WHERE token_hash = ? AND used = 0').get(tokenHash);
  } catch (e) {
    db.exec(`CREATE TABLE IF NOT EXISTS mwr_bridge_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_mwr_bridge_token ON mwr_bridge_tokens(token_hash)');
    bridgeRecord = null;
  }

  const user = getBy('user', 'email', email.toLowerCase().trim());
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found in Moonlanding' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (bridgeRecord) {
    if (bridgeRecord.expires_at < now()) {
      db.prepare('UPDATE mwr_bridge_tokens SET used = 1 WHERE id = ?').run(bridgeRecord.id);
      return new Response(JSON.stringify({ error: 'Bridge token has expired' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (bridgeRecord.email.toLowerCase() !== email.toLowerCase().trim()) {
      return new Response(JSON.stringify({ error: 'Token email mismatch' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    db.prepare('UPDATE mwr_bridge_tokens SET used = 1 WHERE id = ?').run(bridgeRecord.id);
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
