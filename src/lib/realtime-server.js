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
