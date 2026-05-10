import Protocol from './state-protocol.js'
import { CONFIG, ReconnectManager } from './state-transport-reconnect.js'

class StateTransportClient {
  constructor(config = {}) {
    this.config = { ...CONFIG, ...config }
    this.ws = null
    this.state = 'disconnected'
    this.listeners = new Map()
    this.messageQueue = []
    this.connectionTimeoutTimer = null

    this.reconnect = new ReconnectManager(this.config, {
      onReconnecting: (data) => { this.emit('reconnecting', data); this.connect() },
      onFallback: (msg) => this.emit('fallback', msg),
      onPollStart: () => this.emit('poll_start'),
      onPollSuccess: (result) => this.emit('poll_success', result),
      onPollError: (error) => this.emit('poll_error', error)
    })
  }

  connect(url) {
    this.url = url || this.url
    if (!this.url) {
      this.emit('error', new Error('No URL provided for connection'))
      return
    }
    this.reconnect.wsUrl = this.url

    if (this.state === 'connecting' || this.state === 'connected') return

    this.state = 'connecting'
    this.emit('connecting')

    try {
      this.ws = new WebSocket(this.url)

      this.connectionTimeoutTimer = setTimeout(() => {
        if (this.state === 'connecting') this.handleConnectionTimeout()
      }, this.config.connectionTimeout)

      this.ws.onopen = () => this.handleOpen()
      this.ws.onclose = (event) => this.handleClose(event)
      this.ws.onerror = (error) => this.handleError(error)
      this.ws.onmessage = (event) => this.handleMessage(event)
    } catch (error) {
      this.handleConnectionFailure(error)
    }
  }

  handleOpen() {
    clearTimeout(this.connectionTimeoutTimer)
    this.state = 'connected'
    this.reconnect.resetAttempts()
    this.emit('connected')
    this.reconnect.startPingInterval(
      (msg) => this.send(msg),
      () => this.ws.close()
    )
    this.flushMessageQueue()
    this.reconnect.stopPolling()
  }

  handleClose(event) {
    clearTimeout(this.connectionTimeoutTimer)
    this.state = 'disconnected'
    this.reconnect.stopPingInterval()
    this.emit('disconnected', { code: event.code, reason: event.reason })
    this.reconnect.scheduleReconnect()
  }

  handleError(error) {
    this.emit('error', error)
  }

  handleConnectionTimeout() {
    if (this.ws) this.ws.close()
    this.handleConnectionFailure(new Error('Connection timeout'))
  }

  handleConnectionFailure(error) {
    this.emit('error', error)
    this.state = 'disconnected'

    if (this.reconnect.shouldFallback) {
      this.reconnect.activateFallback()
    } else {
      this.reconnect.scheduleReconnect()
    }
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data)
      if (message.type === Protocol.MESSAGE_TYPES.PONG) {
        this.reconnect.recordPong()
        return
      }
      this.emit('message', message)
    } catch (error) {
      this.emit('error', { error, phase: 'message_parsing', data: event.data })
    }
  }

  send(message) {
    if (this.state === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message))
        return true
      } catch (error) {
        this.emit('error', { error, phase: 'send' })
        this.messageQueue.push(message)
        return false
      }
    }
    this.messageQueue.push(message)
    return false
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.state === 'connected') {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }

  disconnect() {
    this.reconnect.cleanup()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state = 'disconnected'
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event).push(handler)
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return
    const handlers = this.listeners.get(event)
    const index = handlers.indexOf(handler)
    if (index > -1) handlers.splice(index, 1)
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return
    for (const handler of this.listeners.get(event)) {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error)
      }
    }
  }

  getState() {
    return this.state
  }

  isConnected() {
    return this.state === 'connected'
  }
}

export { StateTransportClient }
export default StateTransportClient
