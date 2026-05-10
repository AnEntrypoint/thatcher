const MAX_BODY_SIZE = 10 * 1024 * 1024;

export class NextRequest {
  constructor(req, body, url) {
    this.method = req.method;
    this.headers = req.headers;
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
