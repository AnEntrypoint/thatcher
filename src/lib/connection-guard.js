class ConnectionGuard {
  constructor(config) {
    this.config = config
    this.ipConnections = new Map()
    this.messageRates = new Map()
    this.pingIntervalId = null
  }

  checkConnectionLimit(ip) {
    const count = this.ipConnections.get(ip) || 0
    return count < this.config.maxConnectionsPerIP
  }

  trackIPConnection(ip) {
    this.ipConnections.set(ip, (this.ipConnections.get(ip) || 0) + 1)
  }

  untrackIPConnection(ip) {
    const count = this.ipConnections.get(ip) || 0
    if (count <= 1) {
      this.ipConnections.delete(ip)
    } else {
      this.ipConnections.set(ip, count - 1)
    }
  }

  checkRateLimit(clientId) {
    const now = Date.now()
    const rate = this.messageRates.get(clientId) || { count: 0, window: now }

    if (now - rate.window > 1000) {
      rate.count = 1
      rate.window = now
    } else {
      rate.count++
    }

    this.messageRates.set(clientId, rate)
    return rate.count <= this.config.messageRateLimit
  }

  clearRateLimit(clientId) {
    this.messageRates.delete(clientId)
  }

  startPingInterval(clients, onDead) {
    this.pingIntervalId = setInterval(() => {
      for (const [clientId, client] of clients) {
        if (!client.alive) {
          client.ws.terminate()
          onDead(clientId)
        } else {
          client.alive = false
          client.ws.ping()
        }
      }
    }, this.config.pingInterval)
  }

  stopPingInterval() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId)
      this.pingIntervalId = null
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  destroy() {
    this.stopPingInterval()
    this.ipConnections.clear()
    this.messageRates.clear()
  }
}

export { ConnectionGuard }
export default ConnectionGuard
