import { sendEmail } from './email-sender.js';
import { getConfigEngineSync } from '../lib/config-generator-engine.js';
import { executeHook } from '../lib/hook-engine.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('[Notification]');

export function getNotificationTemplate(name) {
  const engine = getConfigEngineSync();
  return engine.generateNotificationHandler(name);
}

export async function createNotification(notification) {
  const { create } = await import('../lib/busybase/store.js');
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

export async function markNotificationRead(notificationId, _userId) {
  const { update } = await import('../lib/busybase/store.js');
  return update('notification', notificationId, {
    read_at: Math.floor(Date.now() / 1000),
  });
}

export async function getUnreadCount(userId) {
  const { list } = await import('../lib/busybase/store.js');
  return (await list('notification', {
    user_id: userId,
    read_at: null,
  })).length;
}

// Resolve a `recipients` token (a role/group name used across events-engine.js
// call sites, e.g. 'client_users', 'team_members', 'collaborator') to a list of
// user records to notify. There is no dedicated recipient-resolution engine in
// this codebase yet, so this composes the existing busybase/store queries the
// same way the rest of the app looks up users -- a single explicit user object
// on the context (context.recipientUser / a matching *_id field) is honored
// directly, and a bare role/group token that cannot be resolved to concrete
// users is logged and skipped rather than silently guessed at.
async function resolveRecipients(recipients, context) {
  const { list, get } = await import('../lib/busybase/store.js');

  if (context.recipientUser) return [context.recipientUser];
  if (context.collaborator?.email) return [context.collaborator];

  if (recipients === 'client_users' && context.engagement?.client_id) {
    return list('user', { client_id: context.engagement.client_id });
  }
  if ((recipients === 'team_members' || recipients === 'team_partners') && context.engagement?.team_id) {
    const team = await get('team', context.engagement.team_id);
    const { safeJsonParse } = await import('../lib/safe-json.js');
    const userIds = safeJsonParse(team?.users, []);
    const users = [];
    for (const id of userIds) {
      const u = await get('user', id);
      if (u) users.push(u);
    }
    return recipients === 'team_partners' ? users.filter(u => u.role === 'partner') : users;
  }
  if (recipients === 'client_admin' && context.engagement?.client_id) {
    return list('user', { client_id: context.engagement.client_id, role: 'admin' });
  }
  if (recipients === 'assigned_users' && (context.rfi?.assigned_to || context.rfi?.assigned_users)) {
    const ids = Array.isArray(context.rfi.assigned_users) ? context.rfi.assigned_users : [context.rfi.assigned_to].filter(Boolean);
    const users = [];
    for (const id of ids) {
      const u = await get('user', id);
      if (u) users.push(u);
    }
    return users;
  }

  log.warn(`queueEmail: unresolved recipients token "${recipients}"`);
  return [];
}

function templateNameForType(_type) {
  // events-engine.js passes descriptive template names (e.g.
  // 'engagement_info_gathering'); the built-in getTemplates() set in
  // email-sender.js is generic ('notification', 'invitation'), so an
  // unrecognized specific name falls back to the generic notification shape.
  return 'notification';
}

/**
 * Send a templated notification email to a resolved set of recipients.
 * Composes the existing sendTemplatedEmail (src/services/email-sender.js)
 * rather than reimplementing delivery -- this is the queueEmail primitive
 * events-engine.js drives its afterCreate/afterUpdate hooks through.
 */
export async function queueEmail(templateName, context = {}) {
  const { recipients, ...rest } = context;
  try {
    const users = await resolveRecipients(recipients, rest);
    if (!users.length) return { sent: 0, templateName };

    const { sendTemplatedEmail } = await import('./email-sender.js');
    let sent = 0;
    for (const user of users) {
      if (!user?.email) continue;
      try {
        await sendTemplatedEmail(templateNameForType(templateName), user.email, { ...rest, templateName });
        sent++;
      } catch (err) {
        log.error('queueEmail send failed:', { message: err.message, templateName, to: user.email });
      }
    }
    return { sent, templateName };
  } catch (err) {
    log.error('queueEmail failed:', { message: err.message, templateName });
    return { sent: 0, templateName, error: err.message };
  }
}

function interpolate(template, context) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}
