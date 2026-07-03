import { createLogger } from '@/lib/logger.js';
import { timingSafeEqual } from 'node:crypto';

const log = createLogger('[Cron]');

export const runtime = 'nodejs';

function isValidCronSecret(token) {
  const secret = process.env.CRON_SECRET;
  const tokenBuf = Buffer.from(token || '', 'utf8');
  const secretBuf = Buffer.from(secret || '', 'utf8');
  return !!secret && !!token && tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf);
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!isValidCronSecret(token)) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // job-engine was removed (the module never existed in this repo); this
    // endpoint is not wired to a real job runner, so return a clean 501
    // instead of crashing on a dead import.
    return new Response(
      JSON.stringify({ status: 'error', message: 'cron trigger not implemented' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error('cron trigger error:', { message: error.message });
    return new Response(
      JSON.stringify({ status: 'error', message: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: 'ok', message: 'Cron trigger endpoint active. POST with Bearer token to execute.', timestamp: new Date().toISOString() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
