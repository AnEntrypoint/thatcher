import { NextResponse } from '@/lib/next-polyfills';
import { now } from '@/lib/id-helpers';
import { list, update } from '@/engine';
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

  try {
    const emailCfg = await getEmailConfig();
    const MAX_RETRIES = emailCfg.send_max_retries || 3;
    const BATCH_SIZE = emailCfg.send_batch_size || 10;
    const RATE_LIMIT_DELAY = emailCfg.rate_limit_delay_ms || 6000;
    const MAX_DELAY_MS = emailCfg.retry_max_delay_ms || 30000;

    // pending emails under the retry cap, oldest first, limited to the batch size
    const pendingEmails = (await list('email', { status: EMAIL_STATUS.PENDING }, { sort: { field: 'created_at', dir: 'ASC' } }))
      .filter(e => (e.retry_count == null || e.retry_count < MAX_RETRIES))
      .slice(0, BATCH_SIZE);

    if (!pendingEmails.length)
      return NextResponse.json({ success: true, message: 'No pending emails', processed: 0 });

    const results = [];
    let successCount = 0, failureCount = 0;

    for (let i = 0; i < pendingEmails.length; i++) {
      const email = pendingEmails[i];
      await update('email', email.id, { status: EMAIL_STATUS.PROCESSING, updated_at: now() });
      const result = await sendSingleEmail(email, email.retry_count || 1, MAX_RETRIES, MAX_DELAY_MS);
      results.push(result);
      result.success ? successCount++ : failureCount++;
      if (i < pendingEmails.length - 1)
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    }

    await checkFailureRate();
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

  try {
    const emails = await list('email', {});
    // status counts (old GROUP BY status)
    const stats = {};
    for (const e of emails) stats[e.status] = (stats[e.status] || 0) + 1;
    // failure rate over the last 24h
    const cutoff = now() - 86400;
    const recent = emails.filter(e => (e.created_at || 0) >= cutoff);
    const failedTotal = recent.filter(e => e.status === EMAIL_STATUS.FAILED).length;
    const recentFailures = emails
      .filter(e => e.status === EMAIL_STATUS.FAILED)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, 10)
      .map(e => ({ id: e.id, recipient_email: e.recipient_email, subject: e.subject, processing_error: e.processing_error, retry_count: e.retry_count, created_at: e.created_at }));
    return NextResponse.json({
      stats,
      failureRate: recent.length > 0 ? failedTotal / recent.length : 0,
      recentFailures,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get email stats', details: error.message }, { status: 500 });
  }
}
