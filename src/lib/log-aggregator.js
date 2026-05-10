const logs = []
const maxLogs = 10000

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4
}

let currentLevel = levels.info

function log(level, message, metadata = {}) {
  if (levels[level] < currentLevel) return

  const entry = {
    level,
    message,
    metadata,
    timestamp: Date.now(),
    iso: new Date().toISOString()
  }

  logs.push(entry)
  if (logs.length > maxLogs) logs.shift()

  const prefix = `[${entry.iso}] [${level.toUpperCase()}]`
  const metaStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : ''

  if (level === 'error' || level === 'critical') {
    console.error(prefix, message, metaStr)
  } else if (level === 'warn') {
    console.warn(prefix, message, metaStr)
  } else {
  }
}

function debug(message, metadata) {
  log('debug', message, metadata)
}

function info(message, metadata) {
  log('info', message, metadata)
}

function warn(message, metadata) {
  log('warn', message, metadata)
}

function error(message, metadata) {
  log('error', message, metadata)
}

function critical(message, metadata) {
  log('critical', message, metadata)
}

function getLogs(filter = {}) {
  let filtered = logs

  if (filter.level) {
    const minLevel = levels[filter.level]
    filtered = filtered.filter(l => levels[l.level] >= minLevel)
  }

  if (filter.since) {
    filtered = filtered.filter(l => l.timestamp >= filter.since)
  }

  if (filter.search) {
    const search = filter.search.toLowerCase()
    filtered = filtered.filter(l =>
      l.message.toLowerCase().includes(search) ||
      JSON.stringify(l.metadata).toLowerCase().includes(search)
    )
  }

  const limit = filter.limit || 100
  return filtered.slice(-limit)
}

function clearLogs() {
  logs.length = 0
}

function setLogLevel(level) {
  if (levels[level] !== undefined) {
    currentLevel = levels[level]
  }
}

export {
  log,
  debug,
  info,
  warn,
  error,
  critical,
  getLogs,
  clearLogs,
  setLogLevel
}

if (typeof globalThis !== 'undefined') {
  globalThis.__logs = {
    debug,
    info,
    warn,
    error,
    critical,
    getLogs,
    clearLogs,
    setLogLevel
  }
}
