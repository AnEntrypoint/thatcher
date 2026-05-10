import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase, genId, now } from '@/lib/database-core';
import {
  allocateEmailToEntity,
  autoAllocateEmail,
  validateAllocation,
  findEntityByAlternateId,
} from '@/lib/email-parser';

export async function POST(request) {
  try {
    const { requireUser, setCurrentRequest } = await import('@/engine.server');
    setCurrentRequest(request);
    await requireUser();

    const body = await request.json();
    const { email_id, engagement_id, rfi_id, auto = false } = body;

    if (!email_id) {
      return NextResponse.json(
        { error: 'email_id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const email = db.prepare('SELECT * FROM email WHERE id = ?').get(email_id);

    if (!email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    if (email.allocated) {
      return NextResponse.json(
        { error: 'Email already allocated' },
        { status: 400 }
      );
    }

    let result;

    if (auto) {
      result = await autoAllocateEmail(email);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            reason: result.reason,
            confidence: result.confidence,
            message: `Auto-allocation failed: ${result.reason}`,
          },
          { status: 400 }
        );
      }
    } else {
      if (!engagement_id && !rfi_id) {
        return NextResponse.json(
          { error: 'Either engagement_id or rfi_id must be provided for manual allocation' },
          { status: 400 }
        );
      }

      let resolvedEngagementId = engagement_id;
      let resolvedRfiId = rfi_id;

      if (engagement_id) {
        resolvedEngagementId = findEntityByAlternateId('engagement', engagement_id);
        if (!resolvedEngagementId) {
          return NextResponse.json(
            { error: 'Engagement not found' },
            { status: 404 }
          );
        }
      }

      if (rfi_id) {
        resolvedRfiId = findEntityByAlternateId('rfi', rfi_id);
        if (!resolvedRfiId) {
          return NextResponse.json(
            { error: 'RFI not found' },
            { status: 404 }
          );
        }
      }

      const updatedEmail = allocateEmailToEntity(
        email_id,
        resolvedEngagementId,
        resolvedRfiId
      );

      result = {
        success: true,
        email: updatedEmail,
        engagement_id: resolvedEngagementId,
        rfi_id: resolvedRfiId,
      };
    }

    const logId = genId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO activity_log (
        id, entity_type, entity_id, action, message, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      'email',
      email_id,
      'allocated',
      `Email allocated to ${result.engagement_id ? 'engagement' : 'RFI'}`,
      JSON.stringify({
        engagement_id: result.engagement_id || null,
        rfi_id: result.rfi_id || null,
        method: auto ? 'automatic' : 'manual',
        confidence: result.confidence || 100,
      }),
      timestamp
    );

    return NextResponse.json({
      success: true,
      email: result.email,
      engagement_id: result.engagement_id || null,
      rfi_id: result.rfi_id || null,
      confidence: result.confidence || 100,
    });

  } catch (error) {
    console.error('[EMAIL_ALLOCATE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
