/*
 * Lucia v3 session adapter backed by busybase (replaces @lucia-auth/adapter-sqlite's
 * BetterSqlite3Adapter). Sessions live in the `sessions` table, users in `users`.
 *
 * Lucia stores a session row as { id, user_id, expires_at, ...attributes } and a user
 * row as { id, ...attributes }. Lucia expects expires_at as a JS Date in the objects it
 * receives back; busybase stores it as an epoch-ms number, so we convert at the boundary.
 */

import { list, get, create, update, remove } from '@/lib/busybase/store.js';

const SESSION = 'sessions';
const USER = 'users';

function rowToSession(row) {
  if (!row) return null;
  const { id, user_id, expires_at, ...rest } = row;
  return { id, userId: user_id, expiresAt: new Date(Number(expires_at)), attributes: rest };
}

function rowToUser(row) {
  if (!row) return null;
  const { id, ...attributes } = row;
  return { id, attributes };
}

export class BusyBaseLuciaAdapter {
  async getSessionAndUser(sessionId) {
    const sRow = await get(SESSION, sessionId);
    if (!sRow) return [null, null];
    const session = rowToSession(sRow);
    const uRow = await get(USER, session.userId);
    return [session, rowToUser(uRow)];
  }

  async getUserSessions(userId) {
    const rows = await list(SESSION, { user_id: userId });
    return rows.map(rowToSession);
  }

  async setSession(session) {
    await create(SESSION, {
      id: session.id,
      user_id: session.userId,
      expires_at: session.expiresAt instanceof Date ? session.expiresAt.getTime() : Number(session.expiresAt),
      ...session.attributes,
    });
  }

  async updateSessionExpiration(sessionId, expiresAt) {
    await update(SESSION, sessionId, {
      expires_at: expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt),
    });
  }

  async deleteSession(sessionId) {
    await remove(SESSION, sessionId);
  }

  async deleteUserSessions(userId) {
    const rows = await list(SESSION, { user_id: userId });
    for (const r of rows) await remove(SESSION, r.id);
  }

  async deleteExpiredSessions() {
    const now = Date.now();
    const rows = await list(SESSION, {});
    for (const r of rows) {
      if (Number(r.expires_at) <= now) await remove(SESSION, r.id);
    }
  }
}
