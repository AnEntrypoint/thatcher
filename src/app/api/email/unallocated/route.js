import { NextResponse } from '@/lib/next-shim';
import { createLogger } from '@/lib/logger.js';
import { list } from '@/engine';

const log = createLogger('[EmailUnallocated]');

export async function GET(request) {
  try {
    const { requireUser, setCurrentRequest } = await import('@/engine.server');
    setCurrentRequest(request);
    await requireUser();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Unallocated emails, newest first, paginated (busybase + in-memory slice).
    const all = (await list('email', {}, { sort: { field: 'received_at', dir: 'DESC' } }))
      .filter(e => !e.allocated || e.allocated === 0);
    const total = { count: all.length };
    const emails = all.slice(offset, offset + limit);

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
    log.error('error:', { message: error.message });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
