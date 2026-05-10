import { NextResponse } from '@/lib/next-polyfills';
import { getDatabase, genId, now } from '@/lib/database-core';
import path from 'path';
import fs from 'fs';

const TEMP_EMAIL_ATTACHMENTS_DIR = path.resolve(process.cwd(), 'data', 'temp_email_attachments');

if (!fs.existsSync(TEMP_EMAIL_ATTACHMENTS_DIR)) {
  fs.mkdirSync(TEMP_EMAIL_ATTACHMENTS_DIR, { recursive: true });
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || token !== process.env.EMAIL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      from,
      sender_email,
      subject,
      body: emailBody,
      html_body,
      text_body,
      attachments = [],
      message_id,
      in_reply_to,
      references,
      received_date,
    } = body;

    if (!sender_email || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: sender_email and subject are required' },
        { status: 400 }
      );
    }

    const attachmentData = [];

    for (const attachment of attachments) {
      const { filename, content, content_type, size } = attachment;

      if (filename && content) {
        const attachmentId = genId();
        const ext = path.extname(filename);
        const safeFilename = `${attachmentId}${ext}`;
        const filePath = path.join(TEMP_EMAIL_ATTACHMENTS_DIR, safeFilename);

        const buffer = Buffer.isBuffer(content)
          ? content
          : Buffer.from(content, 'base64');

        fs.writeFileSync(filePath, buffer);

        attachmentData.push({
          id: attachmentId,
          filename,
          path: filePath,
          content_type,
          size: size || buffer.length,
        });
      }
    }

    const emailRecord = {
      sender_email,
      sender_name: from || sender_email,
      subject,
      body: text_body || emailBody || '',
      html_body: html_body || '',
      message_id: message_id || genId(),
      in_reply_to: in_reply_to || null,
      references: references || null,
      received_at: received_date ? Math.floor(new Date(received_date).getTime() / 1000) : now(),
      allocated: false,
      engagement_id: null,
      rfi_id: null,
      attachments: JSON.stringify(attachmentData),
      status: 'pending',
      processed: false,
      processing_error: null,
    };

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO email (
        id, sender_email, sender_name, subject, body, html_body,
        message_id, in_reply_to, references, received_at, allocated,
        engagement_id, rfi_id, attachments, status, processed, processing_error,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    const emailId = genId();
    const timestamp = now();

    stmt.run(
      emailId,
      emailRecord.sender_email,
      emailRecord.sender_name,
      emailRecord.subject,
      emailRecord.body,
      emailRecord.html_body,
      emailRecord.message_id,
      emailRecord.in_reply_to,
      emailRecord.references,
      emailRecord.received_at,
      emailRecord.allocated ? 1 : 0,
      emailRecord.engagement_id,
      emailRecord.rfi_id,
      emailRecord.attachments,
      emailRecord.status,
      emailRecord.processed ? 1 : 0,
      emailRecord.processing_error,
      timestamp,
      timestamp
    );

    return NextResponse.json({
      success: true,
      email_id: emailId,
      attachments_count: attachmentData.length,
      message: 'Email received and stored successfully',
    });

  } catch (error) {
    console.error('[EMAIL_RECEIVE] Error processing webhook:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return NextResponse.json({
    endpoint: 'Email Receive Webhook',
    method: 'POST',
    description: 'Accepts incoming emails from Gmail webhook',
    required_fields: ['sender_email', 'subject'],
    optional_fields: ['from', 'body', 'html_body', 'text_body', 'attachments', 'message_id', 'in_reply_to', 'references', 'received_date'],
    attachment_format: 'Array of { filename, content (base64), content_type, size }',
  });
}
