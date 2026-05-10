import { AsyncLocalStorage } from 'async_hooks';

const requestContext = new AsyncLocalStorage();

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
    get: (name) => null,
    getSetCookie: () => [],
    has: (name) => false,
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
