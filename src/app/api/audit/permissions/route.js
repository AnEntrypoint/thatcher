import { NextResponse } from '@/lib/next-shim';
import { createLogger } from '@/lib/logger.js';

const log = createLogger('[AuditAPI]');
import { lucia } from '@/engine.server';
import { cookies } from '@/lib/next-shim';
import {
  logPermissionChange, getPermissionAuditTrail, searchPermissionAudit,
  getPermissionAuditByDateRange, exportPermissionAuditCSV,
} from '@/lib/busybase/audit-reads';

async function getUser() {
  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return null;
  const { user } = await lucia.validateSession(sessionId);
  return user;
}

function checkAuditPermission(user) {
  if (!user) return { allowed: false, error: 'Unauthorized' };
  if (user.role === 'partner' || user.role === 'manager') return { allowed: true, scope: 'all' };
  if (user.role === 'clerk') return { allowed: true, scope: 'own' };
  return { allowed: false, error: 'Permission denied' };
}

export async function GET(request) {
  try {
    const user = await getUser();
    const permCheck = checkAuditPermission(user);
    if (!permCheck.allowed) return NextResponse.json({ error: permCheck.error }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const format = searchParams.get('format');

    let results;
    if (search) {
      results = await searchPermissionAudit(search, limit);
    } else if (startDate && endDate) {
      results = await getPermissionAuditByDateRange(parseInt(startDate, 10), parseInt(endDate, 10), limit);
    } else {
      const filters = {};
      const entityType = searchParams.get('entity_type');
      const entityId = searchParams.get('entity_id');
      const userId = searchParams.get('user_id');
      const affectedUserId = searchParams.get('affected_user_id');
      if (entityType) filters.entityType = entityType;
      if (entityId) filters.entityId = entityId;
      if (permCheck.scope === 'own') filters.userId = user.id;
      else if (userId) filters.userId = userId;
      if (affectedUserId) filters.affectedUserId = affectedUserId;
      filters.limit = limit;
      filters.offset = offset;
      results = await getPermissionAuditTrail(filters);
    }

    if (format === 'csv') {
      const csv = await exportPermissionAuditCSV({});
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="permission_audit.csv"' } });
    }

    return NextResponse.json({ success: true, data: results, count: results.length, scope: permCheck.scope });
  } catch (error) {
    log.error('GET error:', { message: error.message });
    return NextResponse.json({ error: 'Failed to retrieve audit trail', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { entityType, entityId, action, oldPermissions, newPermissions, reason, reasonCode, affectedUserId, metadata } = body;
    if (!entityType || !entityId || !action) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;

    const auditId = await logPermissionChange({
      userId: user.id, entityType, entityId, action, oldPermissions, newPermissions,
      reason, reasonCode: reasonCode || 'other', affectedUserId, ipAddress, sessionId, metadata,
    });

    return NextResponse.json({ success: true, auditId });
  } catch (error) {
    log.error('POST error:', { message: error.message });
    return NextResponse.json({ error: 'Failed to log permission change', details: error.message }, { status: 500 });
  }
}
