import { NextResponse } from '@/lib/next-polyfills';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
  const engine = getConfigEngineSync();
  const plugins = engine._plugins ? Object.fromEntries(
    [...engine._plugins.entries()].map(([k, v]) => [k, { fields: Object.keys(v.fields || {}), hooks: v.hooks?.length || 0, validators: v.validators?.length || 0 }])
  ) : {};
  return NextResponse.json({
    entities: engine.getAllEntities(),
    roles: Object.keys(engine.getRoles()),
    workflows: Object.keys(engine.getConfig().workflows || {}),
    domains: Object.keys(engine.getDomains()),
    plugins,
    specCacheSize: engine.specCache?.cache?.size ?? 0,
  });
}

export const config = { runtime: 'nodejs' };
