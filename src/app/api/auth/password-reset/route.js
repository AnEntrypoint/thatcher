import { getBy, hashPassword, list, create, update, remove } from '@/engine';
import { genId, now } from '@/lib/id-helpers';
import { withErrorHandler } from '@/lib/with-error-handler';
import crypto from 'crypto';

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const email = body?.email?.trim()?.toLowerCase();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const user = await getBy('user', 'email', email);

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = now() + 3600;

    // Clear any existing reset tokens for this user, then issue a fresh one.
    const existing = await list('password_reset_tokens', { user_id: user.id });
    for (const t of existing) await remove('password_reset_tokens', t.id);
    await create('password_reset_tokens', { id: genId(), user_id: user.id, token, expires_at: expiresAt, used: 0, created_at: now() });
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

  const matches = (await list('password_reset_tokens', { token })).filter(t => !t.used || t.used === 0);
  const resetToken = matches[0];

  if (!resetToken) {
    return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (resetToken.expires_at < now()) {
    await update('password_reset_tokens', resetToken.id, { used: 1 });
    return new Response(JSON.stringify({ error: 'Reset token has expired. Please request a new one.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const passwordHash = await hashPassword(password);

  await update('user', resetToken.user_id, { password_hash: passwordHash });
  await update('password_reset_tokens', resetToken.id, { used: 1 });
  // Invalidate all sessions for this user.
  const sessions = await list('sessions', { user_id: resetToken.user_id });
  for (const s of sessions) await remove('sessions', s.id);

  return new Response(JSON.stringify({ status: 'success', message: 'Password updated successfully' }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}, 'Auth:PasswordResetConfirm');
