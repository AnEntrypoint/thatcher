import nodemailer from 'nodemailer';
import { buildConfig } from '../config/env.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('[Email]');

let transporter = null;

export function initEmail(config = null) {
  const cfg = config || buildConfig();

  if (!cfg.email.smtp.user || !cfg.email.smtp.password) {
    log.warn('SMTP credentials not configured');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: cfg.email.smtp.host,
    port: cfg.email.smtp.port,
    secure: cfg.email.smtp.port === 465,
    auth: {
      user: cfg.email.smtp.user,
      pass: cfg.email.smtp.password,
    },
  });

  return transporter;
}

export function getTransporter() {
  if (!transporter) initEmail();
  return transporter;
}

export async function sendEmail(options) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email not configured');
  }

  const from = buildConfig().email.from;

  const info = await transporter.sendMail({
    from,
    ...options,
  });

  log.info('sent:', { messageId: info.messageId });
  return info;
}

export async function sendTemplatedEmail(templateName, to, context = {}) {
  const templates = getTemplates();
  const template = templates[templateName];

  if (!template) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  const text = template.text?.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  const html = template.html?.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');

  return sendEmail({ to, subject, text, html });
}

function getTemplates() {
  return {
    notification: {
      subject: 'Notification from {{appName}}',
      text: '{{message}}\n\n- {{appName}}',
    },
    invitation: {
      subject: 'You\'ve been invited to {{appName}}',
      text: '{{inviter}} has invited you to join {{appName}}.\n\nSign up: {{url}}',
    },
  };
}
