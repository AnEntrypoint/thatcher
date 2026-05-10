import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase } from '@/engine';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const db = getDatabase();
    const page_count = db.pragma('page_count', { simple: true });
    const page_size = db.pragma('page_size', { simple: true });
    const journal_mode = db.pragma('journal_mode', { simple: true });
    const wal_autocheckpoint = db.pragma('wal_autocheckpoint', { simple: true });
    const path = db.name;
    return NextResponse.json({ path, page_count, page_size, bytes: page_count * page_size, journal_mode, wal_autocheckpoint });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export const config = { runtime: 'nodejs' };
