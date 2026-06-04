import { now, genId } from '@/lib/id-helpers';
import { list, update, create } from '@/lib/busybase-store';
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

export async function logEmailActivity(emailId, action, metadata = {}) {
  try {
    await create('activity_log', { id: genId(), entity_type: 'email', entity_id: emailId, action, metadata: JSON.stringify(metadata), created_at: now() });
  } catch (e) { console.error('[EMAIL] Failed to log activity:', e.message); }
}

export async function checkFailureRate() {
  try {
    const cutoff = now() - 86400;
    const recent = (await list('email', {})).filter(e => (e.created_at || 0) >= cutoff);
    const total = recent.length;
    const failed = recent.filter(e => e.status === EMAIL_STATUS.FAILED).length;
    if (total > 10 && failed / total > 0.5)
      console.warn('[EMAIL] HIGH FAILURE RATE ALERT:', { failureRate: `${((failed / total) * 100).toFixed(1)}%`, failed, total });
  } catch (e) { console.error('[EMAIL] Failed to check failure rate:', e.message); }
}

async function exponentialBackoff(attempt, maxDelayMs) {
  await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), maxDelayMs)));
}

export async function sendSingleEmail(emailRecord, attempt = 1, maxRetries = 3, maxDelayMs = 30000) {
  const validationErrors = validateEmailData(emailRecord);
  if (validationErrors.length > 0) {
    const errorMsg = validationErrors.join('; ');
    await update('email', emailRecord.id, { status: EMAIL_STATUS.FAILED, processing_error: errorMsg, retry_count: attempt, updated_at: now() });
    await logEmailActivity(emailRecord.id, 'email_send_failed', { error: errorMsg, attempt });
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
    await update('email', emailRecord.id, { status: EMAIL_STATUS.PROCESSED, processed: true, message_id: result.id || result.messageId, processing_error: '', retry_count: attempt, processed_at: now(), updated_at: now() });
    await logEmailActivity(emailRecord.id, 'email_sent', { messageId: result.id || result.messageId, to: emailData.to, attempt });
    return { success: true, messageId: result.id || result.messageId, emailId: emailRecord.id };
  } catch (error) {
    const isRateLimit = error.message?.includes('429') || /quota|rate limit/i.test(error.message);
    const isBounce = error.message?.includes('550') || error.message?.includes('551') || /no such user|user unknown|mailbox not found/i.test(error.message);
    const isPermanent = error.message?.includes('400') || /invalid|not found/i.test(error.message) || isBounce;

    if (isPermanent || attempt >= maxRetries) {
      const bounceStatus = isBounce ? 'bounced' : EMAIL_STATUS.FAILED;
      await update('email', emailRecord.id, { status: bounceStatus, processing_error: error.message, retry_count: attempt, bounce_reason: isBounce ? error.message : '', bounced_at: isBounce ? now() : 0, bounce_permanent: isBounce ? 1 : 0, updated_at: now() });
      await logEmailActivity(emailRecord.id, 'email_send_failed', { error: error.message, attempt, permanent: isPermanent });
      return { success: false, error: error.message, emailId: emailRecord.id, permanent: isPermanent };
    }

    if (isRateLimit) await exponentialBackoff(attempt, maxDelayMs);
    await update('email', emailRecord.id, { retry_count: attempt, processing_error: error.message, updated_at: now() });
    return sendSingleEmail(emailRecord, attempt + 1, maxRetries, maxDelayMs);
  }
}
