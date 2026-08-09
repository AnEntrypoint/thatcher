import crypto from 'crypto';
import dns from 'dns/promises';
import { hookEngine } from './hook-engine.js';
import { list, create, get } from './busybase/store.js';
import { getConfigEngineSync } from './config-generator-engine.js';
import { createLogger } from './logger.js';

const log = createLogger('[WebhookEngine]');

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [500, 2000, 5000];
const REQUEST_TIMEOUT_MS = 10000;

function ipv4ToLong(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inRange(ip, base, bits) {
  const ipLong = ipv4ToLong(ip);
  const baseLong = ipv4ToLong(base);
  if (ipLong === null || baseLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (baseLong & mask);
}

const PRIVATE_RANGES = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['0.0.0.0', 8],
];

export function isPrivateOrLoopbackIp(ip) {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return PRIVATE_RANGES.some(([base, bits]) => inRange(ip, base, bits));
}

export async function validateWebhookUrl(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `Scheme "${parsed.protocol}" not allowed, only http/https` };
  }
  const hostname = parsed.hostname;
  if (hostname === 'localhost') {
    if (options.allowPrivateTargets) return { ok: true };
    return { ok: false, error: 'localhost targets are not allowed' };
  }
  const ipv4Literal = ipv4ToLong(hostname) !== null;
  if (ipv4Literal) {
    if (isPrivateOrLoopbackIp(hostname) && !options.allowPrivateTargets) {
      return { ok: false, error: `Private/loopback IP target "${hostname}" not allowed` };
    }
    return { ok: true };
  }
  if (options.allowPrivateTargets) return { ok: true };
  try {
    const resolved = await dns.lookup(hostname, { all: true });
    for (const { address, family } of resolved) {
      if (family === 4 && isPrivateOrLoopbackIp(address)) {
        return { ok: false, error: `Hostname "${hostname}" resolves to private/loopback address "${address}"` };
      }
      if (family === 6 && (address === '::1' || address.startsWith('fe80:') || address.startsWith('fc') || address.startsWith('fd'))) {
        return { ok: false, error: `Hostname "${hostname}" resolves to private/loopback address "${address}"` };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not resolve hostname "${hostname}": ${e.message}` };
  }
}

export function signPayload(secret, payloadString) {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

export function verifySignature(secret, payloadString, signature) {
  const expected = signPayload(secret, payloadString);
  const expectedBuf = Buffer.from(expected, 'hex');
  const givenBuf = Buffer.from(signature || '', 'hex');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

async function deliverOnce(webhook, payloadString) {
  const signature = signPayload(webhook.secret, payloadString);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Thatcher-Signature': signature },
      body: payloadString,
      signal: controller.signal,
    });
    return { success: res.ok, statusCode: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, statusCode: 0, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverWithRetry(webhook, payloadString) {
  let lastResult = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastResult = await deliverOnce(webhook, payloadString);
    try {
      await create('webhook_delivery', {
        webhook_id: webhook.id,
        event: webhook.trigger,
        status_code: lastResult.statusCode,
        success: lastResult.success,
        attempt,
        error: lastResult.error || '',
      }, null);
    } catch (e) {
      log.error('failed to write webhook_delivery log:', { message: e.message });
    }
    if (lastResult.success) return lastResult;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]));
    }
  }
  return lastResult;
}

function normalizeContext(context) {
  const data = context.data || context.record || {};
  return { ...context, data, entity: context.entity, id: context.id ?? data.id };
}

async function dispatchWebhooks(entityName, trigger, rawContext) {
  let webhooks;
  try {
    webhooks = await list('webhook', { entity: entityName, trigger, enabled: true });
  } catch (e) {
    log.error('failed to list webhooks:', { message: e.message });
    return;
  }
  if (!webhooks.length) return;

  const context = normalizeContext(rawContext);
  const payload = { event: trigger, entity: entityName, id: context.id, data: context.data, timestamp: Math.floor(Date.now() / 1000) };
  const payloadString = JSON.stringify(payload);

  for (const webhook of webhooks) {
    const validation = await validateWebhookUrl(webhook.url);
    if (!validation.ok) {
      log.error(`webhook ${webhook.id} URL rejected: ${validation.error}`);
      continue;
    }
    deliverWithRetry(webhook, payloadString).catch(e => log.error('webhook delivery failed:', { message: e.message }));
  }
}

let registered = false;

export function registerWebhookEngine() {
  if (registered) return;
  registered = true;

  const config = getConfigEngineSync().getConfig();
  const entityNames = Object.keys(config?.entities || {});

  for (const entityName of entityNames) {
    if (entityName === 'webhook' || entityName === 'webhook_delivery') continue;
    for (const trigger of ['create', 'update', 'delete']) {
      hookEngine.register(`${trigger}:${entityName}:after`, async (context) => {
        dispatchWebhooks(entityName, trigger, context).catch(e => log.error('webhook dispatch failed:', { message: e.message }));
        return context;
      });
    }
    hookEngine.register(`transition:${entityName}`, async (context) => {
      dispatchWebhooks(entityName, 'transition', context).catch(e => log.error('webhook dispatch failed:', { message: e.message }));
      return context;
    });
  }
}
