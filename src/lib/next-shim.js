// next-shim.js
//
// Merged compatibility layer standing in for parts of the real Next.js API
// surface, so thatcher's route handlers (src/app/api/**/route.js) and
// server.js can run outside actual Next.js (e.g. under plain Node/Express).
//
// This is the union of the former src/lib/next-compat.js and
// src/lib/next-polyfills.js, combined verbatim (no behavior changes).
//
// Supports:
//   - NextRequest: constructed from a raw Node IncomingMessage + parsed body
//     + url. `.method`, `.headers` (Proxy giving both `.get(name)` /
//     `.has(name)` fetch-style access AND raw `headers['x']` index access,
//     case-insensitive via lowercasing), `.url`, `.body`. `.json()` returns
//     the already-parsed body; `.text()` returns it as a string (or
//     JSON.stringify's it if not already a string).
//   - NextResponse: `.body`, `.status` (default 200), `.headers` (a Map).
//     `.json()` returns `.body`. Static `NextResponse.json(body, init)`
//     constructs one. Static `NextResponse.redirect(url, status = 307)`
//     constructs a redirect response with a `Location` header.
//   - readBody(req): buffers a raw Node request stream into a JSON-parsed
//     object (falls back to the raw string on parse failure), with a
//     10 MB body-size cap that destroys the request and rejects if
//     exceeded.
//   - normalizeHeaderName(key): maps a lowercased header name to its
//     canonical mixed-case form for a small fixed set of common headers
//     (content-type, content-length, set-cookie, cache-control, expires,
//     etag, last-modified, location, date, connection); passes through
//     unrecognized keys unchanged.
//   - registerGlobals(): assigns NextRequest/NextResponse onto globalThis.
//   - cookies() (async, server-side only -- throws if `window` is defined):
//     reads the request's `Cookie` header (via AsyncLocalStorage-scoped
//     request, falling back to the last value passed to
//     setCurrentRequest()) into a name->value map, and returns an object
//     with `.get(name)` (returns `{name, value}` or undefined), `.set(name,
//     value, options)` / `.delete(name)` (append a Set-Cookie header onto
//     the AsyncLocalStorage-scoped response via `res.setHeader`, supporting
//     `path`/`maxAge`/`expires`/`secure`/`httpOnly`/`sameSite` options), and
//     `.getAll()` / `.has(name)`.
//   - headers(): a STUB read-only headers accessor -- `.get()` always
//     returns null, `.has()` always returns false, `.getSetCookie()` /
//     `.entries()` always return an empty array. It does NOT read the
//     actual request headers (unlike `cookies()`, which does).
//   - setCurrentRequest(req) / setCurrentResponse(res): set a module-level
//     fallback request/response used by cookies() when no
//     AsyncLocalStorage context is active.
//   - runWithContext(req, res, fn): runs `fn` inside an AsyncLocalStorage
//     context carrying `{req, res}`, so cookies() can resolve the current
//     request/response without them being threaded through every call.
//   - revalidatePath() / revalidateTag(): both no-op stubs.
//   - redirect(path, status = 302): server-side throws an Error tagged
//     `error.type = 'redirect'` with `.location`/`.status` (for a caller to
//     catch and translate into an actual HTTP redirect); client-side
//     (`typeof window !== 'undefined'`) sets `window.location.href`
//     directly instead of throwing.
//   - notFound(): server-side throws a plain `Error('notFound()')`;
//     client-side sets `window.location.href = '/404'`.
//
// Does NOT support:
//   - Streaming request/response bodies (readBody fully buffers before
//     resolving; NextResponse.body is a plain in-memory value, not a
//     ReadableStream).
//   - `NextRequest.nextUrl` (parsed URL object with `.searchParams` etc.) --
//     only a raw `.url` string is exposed.
//   - `NextRequest.cookies` as a request-bound property -- cookie access is
//     only available via the separate top-level `cookies()` function.
//   - Any real Web Headers object -- `NextRequest.headers` is a Proxy over
//     a plain object, and `NextResponse.headers` is a bare Map, neither
//     implements the full Headers interface (no `.append()`, `.forEach()`,
//     `.delete()`, iteration protocol, etc).
//   - Edge runtime APIs (no `NextFetchEvent`, no `waitUntil`, no Edge
//     `fetch` overrides).
//   - Middleware matchers / `middleware.js` config conventions.
//   - `headers()` returning real request headers -- it is a hardcoded stub
//     that never reflects the actual incoming request.
//   - Response streaming helpers (`NextResponse.next()`, rewriting, etc.)
//     -- only `.json()` and `.redirect()` static constructors exist.
//   - Any multipart/form-data or non-JSON body parsing in readBody --
//     non-JSON bodies resolve as a raw string.

import { AsyncLocalStorage } from 'async_hooks';

const MAX_BODY_SIZE = 10 * 1024 * 1024;

// Wrap node's raw (plain-object, lowercased) headers so both the Fetch-style
// `headers.get('x')` API and direct `headers['x']` index access work. Node
// already lowercases header names; `.get()` lowercases its argument to match.
function wrapHeaders(raw) {
  const h = raw || {};
  return new Proxy(h, {
    get(target, prop) {
      if (prop === 'get') return (name) => target[String(name).toLowerCase()] ?? null;
      if (prop === 'has') return (name) => String(name).toLowerCase() in target;
      return target[prop];
    },
  });
}

export class NextRequest {
  constructor(req, body, url) {
    this.method = req.method;
    this.headers = wrapHeaders(req.headers);
    this.url = url;
    this.body = body;
  }

  async json() {
    return this.body;
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
}

export class NextResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  async json() {
    return this.body;
  }

  static json(body, init = {}) {
    return new NextResponse(body, init);
  }

  static redirect(url, status = 307) {
    return new NextResponse(null, {
      status,
      headers: { Location: url }
    });
  }
}

export async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(data);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

const HEADER_MAP = {
  'content-type': 'Content-Type',
  'content-length': 'Content-Length',
  'set-cookie': 'Set-Cookie',
  'cache-control': 'Cache-Control',
  'expires': 'Expires',
  'etag': 'ETag',
  'last-modified': 'Last-Modified',
  'location': 'Location',
  'date': 'Date',
  'connection': 'Connection',
};

export function normalizeHeaderName(key) {
  return HEADER_MAP[key.toLowerCase()] || key;
}

export function registerGlobals() {
  globalThis.NextRequest = NextRequest;
  globalThis.NextResponse = NextResponse;
}

const requestContext = new AsyncLocalStorage();

let fallbackRequest = null;
let fallbackResponse = null;

export function setCurrentRequest(req) {
  fallbackRequest = req;
}

export function setCurrentResponse(res) {
  fallbackResponse = res;
}

export function runWithContext(req, res, fn) {
  return requestContext.run({ req, res }, fn);
}

function getRequest() {
  const store = requestContext.getStore();
  return store?.req || fallbackRequest;
}

function getResponse() {
  const store = requestContext.getStore();
  return store?.res || fallbackResponse;
}

export async function cookies() {
  if (typeof window !== 'undefined') {
    throw new Error('cookies() should only be called on the server side');
  }

  const req = getRequest();
  const res = getResponse();
  const cookieHeader = req?.headers?.cookie || '';
  const cookieMap = {};

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(s => s.trim());
      if (name) cookieMap[name] = decodeURIComponent(value || '');
    });
  }

  return {
    get: (name) => {
      const value = cookieMap[name];
      return value ? { name, value } : undefined;
    },
    set: (name, value, options = {}) => {
      if (!res) return;
      let setCookieValue = `${name}=${encodeURIComponent(value)}`;
      if (options.path) setCookieValue += `; Path=${options.path}`;
      if (options.maxAge) setCookieValue += `; Max-Age=${options.maxAge}`;
      if (options.expires) setCookieValue += `; Expires=${options.expires}`;
      if (options.secure) setCookieValue += '; Secure';
      if (options.httpOnly) setCookieValue += '; HttpOnly';
      if (options.sameSite) setCookieValue += `; SameSite=${options.sameSite}`;
      const existing = res.getHeader('Set-Cookie') || [];
      const setCookies = Array.isArray(existing) ? existing : [existing];
      res.setHeader('Set-Cookie', [...setCookies, setCookieValue]);
    },
    delete: (name) => {
      if (!res) return;
      const setCookieValue = `${name}=; Path=/; Max-Age=0`;
      const existing = res.getHeader('Set-Cookie') || [];
      const setCookies = Array.isArray(existing) ? existing : [existing];
      res.setHeader('Set-Cookie', [...setCookies, setCookieValue]);
    },
    getAll: () => {
      return Object.entries(cookieMap).map(([name, value]) => ({ name, value }));
    },
    has: (name) => {
      return name in cookieMap;
    },
  };
}

export function headers() {
  return {
    get: (_name) => null,
    getSetCookie: () => [],
    has: (_name) => false,
    entries: () => [],
  };
}

export function revalidatePath() {}

export function revalidateTag() {}

export function redirect(path, status = 302) {
  if (typeof window !== 'undefined') {
    window.location.href = path;
  } else {
    const error = new Error(`Redirect to ${path}`);
    error.type = 'redirect';
    error.location = path;
    error.status = status;
    throw error;
  }
}

export function notFound() {
  if (typeof window !== 'undefined') {
    window.location.href = '/404';
  } else {
    throw new Error('notFound()');
  }
}
