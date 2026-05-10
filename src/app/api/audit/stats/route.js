import { NextResponse } from '@/lib/next-polyfills';
import { requireAuth } from '@/lib/auth-middleware';
import { getLogStats } from '@/lib/audit-logger-enhanced';
import { withErrorHandler } from '@/lib/with-error-handler';

export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth();
  if (user.role !== 'admin' && user.role !== 'partner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const fromDate = url.searchParams.get('from') ? parseInt(url.searchParams.get('from')) : Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  const toDate = url.searchParams.get('to') ? parseInt(url.searchParams.get('to')) : Math.floor(Date.now() / 1000);

  const stats = getLogStats(fromDate, toDate);
  return NextResponse.json({ success: true, stats, period: { from: fromDate, to: toDate } });
});
