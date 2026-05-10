/**
 * Notification Engine - In-app notifications, email triggers
 */

import { getTransporter, sendEmail } from './email-sender.js';
import { getConfigEngineSync } from '../lib/config-generator-engine.js';
import { executeHook } from '../lib/hook-engine.js';

/**
 * Get notification template from config
 */
export function getNotificationTemplate(name) {
  const engine = getConfigEngineSync();
  return engine.generateNotificationHandler(name);
}

/**
 * Create notification record
 */
export async function createNotification(notification) {
  const { create } = await import('../lib/query-engine-write.js');
  return create('notification', {
    ...notification,
    created_at: Math.floor(Date.now() / 1000),
    read_at: null,
  }, { id: notification.created_by || 'system', role: 'system' });
}

/**
 * Send notification to user (in-app + optional email)
 */
export async function sendNotification(type, userId, context = {}, options = {}) {
  const template = getNotificationTemplate(type);
  if (!template) {
    console.warn(`[Notification] Template not found: ${type}`);
    return null;
  }

  const title = interpolate(template.title, context);
  const message = interpolate(template.message, context);

  // Create notification record
  const notification = await createNotification({
    type,
    user_id: userId,
    title,
    message,
    data: context,
    entity_type: options.entityType,
    entity_id: options.entityId,
    created_by: context.userId || 'system',
  });

  // Send email if enabled
  if (options.sendEmail !== false) {
    try {
      const { getUser } = await import('../engine.server.js');
      const user = await getUser(userId);
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `[${context.appName || 'App'}] ${title}`,
          text: `${message}\n\n---\nView in app: ${context.url || '/'}`,
        });
      }
    } catch (err) {
      console.error('[Notification] Email failed:', err.message);
    }
  }

  executeHook(`notification:${type}`, {
    notification,
    user: { id: userId },
    context,
  }).catch(console.error);

  return notification;
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId, userId) {
  const { update } = await import('../lib/query-engine-write.js');
  return update('notification', notificationId, {
    read_at: Math.floor(Date.now() / 1000),
  }, { id: userId, role: 'user' });
}

/**
 * Get unread count for user
 */
export async function getUnreadCount(userId) {
  const { list } = await import('../lib/query-engine.js');
  return list('notification', {
    user_id: userId,
    read_at: null,
  }).length;
}

/**
 * Interpolate {{key}} in template strings
 */
function interpolate(template, context) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}
