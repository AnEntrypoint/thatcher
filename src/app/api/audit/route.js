import { requireAuth, requirePermission } from '@/lib/auth-middleware';
import { getAuditHistory, getActionStats, getUserStats } from '@/lib/audit-logger';
import { getSpec } from '@/config/spec-helpers';
import { paginated, ok } from '@/lib/response-formatter';
import { withErrorHandler } from '@/lib/with-error-handler';
import { AppError } from '@/lib/error-handler';
import { HTTP } from '@/config/constants';
import { parse as parseQuery } from '@/lib/query-string-adapter';

export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth();
  const url = new URL(request.url);

  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  const userId = url.searchParams.get('userId');
  const action = url.searchParams.get('action');
  const fromDate = url.searchParams.get('fromDate') ? parseInt(url.searchParams.get('fromDate')) : null;
  const toDate = url.searchParams.get('toDate') ? parseInt(url.searchParams.get('toDate')) : null;
  const page = url.searchParams.get('page') ? parseInt(url.searchParams.get('page')) : 1;
  const pageSize = url.searchParams.get('pageSize') ? parseInt(url.searchParams.get('pageSize')) : 50;
  const stats = url.searchParams.get('stats');

  if (page < 1) {
    throw new AppError('page must be >= 1', 'BAD_REQUEST', HTTP.BAD_REQUEST);
  }
  if (pageSize < 1 || pageSize > 200) {
    throw new AppError('pageSize must be between 1 and 200', 'BAD_REQUEST', HTTP.BAD_REQUEST);
  }

  if (stats === 'true') {
    if (!fromDate || !toDate) {
      throw new AppError('fromDate and toDate required for stats', 'BAD_REQUEST', HTTP.BAD_REQUEST);
    }
    const actionStats = getActionStats(fromDate, toDate);
    const userStats = getUserStats(fromDate, toDate);
    return ok({
      actionStats,
      userStats
    });
  }

  const filters = {};
  if (entityType) filters.entityType = entityType;
  if (entityId) filters.entityId = entityId;
  if (userId) filters.userId = userId;
  if (action) filters.action = action;
  if (fromDate) filters.fromDate = fromDate;
  if (toDate) filters.toDate = toDate;

  const { items, pagination } = getAuditHistory(filters, page, pageSize);

  const enriched = items.map(log => ({
    ...log,
    timestamp: log.createdAt,
    changes: log.beforeState && log.afterState ? findChanges(log.beforeState, log.afterState) : []
  }));

  return paginated(enriched, pagination);
}, 'GET /api/audit');

function findChanges(before, after) {
  const changes = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of allKeys) {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push({
        field: key,
        from: beforeVal,
        to: afterVal
      });
    }
  }

  return changes;
}
