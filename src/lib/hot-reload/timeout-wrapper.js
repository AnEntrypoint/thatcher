export class TimeoutError extends Error {
  constructor(message, operation) {
    super(message);
    this.name = 'TimeoutError';
    this.operation = operation;
  }
}

export function withTimeout(promise, ms, operation = 'operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`${operation} timed out after ${ms}ms`, operation));
    }, ms);
    promise
      .then(value => { clearTimeout(timer); resolve(value); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

export function withAbortableTimeout(fn, ms, operation = 'operation') {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => { controller.abort(); }, ms);

  return fn(signal)
    .then(result => { clearTimeout(timeoutId); return result; })
    .catch(err => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new TimeoutError(`${operation} aborted after ${ms}ms`, operation);
      }
      throw err;
    });
}

export async function retry(fn, options = {}) {
  const { maxRetries = 3, delayMs = 1000, backoff = true, onRetry = null } = options;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs;
        if (onRetry) onRetry(err, attempt + 1, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
