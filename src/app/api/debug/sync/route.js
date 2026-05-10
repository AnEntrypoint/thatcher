import fs from 'fs';
import path from 'path';
import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase } from '@/engine';

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
    const db = getDatabase();
    const tables = ['users', 'engagement', 'review', 'rfi_template', 'entity_type', 'engagement_type', 'client'];
    for (const t of tables) {
      try { table_counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get()?.c ?? null; } catch { table_counts[t] = null; }
    }
  } catch (e) { table_counts._error = String(e?.message || e); }
  return NextResponse.json({ last_run_at, table_counts });
}

export const config = { runtime: 'nodejs' };
