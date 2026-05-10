import { setCurrentRequest as setEngineRequest, invalidateSession } from '@/engine.server';
import { setCurrentRequest, setCurrentResponse } from '@/lib/next-polyfills';

function buildLogoutHeaders(headerMap) {
  const setCookies = headerMap.get('Set-Cookie');
  return setCookies
    ? (Array.isArray(setCookies) ? setCookies : [setCookies])
    : [];
}

export async function GET(request, { res } = {}) {
  try {
    setEngineRequest(request);
    setCurrentRequest(request);
    const headers = new Map();
    setCurrentResponse({
      getHeader: (name) => headers.get(name),
      setHeader: (name, value) => headers.set(name, value),
    });
    await invalidateSession();
    const response = new Response(null, { status: 307 });
    buildLogoutHeaders(headers).forEach(cookie => response.headers.append('Set-Cookie', cookie));
    response.headers.set('Location', `/login`);
    return response;
  } catch {
    return new Response(null, { status: 307, headers: { Location: '/login' } });
  }
}

export async function POST(request) {
  try {
    setEngineRequest(request);
    setCurrentRequest(request);
    const headers = new Map();
    setCurrentResponse({
      getHeader: (name) => headers.get(name),
      setHeader: (name, value) => headers.set(name, value),
    });
    await invalidateSession();
    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    buildLogoutHeaders(headers).forEach(cookie => response.headers.append('Set-Cookie', cookie));
    return response;
  } catch {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
