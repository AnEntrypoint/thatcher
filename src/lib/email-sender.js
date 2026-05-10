import { now } from '@/lib/database-core';
import { sendEmail } from '@/adapters/google-gmail';
import { EMAIL_STATUS } from '@/config/constants';
import { config } from '@/config/env';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) =>
  !email ? { valid: false, error: 'Email address required' }
  : !EMAIL_REGEX.test(email) ? { valid: false, error: 'Invalid email format' }
  : { valid: true };

export function validateEmailData(emailRecord) {
  const errors = [];
  const rv = validateEmail(emailRecord.recipient_email);
  if (!rv.valid) errors.push(`Recipient: ${rv.error}`);
  const sv = validateEmail(emailRecord.sender_email);
  if (!sv.valid) errors.push(`Sender: ${sv.error}`);
  if (emailRecord.sender_email && config.email.from && emailRecord.sender_email !== config.email.from)
    errors.push(`Sender email (${emailRecord.sender_email}) does not match configured email (${config.email.from})`);
  if (!emailRecord.subject?.trim()) errors.push('Subject cannot be empty');
  if (!emailRecord.body && !emailRecord.html_body) errors.push('Email must have either body or html_body');
  return errors;
}

export function parseAttachments(attachmentsJson) {
  if (!attachmentsJson) return [];
  try {
    const a = typeof attachmentsJson === 'string' ? JSON.parse(attachmentsJson) : attachmentsJson;
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

export function logEmailActivity(db, emailId, action, metadata = {}) {
  try {
    db.prepare(`INSERT INTO activity_log (id, entity_type, entity_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`, 'email', emailId, action, JSON.stringify(metadata), now());
  } catch (e) { console.error('[EMAIL] Failed to log activity:', e.message); }
}

export function checkFailureRate(db) {
  try {
    const stats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed FROM email WHERE created_at >= ?`)
      .get(EMAIL_STATUS.FAILED, now() - 86400);
    if (stats.total > 0 && stats.failed / stats.total > 0.5 && stats.total > 10)
      console.warn('[EMAIL] HIGH FAILURE RATE ALERT:', { failureRate: `${((stats.failed / stats.total) * 100).toFixed(1)}%`, failed: stats.failed, total: stats.total });
  } catch (e) { console.error('[EMAIL] Failed to check failure rate:', e.message); }
}

async function exponentialBackoff(attempt, maxDelayMs) {
  await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), maxDelayMs)));
}

export async function sendSingleEmail(db, emailRecord, attempt = 1, maxRetries = 3, maxDelayMs = 30000) {
  const validationErrors = validateEmailData(emailRecord);
  if (validationErrors.length > 0) {
    const errorMsg = validationErrors.join('; ');
    db.prepare(`UPDATE email SET status=?, processing_error=?, retry_count=?, updated_at=? WHERE id=?`)
      .run(EMAIL_STATUS.FAILED, errorMsg, attempt, now(), emailRecord.id);
    logEmailActivity(db, emailRecord.id, 'email_send_failed', { error: errorMsg, attempt });
    return { success: false, error: errorMsg, emailId: emailRecord.id };
  }

  try {
    const emailData = {
      to: emailRecord.recipient_email,
      from: emailRecord.sender_email || config.email.from,
      subject: emailRecord.subject,
      body: emailRecord.body,
      html: emailRecord.html_body,
      cc: emailRecord.cc,
      bcc: emailRecord.bcc,
      attachments: parseAttachments(emailRecord.attachments),
      ...(emailRecord.in_reply_to && { inReplyTo: emailRecord.in_reply_to }),
      ...(emailRecord.references && { references: emailRecord.references }),
    };

    const result = await sendEmail(emailData);
    db.prepare(`UPDATE email SET status=?, processed=?, message_id=?, processing_error=NULL, retry_count=?, processed_at=?, updated_at=? WHERE id=?`)
      .run(EMAIL_STATUS.PROCESSED, true, result.id || result.messageId, attempt, now(), now(), emailRecord.id);
    logEmailActivity(db, emailRecord.id, 'email_sent', { messageId: result.id || result.messageId, to: emailData.to, attempt });
    return { success: true, messageId: result.id || result.messageId, emailId: emailRecord.id };
  } catch (error) {
    const isRateLimit = error.message?.includes('429') || /quota|rate limit/i.test(error.message);
    const isBounce = error.message?.includes('550') || error.message?.includes('551') || /no such user|user unknown|mailbox not found/i.test(error.message);
    const isPermanent = error.message?.includes('400') || /invalid|not found/i.test(error.message) || isBounce;

    if (isPermanent || attempt >= maxRetries) {
      const bounceStatus = isBounce ? 'bounced' : EMAIL_STATUS.FAILED;
      db.prepare(`UPDATE email SET status=?, processing_error=?, retry_count=?, bounce_reason=?, bounced_at=?, bounce_permanent=?, updated_at=? WHERE id=?`)
        .run(bounceStatus, error.message, attempt, isBounce ? error.message : null, isBounce ? now() : null, isBounce ? 1 : 0, now(), emailRecord.id);
      logEmailActivity(db, emailRecord.id, 'email_send_failed', { error: error.message, attempt, permanent: isPermanent });
      return { success: false, error: error.message, emailId: emailRecord.id, permanent: isPermanent };
    }

    if (isRateLimit) await exponentialBackoff(attempt, maxDelayMs);
    db.prepare(`UPDATE email SET retry_count=?, processing_error=?, updated_at=? WHERE id=?`).run(attempt, error.message, now(), emailRecord.id);
    return sendSingleEmail(db, emailRecord, attempt + 1, maxRetries, maxDelayMs);
  }
}
