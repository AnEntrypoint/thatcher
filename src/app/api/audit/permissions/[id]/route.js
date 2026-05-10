import { NextResponse, cookies } from '@/lib/next-polyfills';
import { lucia } from '@/engine.server';
import { getPermissionAuditById, getPermissionDiff } from '@/lib/audit-logger';

async function getUser() {
  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return null;
  const { user } = await lucia.validateSession(sessionId);
  return user;
}

export async function GET(request, context) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await context.params;
    const auditId = params.id;
    if (!auditId) return NextResponse.json({ error: 'Audit ID is required' }, { status: 400 });

    const audit = getPermissionAuditById(auditId);
    if (!audit) return NextResponse.json({ error: 'Audit record not found' }, { status: 404 });

    if (user.role === 'clerk' && audit.user_id !== user.id) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    if (user.role === 'client_admin' || user.role === 'client_user') return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const diff = audit.old_permissions && audit.new_permissions ? getPermissionDiff(audit.old_permissions, audit.new_permissions) : null;

    return NextResponse.json({
      success: true,
      data: { ...audit, timestamp_iso: new Date(audit.timestamp * 1000).toISOString(), diff },
    });
  } catch (error) {
    console.error('[AuditDetailAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit record', details: error.message }, { status: 500 });
  }
}
