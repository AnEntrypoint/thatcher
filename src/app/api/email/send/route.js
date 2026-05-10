import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase, now } from '@/lib/database-core';
import { getConfigEngine } from '@/lib/config-generator-engine';
import { EMAIL_STATUS } from '@/config/constants';
import { sendSingleEmail, checkFailureRate } from '@/lib/email-sender';

let emailConfig = null;

async function getEmailConfig() {
  if (!emailConfig) {
    const engine = await getConfigEngine();
    emailConfig = engine.getConfig()?.thresholds?.email || {};
  }
  return emailConfig;
}

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || token !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDatabase();
  try {
    const emailCfg = await getEmailConfig();
    const MAX_RETRIES = emailCfg.send_max_retries || 3;
    const BATCH_SIZE = emailCfg.send_batch_size || 10;
    const RATE_LIMIT_DELAY = emailCfg.rate_limit_delay_ms || 6000;
    const MAX_DELAY_MS = emailCfg.retry_max_delay_ms || 30000;

    const pendingEmails = db.prepare(`SELECT * FROM email WHERE status=? AND (retry_count IS NULL OR retry_count < ?) ORDER BY created_at ASC LIMIT ?`)
      .all(EMAIL_STATUS.PENDING, MAX_RETRIES, BATCH_SIZE);

    if (!pendingEmails.length)
      return NextResponse.json({ success: true, message: 'No pending emails', processed: 0 });

    const results = [];
    let successCount = 0, failureCount = 0;

    for (let i = 0; i < pendingEmails.length; i++) {
      const email = pendingEmails[i];
      db.prepare(`UPDATE email SET status=?, updated_at=? WHERE id=?`).run(EMAIL_STATUS.PROCESSING, now(), email.id);
      const result = await sendSingleEmail(db, email, email.retry_count || 1, MAX_RETRIES, MAX_DELAY_MS);
      results.push(result);
      result.success ? successCount++ : failureCount++;
      if (i < pendingEmails.length - 1)
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    }

    checkFailureRate(db);
    return NextResponse.json({ success: true, processed: pendingEmails.length, results: { success: successCount, failed: failureCount }, details: results });
  } catch (error) {
    console.error('[EMAIL] Queue processing error:', error);
    return NextResponse.json({ error: 'Email queue processing failed', details: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || token !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDatabase();
  try {
    const stats = db.prepare(`SELECT status, COUNT(*) as count FROM email GROUP BY status`).all();
    const failureStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status=? THEN 1 ELSE 0 END) as failed FROM email WHERE created_at >= ?`)
      .get(EMAIL_STATUS.FAILED, now() - 86400);
    const recentFailures = db.prepare(`SELECT id, recipient_email, subject, processing_error, retry_count, created_at FROM email WHERE status=? ORDER BY created_at DESC LIMIT 10`)
      .all(EMAIL_STATUS.FAILED);
    return NextResponse.json({
      stats: stats.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {}),
      failureRate: failureStats.total > 0 ? failureStats.failed / failureStats.total : 0,
      recentFailures,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get email stats', details: error.message }, { status: 500 });
  }
}
