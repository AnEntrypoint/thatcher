import { NextResponse } from '@/lib/next-polyfills';
import { requireAuth } from '@/lib/auth-middleware';
import { searchLogs, getLogStats, rotateLogsOlderThan } from '@/lib/audit-logger-enhanced';
import { withErrorHandler } from '@/lib/with-error-handler';

export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth();
  if (user.role !== 'admin' && user.role !== 'partner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = {
    level: url.searchParams.get('level'),
    operation: url.searchParams.get('operation'),
    entityType: url.searchParams.get('entityType'),
    entityId: url.searchParams.get('entityId'),
    userId: url.searchParams.get('userId'),
    action: url.searchParams.get('action'),
    searchText: url.searchParams.get('q'),
    fromDate: url.searchParams.get('from') ? parseInt(url.searchParams.get('from')) : Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60),
    toDate: url.searchParams.get('to') ? parseInt(url.searchParams.get('to')) : Math.floor(Date.now() / 1000),
  };

  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '100');

  const result = searchLogs(filters, page, pageSize);
  return NextResponse.json(result);
});

export const POST = withErrorHandler(async (request) => {
  const user = await requireAuth();
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  if (body.action === 'rotate') {
    const daysOld = body.daysOld || 90;
    const result = rotateLogsOlderThan(daysOld);
    return NextResponse.json({ success: true, archived: result.archived, archiveId: result.archiveId });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});
