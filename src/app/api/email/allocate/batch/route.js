import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase, genId, now } from '@/lib/database-core';
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

    const db = getDatabase();

    const unallocatedEmails = db.prepare(`
      SELECT * FROM email
      WHERE allocated = 0 AND status = 'pending'
      ORDER BY received_at DESC
      LIMIT ?
    `).all(batch_size);

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

          db.prepare(`
            INSERT INTO activity_log (
              id, entity_type, entity_id, action, message, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            logId,
            'email',
            email.id,
            'batch_allocated',
            `Email batch-allocated to ${result.engagement_id ? 'engagement' : 'RFI'}`,
            JSON.stringify({
              engagement_id: result.engagement_id || null,
              rfi_id: result.rfi_id || null,
              confidence: result.confidence,
              method: 'batch_automatic',
            }),
            timestamp
          );

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

        db.prepare(`
          UPDATE email
          SET processing_error = ?,
              updated_at = ?
          WHERE id = ?
        `).run(error.message, now(), email.id);
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('[EMAIL_BATCH_ALLOCATE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
