// In-memory presence: who is currently viewing entity+id. No persistence --
// presence is inherently ephemeral, and a restart clearing it is correct
// behavior, not data loss. Swept on a timer the same way scheduler-engine.js
// sweeps due jobs, so a closed tab's viewer entry disappears on its own
// without requiring an explicit "leaving" signal the client might never send.
const STALE_AFTER_MS = 30 * 1000;
const SWEEP_INTERVAL_MS = 15 * 1000;
const presence = new Map();

let sweepHandle = null;
function ensureSweep() {
  if (sweepHandle) return;
  sweepHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, viewers] of presence) {
      for (const [userId, entry] of viewers) {
        if (now - entry.lastSeenAt > STALE_AFTER_MS) viewers.delete(userId);
      }
      if (viewers.size === 0) presence.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  if (sweepHandle.unref) sweepHandle.unref();
}

function keyFor(entity, id) {
  return `${entity}:${id}`;
}

export function heartbeat(entity, id, userId, userName) {
  ensureSweep();
  const key = keyFor(entity, id);
  let viewers = presence.get(key);
  if (!viewers) { viewers = new Map(); presence.set(key, viewers); }
  viewers.set(userId, { userId, userName, lastSeenAt: Date.now() });
}

// Excludes the requester so a solo viewer never sees themselves listed as
// "someone else is viewing this record" -- the indicator is meaningless (and
// mildly alarming) if it counts the person reading it.
export function getViewers(entity, id, excludeUserId) {
  const key = keyFor(entity, id);
  const viewers = presence.get(key);
  if (!viewers) return [];
  const now = Date.now();
  return [...viewers.values()]
    .filter(v => v.userId !== excludeUserId && now - v.lastSeenAt <= STALE_AFTER_MS)
    .map(v => ({ userId: v.userId, userName: v.userName }));
}

export function resetPresence() {
  presence.clear();
}
