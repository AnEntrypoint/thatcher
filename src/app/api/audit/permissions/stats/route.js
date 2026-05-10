import { NextResponse } from '@/lib/next-polyfills';
import { getUser, setCurrentRequest } from '@/engine.server';
import { getPermissionAuditStats, getPermissionAuditBreakdown } from '@/lib/audit-logger';

export async function GET(request) {
  setCurrentRequest(request);
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'partner' && user.role !== 'manager') return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const stats = getPermissionAuditStats();
    const actionBreakdown = getPermissionAuditBreakdown('action');
    const reasonCodeBreakdown = getPermissionAuditBreakdown('reason_code');

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        earliest_change: stats.earliest_change ? new Date(stats.earliest_change * 1000).toISOString() : null,
        latest_change: stats.latest_change ? new Date(stats.latest_change * 1000).toISOString() : null,
      },
      breakdown: { by_action: actionBreakdown, by_reason_code: reasonCodeBreakdown },
    });
  } catch (error) {
    console.error('[AuditStatsAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit statistics', details: error.message }, { status: 500 });
  }
}
