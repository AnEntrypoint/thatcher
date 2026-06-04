import { NextResponse } from '@/lib/next-polyfills';

// The data layer is busybase (LanceDB), not SQLite — the old pragma/page-count probe
// no longer applies. This endpoint now reports the configured store kind.
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  return NextResponse.json({
    store: 'busybase',
    dir: process.env.BUSYBASE_DIR || 'busybase_data',
    note: 'SQLite has been replaced by busybase (LanceDB); pragma stats are not applicable.',
  });
}

export const config = { runtime: 'nodejs' };
