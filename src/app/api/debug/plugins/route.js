import { NextResponse } from '@/lib/next-polyfills';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
  const engine = getConfigEngineSync();
  const plugins = engine._plugins ? Object.fromEntries(
    [...engine._plugins.entries()].map(([k, v]) => [k, {
      entityName: v.entityName,
      fields: Object.keys(v.fields || {}),
      hooks: Object.keys(v.hooks || {}),
      validators: Object.keys(v.validators || {}),
    }])
  ) : {};
  return NextResponse.json({ plugins, count: Object.keys(plugins).length });
}

export const config = { runtime: 'nodejs' };
