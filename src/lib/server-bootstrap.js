import fs from 'fs';
import path from 'path';
import { createLogger } from './logger.js';

const log = createLogger('[Server]');

export function loadEnv(filePath) {
  try {
    const envFile = fs.readFileSync(filePath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
      if (key) process.env[key] = value;
    });
  } catch (e) {
    log.warn('.env file not loaded:', { message: e.message });
  }
}

export function setupProcessGuards() {
  process.on('uncaughtException', (err) => {
    log.error('uncaught exception (process kept alive):', { message: err?.message || String(err), stack: err?.stack });
  });
  process.on('unhandledRejection', (reason) => {
    log.error('unhandled rejection (process kept alive):', { message: reason?.message || String(reason), stack: reason?.stack });
  });
}

export function setupHotReload(__dirname, moduleCache, onConfigReset) {
  const watchedDirs = ['src/config', 'src/app/api', 'src/ui', 'src/plugins'].map(d => path.join(__dirname, d));
  watchedDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    try {
      const watcher = fs.watch(dir, { recursive: true }, async (eventType, filename) => {
        if (filename && (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.yml'))) {
          moduleCache.clear();
          globalThis.__reloadTs__ = Date.now();
          log.info(`hot invalidated: ${filename}`);
          if (filename.endsWith('master-config.yml') || filename.includes('master-config')) {
            try {
              const { resetConfigEngine } = await import('./config-generator-engine.js');
              resetConfigEngine();
              onConfigReset?.();
            } catch (e) { log.warn('could not reset config engine:', { message: e.message }); }
          }
        }
      });
      watcher.on('error', (err) => log.error(`hot watcher error on ${dir}:`, { message: err.message }));
    } catch (err) { log.error(`hot failed to watch ${dir}:`, { message: err.message }); }
  });
}

export async function loadModule(moduleCache, filePath) {
  const cached = moduleCache.get(filePath);
  if (cached) return cached;
  const module = await import(`file://${filePath}?t=${Date.now()}`);
  moduleCache.set(filePath, module);
  return module;
}

export function setSecurityHeaders(res, nodeEnv) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' wss: ws:; frame-ancestors 'none'");
  if (nodeEnv === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
