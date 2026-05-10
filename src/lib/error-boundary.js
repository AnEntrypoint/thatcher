import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

const errorBoundaryState = new Map();

export class ErrorBoundary {
  constructor(id, options = {}) {
    this.id = id;
    this.fallback = options.fallback || this.defaultFallback.bind(this);
    this.onError = options.onError;
    this.reset = this.reset.bind(this);

    errorBoundaryState.set(id, {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  }

  getState() {
    return errorBoundaryState.get(this.id);
  }

  setState(updates) {
    const current = this.getState();
    errorBoundaryState.set(this.id, { ...current, ...updates });
  }

  catchError(error, errorInfo = {}) {
    const state = this.getState();

    console.error(`[ErrorBoundary:${this.id}] Caught error:`, error);

    this.setState({
      hasError: true,
      error,
      errorInfo,
      retryCount: state.retryCount + 1
    });

    if (this.onError) {
      this.onError(error, errorInfo);
    }
  }

  reset() {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  defaultFallback(error, retry) {
    const state = this.getState();

    return _jsxs('div', {
      className: 'p-6 bg-error-content border border-error rounded-lg',
      children: [
        _jsx('h2', {
          className: 'text-xl font-bold mb-2 text-error',
          children: 'Something went wrong'
        }),
        _jsx('p', {
          className: 'text-sm mb-4',
          children: String(error?.message || 'An unexpected error occurred')
        }),
        state.retryCount < 3 && _jsx('button', {
          onClick: retry,
          className: 'btn btn-primary btn-sm',
          children: 'Try again'
        }),
        state.retryCount >= 3 && _jsx('p', {
          className: 'text-sm text-error',
          children: 'Please refresh the page or contact support'
        })
      ]
    });
  }

  render(children) {
    const state = this.getState();

    if (state.hasError) {
      return this.fallback(state.error, this.reset);
    }

    return children;
  }
}

export function createErrorBoundary(id, options = {}) {
  return new ErrorBoundary(id, options);
}

export function wrapWithErrorBoundary(component, id, options = {}) {
  const boundary = createErrorBoundary(id, options);

  return (...args) => {
    try {
      const result = component(...args);
      return boundary.render(result);
    } catch (error) {
      boundary.catchError(error);
      return boundary.render(null);
    }
  };
}

export async function tryCatch(fn, fallback = null) {
  try {
    return await fn();
  } catch (error) {
    console.error('[tryCatch] Error caught:', error);
    return fallback;
  }
}

export function safeRender(component, props = {}, fallback = null) {
  try {
    return component(props);
  } catch (error) {
    console.error('[safeRender] Render error:', error);
    return fallback || _jsx('div', {
      className: 'p-4 text-error',
      children: 'Failed to render component'
    });
  }
}

if (typeof global !== 'undefined') {
  global.errorBoundaryState = errorBoundaryState;
  global.createErrorBoundary = createErrorBoundary;
}
