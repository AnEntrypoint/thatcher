// ws-broadcast channel: in-process pub/sub used by the CRUD layer to fan out
// entity create/update/delete notifications (see src/lib/api.js, which calls
// broadcastUpdate() on every write, and src/lib/index.js which re-exports this
// module). Despite the "(polling mode)" log line there is no actual transport
// here -- no WebSocket, no poll endpoint -- just an in-memory Map of
// channel -> Set<callback>, so subscribers must live in the same process.
//
// This is a DIFFERENT channel from the state-transport-*.js / state-protocol.js
// quartet (state-transport-server.js / state-transport-client.js /
// state-transport-reconnect.js): that stack is a real `ws`-backed WebSocket
// server+client with a structured message protocol, vector clocks, and
// reconnect/polling-fallback semantics, but as of this writing it has ZERO
// importers anywhere in the repo outside its own internal cross-imports --
// nothing constructs a StateTransportServer/StateTransportClient. So today
// state-transport-* does NOT supersede this file; this file (realtime-server.js)
// is the one actually wired into production (src/lib/api.js), while
// state-transport-* is a more capable but currently-unwired structured protocol.
// Do not delete either without re-checking real importers first.
import { createLogger } from './logger.js';

const log = createLogger('[Realtime]');

let subscribers = new Map(); // channel -> Set of callbacks
let enabled = false;

export function initRealtime(server) {
  if (!server) return;

  // Can be extended with ws library for full WebSocket support
  // For now, provides a polling-based notification system
  enabled = true;
  log.info('initialized (polling mode)');
}

export function broadcastUpdate(channel, event, data) {
  if (!enabled) return;

  const channelSubscribers = subscribers.get(channel);
  if (channelSubscribers) {
    const payload = { event, data, timestamp: Date.now() };
    channelSubscribers.forEach(cb => {
      try { cb(payload); } catch {}
    });
  }
}

export function subscribe(channel, callback) {
  if (!subscribers.has(channel)) {
    subscribers.set(channel, new Set());
  }
  subscribers.get(channel).add(callback);

  return () => {
    subscribers.get(channel)?.delete(callback);
  };
}

export function getStats() {
  return {
    channels: subscribers.size,
    totalSubscribers: Array.from(subscribers.values()).reduce((sum, set) => sum + set.size, 0),
  };
}
