import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

export function serveStatic(pathname, req, res, compress, getCacheHeaders, loadModule) {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  if (pathname === '/favicon.ico') {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', '0');
    res.writeHead(200);
    res.end();
    return true;
  }

  if (pathname === '/manifest.json') {
    const manifest = JSON.stringify({ name: 'MOONLANDING', short_name: 'Moonlanding', start_url: '/', display: 'standalone', background_color: '#f1f5f9', theme_color: '#04141f' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', Buffer.byteLength(manifest, 'utf-8'));
    res.writeHead(200);
    res.end(manifest);
    return true;
  }

  if (pathname === '/service-worker.js') {
    const swPath = path.join(ROOT, 'src/service-worker.js');
    if (fs.existsSync(swPath)) {
      const content = fs.readFileSync(swPath, 'utf-8');
      const cacheHeaders = getCacheHeaders('dynamic');
      Object.entries(cacheHeaders).forEach(([k, v]) => res.setHeader(k, v));
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(content, 'utf-8'));
      res.writeHead(200);
      res.end(content);
      return true;
    }
  }

  if (pathname.startsWith('/lib/webjsx/')) {
    const file = pathname.slice(12);
    const filePath = path.join(ROOT, 'node_modules/webjsx/dist', file);
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf-8');
    const cacheHeaders = getCacheHeaders('static', 31536000);
    Object.entries(cacheHeaders).forEach(([k, v]) => res.setHeader(k, v));
    const { content: finalContent, encoding } = compress(content, acceptEncoding);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', Buffer.byteLength(finalContent));
    res.writeHead(200);
    res.end(finalContent);
    return true;
  }

  if (pathname.startsWith('/ui/') && pathname.endsWith('.css')) {
    const cssPath = path.join(ROOT, 'src/ui', path.basename(pathname));
    if (!fs.existsSync(cssPath)) return false;
    let content = fs.readFileSync(cssPath, 'utf-8');
    const etag = `"${content.length}-${fs.statSync(cssPath).mtimeMs.toString(36)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return true; }
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('ETag', etag);
    const { content: finalContent, encoding } = compress(content, acceptEncoding);
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', Buffer.byteLength(finalContent));
    res.writeHead(200);
    res.end(finalContent);
    return true;
  }

  if (pathname === '/ui/client.js' || pathname === '/ui/event-delegation.js' || pathname === '/ui/common-handlers.js') {
    const jsPath = path.join(ROOT, 'src/ui', pathname.split('/').pop());
    if (!fs.existsSync(jsPath)) return false;
    const content = fs.readFileSync(jsPath, 'utf-8');
    const cacheHeaders = getCacheHeaders('static', 86400);
    Object.entries(cacheHeaders).forEach(([k, v]) => res.setHeader(k, v));
    const { content: finalContent, encoding } = compress(content, acceptEncoding);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', Buffer.byteLength(finalContent));
    res.writeHead(200);
    res.end(finalContent);
    return true;
  }

  return false;
}

export function html404() {
  return `<!DOCTYPE html><html lang="en" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 - Page Not Found | MOONLANDING</title><link href="/ui/rippleui.css" rel="stylesheet"><link href="/ui/styles2.css" rel="stylesheet"><style>body{margin:0;background:var(--color-bg,#f1f5f9);font-family:system-ui,sans-serif}.nav-shell{background:#04141f;padding:0 2rem;height:56px;display:flex;align-items:center}a.logo-link{color:#fff;text-decoration:none;font-weight:700;font-size:1.1rem}.error-shell{min-height:calc(100vh - 56px);display:flex;align-items:center;justify-content:center}.error-card{background:#fff;border-radius:12px;padding:3rem 4rem;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}.error-code{font-size:4rem;font-weight:900;color:#04141f;line-height:1}.error-msg{font-size:1.2rem;color:#64748b;margin:0.5rem 0 2rem}.home-btn{display:inline-block;padding:0.75rem 2rem;background:#04141f;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem}</style></head><body><nav class="nav-shell"><a href="/" class="logo-link">MOONLANDING</a></nav><div class="error-shell"><div class="error-card"><div class="error-code">404</div><p class="error-msg">Page not found</p><a href="/" class="home-btn">Go to Dashboard</a></div></div></body></html>`;
}
