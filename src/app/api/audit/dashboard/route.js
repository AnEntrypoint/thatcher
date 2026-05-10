import { NextResponse } from '@/lib/next-polyfills';
import { getUser, setCurrentRequest } from '@/engine.server';
import {
  getPermissionAuditTrail, getPermissionAuditStats, getPermissionAuditBreakdown,
  getPermissionAuditByDateRange, searchPermissionAudit, getPermissionDiff,
} from '@/lib/audit-logger';

export async function GET(request) {
  setCurrentRequest(request);
  try {
    const user = await getUser();
    if (!user || (user.role !== 'partner' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';
    const days = parseInt(searchParams.get('days') || '30', 10);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const userId = searchParams.get('user_id');
    const searchTerm = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const nowTs = Math.floor(Date.now() / 1000);
    const startTs = nowTs - (days * 86400);

    let data;
    switch (view) {
      case 'summary': {
        const stats = getPermissionAuditStats();
        const actionBreakdown = getPermissionAuditBreakdown('action');
        const reasonBreakdown = getPermissionAuditBreakdown('reason_code');
        const changes = getPermissionAuditByDateRange(startTs, nowTs, limit);
        data = {
          period_days: days,
          total_changes: changes.length,
          stats: { ...stats, unique_users: stats.unique_users, entity_types: stats.entity_types },
          by_action: actionBreakdown.reduce((a, i) => { a[i.action] = i.count; return a; }, {}),
          by_reason: reasonBreakdown.reduce((a, i) => { a[i.reason_code] = i.count; return a; }, {}),
        };
        break;
      }
      case 'recent':
        data = { period: `Last ${days} days`, changes: getPermissionAuditByDateRange(startTs, nowTs, limit) };
        break;
      case 'user':
        if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
        data = { user_id: userId, changes: getPermissionAuditTrail({ userId, limit }) };
        break;
      case 'entity':
        if (!entityType || !entityId) return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
        data = {
          entity_type: entityType, entity_id: entityId,
          timeline: getPermissionAuditTrail({ entityType, entityId, limit }).map(c => ({
            ...c, timestamp_iso: new Date(c.timestamp * 1000).toISOString(),
            diff: c.old_permissions && c.new_permissions ? getPermissionDiff(c.old_permissions, c.new_permissions) : null,
          })),
        };
        break;
      case 'search':
        if (!searchTerm) return NextResponse.json({ error: 'search parameter required' }, { status: 400 });
        data = { search_term: searchTerm, results: searchPermissionAudit(searchTerm, limit) };
        break;
      case 'roles':
        data = { changes: getPermissionAuditTrail({ limit }).filter(c => c.action === 'role_change') };
        break;
      default:
        return NextResponse.json({ error: `Unknown view: ${view}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, view, data });
  } catch (error) {
    console.error('[AuditDashboardAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit dashboard data', details: error.message }, { status: 500 });
  }
}
