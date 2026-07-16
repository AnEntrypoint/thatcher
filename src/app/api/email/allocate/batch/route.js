import { NextResponse } from '@/lib/next-shim';
import { createLogger } from '@/lib/logger.js';

const log = createLogger('[EmailBatchAllocate]');
import { genId, now } from '@/lib/id-helpers';
import { list, create, update } from '@/engine';
import { autoAllocateEmail } from '@/lib/email-parser';

export async function POST(request) {
  try {
    const { requireUser, setCurrentRequest } = await import('@/engine.server');
    setCurrentRequest(request);
    const user = await requireUser();
    if (user.role !== 'admin' && user.role !== 'partner') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { min_confidence = 70, batch_size = 50 } = body;

    const unallocatedEmails = (await list('email', { status: 'pending' }, { sort: { field: 'received_at', dir: 'DESC' } }))
      .filter(e => !e.allocated || e.allocated === 0)
      .slice(0, batch_size);

    const results = {
      allocated: [],
      skipped: [],
      failed: [],
      total: unallocatedEmails.length,
    };

    for (const email of unallocatedEmails) {
      try {
        const result = await autoAllocateEmail(email);

        if (result.success && result.confidence >= min_confidence) {
          const logId = genId();
          const timestamp = now();

          await create('activity_log', {
            id: logId,
            entity_type: 'email',
            entity_id: email.id,
            action: 'batch_allocated',
            message: `Email batch-allocated to ${result.engagement_id ? 'engagement' : 'RFI'}`,
            details: JSON.stringify({
              engagement_id: result.engagement_id || null,
              rfi_id: result.rfi_id || null,
              confidence: result.confidence,
              method: 'batch_automatic',
            }),
            created_at: timestamp,
          });

          results.allocated.push({
            email_id: email.id,
            subject: email.subject,
            engagement_id: result.engagement_id || null,
            rfi_id: result.rfi_id || null,
            confidence: result.confidence,
          });
        } else if (result.success && result.confidence < min_confidence) {
          results.skipped.push({
            email_id: email.id,
            subject: email.subject,
            confidence: result.confidence,
            reason: `confidence ${result.confidence}% < ${min_confidence}%`,
          });
        } else {
          results.failed.push({
            email_id: email.id,
            subject: email.subject,
            reason: result.reason,
          });
        }
      } catch (error) {
        results.failed.push({
          email_id: email.id,
          subject: email.subject,
          reason: error.message,
        });

        await update('email', email.id, { processing_error: error.message, updated_at: now() });
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    log.error('error:', { message: error.message });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
