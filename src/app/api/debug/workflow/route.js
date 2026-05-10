import { NextResponse } from '@/lib/next-polyfills';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
  const engine = getConfigEngineSync();
  const wf = engine.getConfig().workflows || {};
  const summary = Object.fromEntries(
    Object.entries(wf).map(([k, v]) => [k, {
      state_field: v.state_field || 'status',
      stages: v.stages ? Object.keys(v.stages) : [],
      transitions: Array.isArray(v.transitions) ? v.transitions.length : null,
    }])
  );
  return NextResponse.json({ workflows: summary });
}

export const config = { runtime: 'nodejs' };
