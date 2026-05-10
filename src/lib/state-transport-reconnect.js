import Protocol from './state-protocol.js'

const CONFIG = {
  reconnectInitialDelay: 1000,
  reconnectMaxDelay: 30000,
  reconnectBackoffFactor: 2,
  pingInterval: 25000,
  connectionTimeout: 10000,
  pollingInterval: 5000,
  pollingFallbackDelay: 3000
}

class ReconnectManager {
  constructor(config, callbacks) {
    this.config = config
    this.callbacks = callbacks
    this.reconnectAttempts = 0
    this.reconnectTimer = null
    this.pingTimer = null
    this.pollingTimer = null
    this.lastPongTime = 0
    this.useFallback = false
    this.wsUrl = null
  }

  get shouldFallback() {
    return this.reconnectAttempts >= 3 && !this.useFallback
  }

  resetAttempts() {
    this.reconnectAttempts = 0
    this.useFallback = false
  }

  recordPong() {
    this.lastPongTime = Date.now()
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const delay = Math.min(
      this.config.reconnectInitialDelay * Math.pow(this.config.reconnectBackoffFactor, this.reconnectAttempts),
      this.config.reconnectMaxDelay
    )

    const jitter = Math.random() * 1000
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      this.callbacks.onReconnecting({ attempt: this.reconnectAttempts })
    }, delay + jitter)
  }

  activateFallback() {
    this.useFallback = true
    this.callbacks.onFallback('Switching to polling mode')
    this.startPolling()
  }

  startPolling() {
    if (this.pollingTimer) return

    this.pollingTimer = setInterval(async () => {
      try {
        this.callbacks.onPollStart()
        const result = await this.pollState()
        this.callbacks.onPollSuccess(result)
      } catch (error) {
        this.callbacks.onPollError(error)
      }
    }, this.config.pollingInterval)
  }

  async pollState() {
    const httpUrl = this.wsUrl.replace('ws://', 'http://').replace('wss://', 'https://')
    const response = await fetch(`${httpUrl}/poll`)
    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`)
    }
    return await response.json()
  }

  startPingInterval(sendFn, closeFn) {
    this.pingTimer = setInterval(() => {
      sendFn(Protocol.createPing())
      const timeSinceLastPong = Date.now() - this.lastPongTime
      if (timeSinceLastPong > this.config.pingInterval * 2) {
        closeFn()
      }
    }, this.config.pingInterval)
  }

  stopPingInterval() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPolling()
    this.stopPingInterval()
  }
}

export { CONFIG, ReconnectManager }
export default ReconnectManager
