const MESSAGE_TYPES = {
  STATE_UPDATE: 'state_update',
  STATE_SNAPSHOT: 'state_snapshot',
  STATE_REQUEST: 'state_request',
  STATE_ACK: 'state_ack',
  STATE_NACK: 'state_nack',
  PING: 'ping',
  PONG: 'pong'
}

const ERROR_CODES = {
  INVALID_MESSAGE: 'invalid_message',
  INVALID_VERSION: 'invalid_version',
  CONFLICT_DETECTED: 'conflict_detected',
  RATE_LIMITED: 'rate_limited',
  VALIDATION_FAILED: 'validation_failed'
}

class VectorClock {
  constructor(nodeId) {
    this.nodeId = nodeId
    this.clock = { [nodeId]: 0 }
  }

  increment() {
    this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1
    return this.clock[this.nodeId]
  }

  update(otherClock) {
    for (const [nodeId, timestamp] of Object.entries(otherClock)) {
      this.clock[nodeId] = Math.max(this.clock[nodeId] || 0, timestamp)
    }
  }

  compare(otherClock) {
    const keys = new Set([...Object.keys(this.clock), ...Object.keys(otherClock)])
    let hasGreater = false
    let hasLess = false

    for (const key of keys) {
      const mine = this.clock[key] || 0
      const theirs = otherClock[key] || 0
      if (mine > theirs) hasGreater = true
      if (mine < theirs) hasLess = true
    }

    if (hasGreater && !hasLess) return 1
    if (hasLess && !hasGreater) return -1
    if (!hasGreater && !hasLess) return 0
    return null // Concurrent
  }

  serialize() {
    return { ...this.clock }
  }

  static deserialize(data, nodeId) {
    const vc = new VectorClock(nodeId)
    vc.clock = { ...data }
    return vc
  }
}

const MessageSchema = {
  validate(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Message must be an object' }
    }
    const validTypes = Object.values(MESSAGE_TYPES)
    if (!validTypes.includes(message.type)) {
      return { valid: false, error: 'Invalid message type' }
    }
    if (message.type !== MESSAGE_TYPES.PING && message.type !== MESSAGE_TYPES.PONG) {
      if (!message.version || typeof message.version !== 'object') {
        return { valid: false, error: 'Missing or invalid version vector' }
      }
    }
    if (message.type === MESSAGE_TYPES.STATE_UPDATE || message.type === MESSAGE_TYPES.STATE_SNAPSHOT) {
      if (message.data === undefined) {
        return { valid: false, error: 'Missing data field' }
      }
    }
    return { valid: true }
  }
}

function createMessage(type, payload = {}) {
  return {
    type,
    timestamp: Date.now(),
    ...payload
  }
}

function createStateUpdate(vectorClock, data, operations = []) {
  return createMessage(MESSAGE_TYPES.STATE_UPDATE, {
    version: vectorClock.serialize(),
    data,
    operations
  })
}

function createStateSnapshot(vectorClock, data) {
  return createMessage(MESSAGE_TYPES.STATE_SNAPSHOT, {
    version: vectorClock.serialize(),
    data
  })
}

function createStateRequest(vectorClock) {
  return createMessage(MESSAGE_TYPES.STATE_REQUEST, {
    version: vectorClock.serialize()
  })
}

function createStateAck(messageId, vectorClock) {
  return createMessage(MESSAGE_TYPES.STATE_ACK, {
    messageId,
    version: vectorClock.serialize()
  })
}

function createStateNack(messageId, error, errorCode) {
  return createMessage(MESSAGE_TYPES.STATE_NACK, {
    messageId,
    error,
    errorCode
  })
}

function createPing() {
  return createMessage(MESSAGE_TYPES.PING)
}

function createPong(pingTimestamp) {
  return createMessage(MESSAGE_TYPES.PONG, { pingTimestamp })
}

const Protocol = {
  MESSAGE_TYPES,
  ERROR_CODES,
  VectorClock,
  MessageSchema,
  createMessage,
  createStateUpdate,
  createStateSnapshot,
  createStateRequest,
  createStateAck,
  createStateNack,
  createPing,
  createPong
}

export {
  MESSAGE_TYPES,
  ERROR_CODES,
  VectorClock,
  MessageSchema,
  createMessage,
  createStateUpdate,
  createStateSnapshot,
  createStateRequest,
  createStateAck,
  createStateNack,
  createPing,
  createPong,
  Protocol
}

export default Protocol
