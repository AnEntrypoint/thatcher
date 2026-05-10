/**
 * Email Sender - SMTP email delivery with templates
 * Uses nodemailer
 */

import nodemailer from 'nodemailer';
import { buildConfig } from '../config/env.js';

let transporter = null;

/**
 * Initialize email transporter
 * @param {object} [config]
 */
export function initEmail(config = null) {
  const cfg = config || buildConfig();

  if (!cfg.email.smtp.user || !cfg.email.smtp.password) {
    console.warn('[Email] SMTP credentials not configured');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: cfg.email.smtp.host,
    port: cfg.email.smtp.port,
    secure: cfg.email.smtp.port === 465, // true for 465, false for other ports
    auth: {
      user: cfg.email.smtp.user,
      pass: cfg.email.smtp.password,
    },
  });

  return transporter;
}

/**
 * Get initialized transporter
 * @returns {object}
 */
export function getTransporter() {
  if (!transporter) initEmail();
  return transporter;
}

/**
 * Send email
 * @param {object} options - { to, subject, text, html, attachments }
 * @returns {Promise<object>}
 */
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

  console.log('[Email] Sent:', info.messageId);
  return info;
}

/**
 * Send templated email
 * @param {string} templateName
 * @param {string} to
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function sendTemplatedEmail(templateName, to, context = {}) {
  // Templates could be loaded from config or files
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

/**
 * Simple templates (could be loaded from config)
 * @returns {object}
 */
function getTemplates() {
  return {
    notification: {
      subject: 'Notification from {{appName}}',
      text: '{{message}}\n\n— {{appName}}',
    },
    invitation: {
      subject: 'You\'ve been invited to {{appName}}',
      text: '{{inviter}} has invited you to join {{appName}}.\n\nSign up: {{url}}',
    },
  };
}
