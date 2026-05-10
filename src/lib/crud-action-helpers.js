import { AppError } from '@/lib/errors';
import { HTTP } from '@/config/constants';
import { now } from '@/lib/database-core';

const ACTION_FIELD_MAPS = {
  resolve_highlight: { status: 'resolved', color: 'green' },
  reopen_highlight: { status: 'unresolved', color: 'grey', resolved_at: null, resolved_by: null, resolution_notes: null },
  change_status: (data, user) => ({ status: data.status || data.toStatus, status_changed_at: now(), status_changed_by: user.id }),
  respond: (data, user) => ({ status: 'responded', response: data.response, responded_at: now(), responded_by: user.id }),
};

export function resolveActionUpdate(action, data, user, record) {
  const mapped = ACTION_FIELD_MAPS[action];
  if (typeof mapped === 'function') return mapped(data, user);
  if (mapped) {
    const result = { ...mapped };
    if (action === 'resolve_highlight') {
      result.resolved_at = now();
      result.resolved_by = user.id;
      result.resolution_notes = data.notes || data.resolution_notes || '';
    }
    return result;
  }
  return data;
}

export function validateActionPrecondition(action, record) {
  if (action === 'resolve_highlight' && record.status === 'resolved') {
    throw new AppError('Highlight already resolved', 'BAD_REQUEST', HTTP.BAD_REQUEST);
  }
  if (action === 'reopen_highlight' && record.status !== 'resolved') {
    throw new AppError('Highlight not resolved', 'BAD_REQUEST', HTTP.BAD_REQUEST);
  }
}
