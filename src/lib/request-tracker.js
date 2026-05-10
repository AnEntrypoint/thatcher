import { recordRequest, recordError } from '@/lib/metrics-collector.js'

function wrapHandler(handler, metadata = {}) {
  return async (request, context) => {
    const start = process.hrtime.bigint()
    const method = request.method
    const path = new URL(request.url).pathname

    try {
      const response = await handler(request, context)
      const duration = Number(process.hrtime.bigint() - start) / 1000000
      const status = response.status || 200

      recordRequest(path, method, duration, status)

      return response
    } catch (err) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000

      recordRequest(path, method, duration, 500)
      recordError(path, method, err.message, err.stack)

      throw err
    }
  }
}

function trackRequest(path, method, duration, status) {
  recordRequest(path, method, duration, status)
}

function trackError(path, method, error, stack) {
  recordError(path, method, error, stack)
}

export { wrapHandler, trackRequest, trackError }

if (typeof globalThis !== 'undefined') {
  globalThis.__requestTracker = {
    trackRequest,
    trackError
  }
}
