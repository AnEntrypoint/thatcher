import { getTransporter, sendEmail } from './email-sender.js';
import { getConfigEngineSync } from '../lib/config-generator-engine.js';
import { executeHook } from '../lib/hook-engine.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('[Notification]');

export function getNotificationTemplate(name) {
  const engine = getConfigEngineSync();
  return engine.generateNotificationHandler(name);
}

export async function createNotification(notification) {
  const { create } = await import('../lib/busybase-store.js');
  return create('notification', {
    ...notification,
    created_at: Math.floor(Date.now() / 1000),
    read_at: null,
  }, { id: notification.created_by || 'system', role: 'system' });
}

export async function sendNotification(type, userId, context = {}, options = {}) {
  const template = getNotificationTemplate(type);
  if (!template) {
    log.warn(`template not found: ${type}`);
    return null;
  }

  const title = interpolate(template.title, context);
  const message = interpolate(template.message, context);

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
      log.error('email failed:', { message: err.message });
    }
  }

  executeHook(`notification:${type}`, {
    notification,
    user: { id: userId },
    context,
  }).catch(err => log.error('hook error:', { message: err?.message || String(err) }));

  return notification;
}

export async function markNotificationRead(notificationId, userId) {
  const { update } = await import('../lib/busybase-store.js');
  return update('notification', notificationId, {
    read_at: Math.floor(Date.now() / 1000),
  });
}

export async function getUnreadCount(userId) {
  const { list } = await import('../lib/busybase-store.js');
  return (await list('notification', {
    user_id: userId,
    read_at: null,
  })).length;
}

function interpolate(template, context) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}
