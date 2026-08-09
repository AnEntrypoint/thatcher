import { get, update, remove } from './busybase/store.js';
import { validateUpdate, sanitizeData } from './validation/index.js';
import { requirePermission } from './auth-middleware.js';
import { permissionService } from '../services/permission.service.js';
import { executeHook } from './hook-engine.js';
import { logAction } from './busybase/audit.js';
import { now } from './id-helpers.js';
import { createLogger } from './logger.js';

const log = createLogger('[BulkOps]');
const MAX_BULK_IDS = 500;

async function bulkDeleteOne(entityName, spec, id, user) {
  await requirePermission(user, spec, 'delete');
  const existing = await get(entityName, id, { user });
  if (!existing) throw new Error('Not found');
  if (!permissionService.checkRowAccess(user, spec, existing)) throw new Error('Access denied');

  let result;
  if (spec.immutable === true && spec.immutable_strategy === 'move_to_archive') {
    const archiveData = { archived: true, archived_at: now(), archived_by: user?.id };
    result = await update(entityName, id, archiveData, user);
    logAction(entityName, id, 'archive', user?.id, existing, archiveData);
  } else if (spec.fields?.status) {
    result = await update(entityName, id, { status: 'deleted' }, user);
    logAction(entityName, id, 'delete', user?.id, existing, { status: 'deleted' });
  } else {
    result = await remove(entityName, id);
    logAction(entityName, id, 'delete', user?.id, existing, null);
  }
  executeHook(`delete:${entityName}:after`, { entity: entityName, id, data: result, user }).catch(e => log.error(e.message));
  return result;
}

async function bulkSetFieldOne(entityName, spec, id, user, field, value) {
  await requirePermission(user, spec, 'edit');
  const existing = await get(entityName, id, { user });
  if (!existing) throw new Error('Not found');
  if (!permissionService.checkRowAccess(user, spec, existing)) throw new Error('Access denied');

  const rawData = { [field]: value };
  permissionService.enforceEditPermissions(user, spec, rawData);

  const errors = await validateUpdate(entityName, rawData, existing);
  if (Object.keys(errors).length > 0) throw new Error(`Validation failed: ${JSON.stringify(errors)}`);

  const sanitized = sanitizeData(entityName, rawData, spec, existing);
  const record = await update(entityName, id, sanitized, user);
  logAction(entityName, id, 'update', user?.id, existing, record);
  executeHook(`update:${entityName}:after`, { entity: entityName, id, data: record, before: existing, after: record, user }).catch(e => log.error(e.message));
  return record;
}

async function bulkTransitionOne(entityName, id, workflowName, toState, user) {
  const { transition } = await import('./workflow-engine.js');
  return transition(entityName, id, workflowName, toState, user, 'bulk operation');
}

async function bulkNotifyOne(entityName, spec, id, user, message) {
  // Same permission/row-access gate every other bulk action already applies
  // -- 'notify' reads the record to build the notification, so it must not
  // bypass the checks a plain view of that record would require.
  await requirePermission(user, spec, 'view');
  const existing = await get(entityName, id, { user });
  if (!existing) throw new Error('Not found');
  if (!permissionService.checkRowAccess(user, spec, existing)) throw new Error('Access denied');

  const recipientId = existing.owner_id;
  if (!recipientId) throw new Error('Record has no owner_id to notify');

  const { createNotification } = await import('../services/notification-engine.js');
  // createNotification stores user_id as the sole addressee -- the existing
  // /notifications route already filters list('notification',{user_id:...})
  // scoped by {user}, so a notification is only ever visible to the user it
  // names, the same row-access guarantee every other entity gets.
  return createNotification({
    user_id: recipientId,
    title: message || `${spec.label || entityName} update`,
    message: message || `${spec.label || entityName} "${existing.name || id}" requires attention`,
    entity_type: entityName,
    entity_id: id,
    created_by: user?.id || 'system',
  });
}

export async function runBulkOperation(entityName, spec, ids, action, user) {
  if (!Array.isArray(ids) || !ids.length) return { ok: false, error: 'ids array required and must be non-empty' };
  if (ids.length > MAX_BULK_IDS) return { ok: false, error: `Cannot process more than ${MAX_BULK_IDS} ids in one bulk operation` };
  if (!action || typeof action.type !== 'string') return { ok: false, error: 'action.type required' };

  const uniqueIds = [...new Set(ids)];
  const results = [];

  for (const id of uniqueIds) {
    try {
      if (action.type === 'delete') {
        await bulkDeleteOne(entityName, spec, id, user);
        results.push({ id, success: true });
      } else if (action.type === 'set_field') {
        if (!action.field || typeof action.field !== 'string') throw new Error('action.field required');
        await bulkSetFieldOne(entityName, spec, id, user, action.field, action.value);
        results.push({ id, success: true });
      } else if (action.type === 'transition') {
        if (!action.workflow || !action.toState) throw new Error('action.workflow and action.toState required');
        await bulkTransitionOne(entityName, id, action.workflow, action.toState, user);
        results.push({ id, success: true });
      } else if (action.type === 'notify') {
        await bulkNotifyOne(entityName, spec, id, user, action.message);
        results.push({ id, success: true });
      } else {
        results.push({ id, success: false, error: `Unknown action type "${action.type}"` });
      }
    } catch (error) {
      results.push({ id, success: false, error: error.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.length - succeeded;
  return { ok: true, total: results.length, succeeded, failed, results };
}
