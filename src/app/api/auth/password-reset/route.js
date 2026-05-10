import { getBy } from '@/engine';
import { hashPassword } from '@/engine';
import { getDatabase, genId, now } from '@/lib/database-core';
import { withErrorHandler } from '@/lib/with-error-handler';
import crypto from 'crypto';

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const email = body?.email?.trim()?.toLowerCase();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const user = getBy('user', 'email', email);

  if (user) {
    const db = getDatabase();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = now() + 3600;

    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(genId(), user.id, token, expiresAt, now());

  }

  return new Response(JSON.stringify({ status: 'success', message: 'If an account exists with that email, a reset link has been sent.' }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}, 'Auth:PasswordReset');

export const PUT = withErrorHandler(async (request) => {
  const body = await request.json();
  const { token, password } = body || {};

  if (!token || !password) {
    return new Response(JSON.stringify({ error: 'Token and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const db = getDatabase();
  const resetToken = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0').get(token);

  if (!resetToken) {
    return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (resetToken.expires_at < now()) {
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);
    return new Response(JSON.stringify({ error: 'Reset token has expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const passwordHash = await hashPassword(password);

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, resetToken.user_id);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(resetToken.user_id);

  return new Response(JSON.stringify({ status: 'success', message: 'Password updated successfully' }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}, 'Auth:PasswordResetConfirm');
