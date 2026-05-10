/**
 * Realtime Server - WebSocket/Server-Sent Events for live updates
 * Optional component - can be disabled if not needed
 */

let subscribers = new Map(); // channel -> Set of callbacks
let enabled = false;

/**
 * Initialize realtime (optional)
 * @param {object} server - HTTP server to attach WS endpoint
 */
export function initRealtime(server) {
  if (!server) return;

  // Can be extended with ws library for full WebSocket support
  // For now, provides a polling-based notification system
  enabled = true;
  console.log('[Realtime] Initialized (polling mode)');
}

/**
 * Broadcast update to all subscribers of a channel
 * @param {string} channel
 * @param {string} event
 * @param {any} data
 */
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

/**
 * Subscribe to updates for a channel
 * @param {string} channel
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export function subscribe(channel, callback) {
  if (!subscribers.has(channel)) {
    subscribers.set(channel, new Set());
  }
  subscribers.get(channel).add(callback);

  // Return unsubscribe function
  return () => {
    subscribers.get(channel)?.delete(callback);
  };
}

/**
 * Get update stats
 * @returns {object}
 */
export function getStats() {
  return {
    channels: subscribers.size,
    totalSubscribers: Array.from(subscribers.values()).reduce((sum, set) => sum + set.size, 0),
  };
}
