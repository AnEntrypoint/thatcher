import { WebSocketServer } from 'ws'
import { EventEmitter } from 'events'
import Protocol from '@/lib/state-protocol.js'
import ConnectionGuard from '@/lib/connection-guard.js'

const CONFIG = {
  pingInterval: 30000,
  connectionTimeout: 60000,
  maxConnectionsPerIP: 10,
  messageRateLimit: 100
}

class StateTransportServer extends EventEmitter {
  constructor(server, config = {}) {
    super()
    this.config = { ...CONFIG, ...config }
    this.wss = null
    this.clients = new Map()
    this.server = server
    this.guard = new ConnectionGuard(this.config)
    this.setupServer()
  }

  setupServer() {
    try {
      this.wss = new WebSocketServer({ server: this.server, path: '/state-sync' })
      this.wss.on('connection', (ws, req) => this.handleConnection(ws, req))
      this.wss.on('error', (error) => this.handleError(error))
      this.guard.startPingInterval(this.clients, (id) => this.handleClose(id))
      this.emit('ready')
    } catch (error) {
      this.emit('error', error)
      setTimeout(() => this.setupServer(), 5000)
    }
  }

  handleConnection(ws, req) {
    const clientId = this.guard.generateClientId()
    const ip = req.socket.remoteAddress

    if (!this.guard.checkConnectionLimit(ip)) {
      ws.close(1008, 'Too many connections from this IP')
      return
    }

    const client = {
      id: clientId,
      ws,
      ip,
      alive: true,
      connectedAt: Date.now(),
      messageCount: 0
    }

    this.clients.set(clientId, client)
    this.guard.trackIPConnection(ip)

    ws.on('message', (data) => this.handleMessage(clientId, data))
    ws.on('close', () => this.handleClose(clientId))
    ws.on('error', (error) => this.handleClientError(clientId, error))
    ws.on('pong', () => { client.alive = true })

    this.emit('client_connected', clientId)
  }

  handleMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId)
      if (!client) return

      if (!this.guard.checkRateLimit(clientId)) {
        this.sendMessage(clientId, Protocol.createStateNack(
          null,
          'Rate limit exceeded',
          Protocol.ERROR_CODES.RATE_LIMITED
        ))
        return
      }

      const message = JSON.parse(data.toString())
      const validation = Protocol.MessageSchema.validate(message)

      if (!validation.valid) {
        this.sendMessage(clientId, Protocol.createStateNack(
          message.id,
          validation.error,
          Protocol.ERROR_CODES.INVALID_MESSAGE
        ))
        return
      }

      client.messageCount++
      this.emit('message', clientId, message)

      if (message.type === Protocol.MESSAGE_TYPES.PING) {
        this.sendMessage(clientId, Protocol.createPong(message.timestamp))
      }
    } catch (error) {
      this.emit('error', { clientId, error, phase: 'message_handling' })
    }
  }

  handleClose(clientId) {
    const client = this.clients.get(clientId)
    if (client) {
      this.guard.untrackIPConnection(client.ip)
      this.clients.delete(clientId)
      this.guard.clearRateLimit(clientId)
      this.emit('client_disconnected', clientId)
    }
  }

  handleClientError(clientId, error) {
    this.emit('error', { clientId, error, phase: 'client_error' })
  }

  handleError(error) {
    this.emit('error', { error, phase: 'server_error' })
  }

  sendMessage(clientId, message) {
    try {
      const client = this.clients.get(clientId)
      if (client && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(message))
        return true
      }
      return false
    } catch (error) {
      this.emit('error', { clientId, error, phase: 'send_message' })
      return false
    }
  }

  broadcast(message, excludeClientId = null) {
    const results = { sent: 0, failed: 0 }
    for (const [clientId] of this.clients) {
      if (clientId === excludeClientId) continue
      if (this.sendMessage(clientId, message)) {
        results.sent++
      } else {
        results.failed++
      }
    }
    return results
  }

  getClientCount() {
    return this.clients.size
  }

  getClient(clientId) {
    return this.clients.get(clientId)
  }

  close() {
    this.guard.destroy()
    for (const client of this.clients.values()) {
      client.ws.close()
    }
    this.clients.clear()
    if (this.wss) {
      this.wss.close()
    }
  }
}

if (!global.stateTransportServer) {
  global.stateTransportServer = null
}

export function createStateTransportServer(server, config) {
  if (global.stateTransportServer) {
    global.stateTransportServer.close()
  }
  global.stateTransportServer = new StateTransportServer(server, config)
  return global.stateTransportServer
}

export { StateTransportServer }
export default StateTransportServer
