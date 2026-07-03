import { google } from 'googleapis';
import { createLogger } from '../lib/logger.js';
import { getJWTClient, getOAuth2Client } from './google-auth.js';
import { buildConfig } from '../config/env.js';

const log = createLogger('[GoogleGmail]');

export function getGmailClient(user = null) {
  let client;

  if (user?.oauth_token) {
    // User-delegated access
    client = getOAuth2Client();
    client.setCredentials({ access_token: user.oauth_token });
  } else {
    // Service account (app-wide)
    client = getJWTClient();
  }

  if (!client) throw new Error('Google Gmail not configured');

  return google.gmail({ version: 'v1', auth: client });
}

function encodeHeader(value) {
  // RFC 2047 encoded-word for any non-ASCII header value (subject/name).
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function buildRawMessage({ to, from, subject, body, html, cc, bcc, attachments = [], inReplyTo, references }) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodeHeader(subject || '')}`,
  ];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);
  headers.push('MIME-Version: 1.0');

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  let message;
  if (!hasAttachments) {
    if (html) {
      headers.push('Content-Type: text/html; charset="UTF-8"');
      message = `${headers.join('\r\n')}\r\n\r\n${html}`;
    } else {
      headers.push('Content-Type: text/plain; charset="UTF-8"');
      message = `${headers.join('\r\n')}\r\n\r\n${body || ''}`;
    }
  } else {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const parts = [];

    parts.push(
      `--${boundary}`,
      html ? 'Content-Type: text/html; charset="UTF-8"' : 'Content-Type: text/plain; charset="UTF-8"',
      '',
      html || body || '',
      ''
    );

    for (const att of attachments) {
      const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || '', att.encoding || 'base64');
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType || att.mimeType || 'application/octet-stream'}; name="${att.filename || att.name || 'attachment'}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename || att.name || 'attachment'}"`,
        '',
        content.toString('base64'),
        ''
      );
    }

    parts.push(`--${boundary}--`);
    message = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
  }

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(options, user = null) {
  const gmail = getGmailClient(user);
  const from = options.from || buildConfig().email.from;

  const raw = buildRawMessage({ ...options, from });

  const requestBody = { raw };
  if (options.inReplyTo || options.references) {
    // threadId is optional; Gmail threads by References/In-Reply-To headers
    // already embedded in the raw message.
  }

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });
    log.info('sent:', { messageId: res.data.id });
    return { id: res.data.id, messageId: res.data.id, threadId: res.data.threadId };
  } catch (err) {
    log.error('send failed:', { message: err.message });
    throw err;
  }
}
