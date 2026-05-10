import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase } from '@/lib/database-core';

export async function GET(request) {
  try {
    const { requireUser, setCurrentRequest } = await import('@/engine.server');
    setCurrentRequest(request);
    await requireUser();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const db = getDatabase();

    const emails = db.prepare(`
      SELECT *
      FROM email
      WHERE allocated = 0
      ORDER BY received_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM email WHERE allocated = 0').get();

    const emailsWithParsedAttachments = emails.map(email => ({
      ...email,
      attachments: email.attachments ? JSON.parse(email.attachments) : [],
      allocated: Boolean(email.allocated),
      processed: Boolean(email.processed),
    }));

    return NextResponse.json({
      emails: emailsWithParsedAttachments,
      total: total.count,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[EMAIL_UNALLOCATED] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
