import { NextResponse } from '@/lib/next-polyfills';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  const { hookEngine } = await import('@/lib/hook-engine.js');
  const stats = hookEngine.stats();
  const listeners = {};
  for (const name of Object.keys(stats)) {
    listeners[name] = hookEngine.listeners(name).map(h => ({ priority: h.priority, once: h.once, name: h.callback?.name || 'anonymous' }));
  }
  return NextResponse.json({ hooks: stats, listeners });
}

export const config = { runtime: 'nodejs' };
