import fs from 'fs';
import path from 'path';
import { NextResponse } from '@/lib/next-shim';
import { count } from '@/engine';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  const dataDir = path.resolve('data');
  let last_run_at = null;
  try {
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).map(f => path.join(dataDir, f)).filter(p => { try { return fs.statSync(p).isFile() } catch { return false } });
      if (files.length) last_run_at = new Date(Math.max(...files.map(p => fs.statSync(p).mtimeMs))).toISOString();
    }
  } catch {}
  let table_counts = {};
  try {
    // entity names (busybase tables); 'user' maps to the users table in the store
    const entities = ['user', 'engagement', 'review', 'rfi_template', 'entity_type', 'engagement_type', 'client'];
    for (const e of entities) {
      try { table_counts[e] = await count(e, {}); } catch { table_counts[e] = null; }
    }
  } catch (e) { table_counts._error = String(e?.message || e); }
  return NextResponse.json({ last_run_at, table_counts });
}

export const config = { runtime: 'nodejs' };
