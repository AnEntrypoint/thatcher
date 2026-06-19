// Extracted from moonlanding/src/services/collaborator-role.service.js

import { list, get, update, create } from '../lib/busybase-store.js';
import { AppError } from '../lib/error-handler.js';
import { HTTP } from '../config/constants.js';

const COLLABORATOR_ROLE_PERMISSIONS = {
  viewer: ['view', 'view_highlights', 'view_pdfs'],
  commenter: ['view', 'view_highlights', 'view_pdfs', 'add_notes', 'add_comments'],
  reviewer: [
    'view', 'view_highlights', 'view_pdfs', 'add_notes', 'add_comments',
    'edit_highlights', 'resolve_highlights', 'reopen_highlights', 'create_highlights',
    'delete_own_highlights', 'manage_highlights'
  ],
  manager: [
    'view', 'view_highlights', 'view_pdfs', 'add_notes', 'add_comments',
    'edit_highlights', 'resolve_highlights', 'reopen_highlights', 'create_highlights',
    'delete_highlights', 'manage_highlights', 'manage_collaborators', 'manage_flags',
    'manage_templates', 'manage_checklists', 'archive', 'assign_roles', 'approve_changes'
  ],
};

export async function getCollaboratorRole(collaboratorId) {
  if (!collaboratorId) return null;
  const collaborator = await get('collaborator', collaboratorId);
  if (!collaborator) return null;

  if (collaborator.primary_role_id) {
    const role = await get('collaborator_role', collaborator.primary_role_id);
    if (role && role.is_active) return role;
  }

  const roles = (await list('collaborator_role'))
    .filter(r => r.collaborator_id === collaboratorId && r.is_active);

  if (roles.length === 0) return null;

  roles.sort((a, b) => b.assigned_at - a.assigned_at);
  const activeRole = roles[0];

  if (collaborator.primary_role_id !== activeRole.id) {
    await update('collaborator', collaboratorId, {
      primary_role_id: activeRole.id,
      is_manager: activeRole.role_type === 'manager'
    });
  }
  return activeRole;
}

export async function hasCollaboratorPermission(collaboratorId, permission) {
  const role = await getCollaboratorRole(collaboratorId);
  if (!role) return false;
  const perms = COLLABORATOR_ROLE_PERMISSIONS[role.role_type];
  return perms ? perms.includes(permission) : false;
}

export async function checkCollaboratorAccess(collaboratorId, action, record = null) {
  const role = await getCollaboratorRole(collaboratorId);
  if (!role) return false;
  const perms = COLLABORATOR_ROLE_PERMISSIONS[role.role_type];
  if (!perms) return false;
  if (perms.includes(action)) return true;
  if (action === 'delete_highlights' && perms.includes('delete_own_highlights') && record) {
    const collaborator = await get('collaborator', collaboratorId);
    return record.created_by === collaborator?.user_id;
  }
  return false;
}

export async function getCollaboratorRoleHistory(collaboratorId) {
  if (!collaboratorId) return [];
  return (await list('collaborator_role'))
    .filter(r => r.collaborator_id === collaboratorId)
    .sort((a, b) => b.assigned_at - a.assigned_at);
}

export function getCollaboratorRolePermissions(roleType) {
  return COLLABORATOR_ROLE_PERMISSIONS[roleType] || [];
}

export function canAssignRole(userRole, targetRoleType) {
  return ['partner', 'manager'].includes(userRole);
}

export async function addCollaborator(reviewId, email, options = {}) {
  const { expiresAt, createdBy = 'system', reason = '' } = options;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const isPermanent = !expiresAt;

  if (expiresAt) {
    const maxAllowed = nowSeconds + (30 * 24 * 60 * 60);
    if (expiresAt <= nowSeconds) throw new Error('Expiry date must be in the future');
    if (expiresAt > maxAllowed) throw new Error('Expiry date cannot exceed 30 days from now');
  }

  return await create('collaborator', {
    review_id: reviewId,
    email,
    expires_at: expiresAt || null,
    is_permanent: isPermanent,
    created_at: nowSeconds,
    created_by: createdBy,
    reason,
    access_type: isPermanent ? 'permanent' : 'temporary',
  }, { id: createdBy, role: 'partner' });
}

export async function getReviewCollaborators(reviewId) {
  const collaborators = await list('collaborator', { review_id: reviewId });
  const nowSeconds = Math.floor(Date.now() / 1000);

  return collaborators.map(c => ({
    id: c.id,
    email: c.email,
    accessType: c.access_type,
    isPermanent: c.is_permanent,
    expiresAt: c.expires_at,
    daysUntilExpiry: c.expires_at ? Math.ceil((c.expires_at - nowSeconds) / 86400) : null,
    isExpired: !c.is_permanent && c.expires_at && c.expires_at <= nowSeconds,
    createdAt: c.created_at,
    createdBy: c.created_by,
  }));
}

export async function revokeCollaborator(collaboratorId, reason = 'manual_revoke', revokedBy = 'system') {
  const collaborator = await get('collaborator', collaboratorId);
  if (!collaborator) throw new Error('Collaborator not found');

  await update('collaborator', collaboratorId, {
    revoked_at: Math.floor(Date.now() / 1000),
    revoked_by: revokedBy,
    revocation_reason: reason,
    access_type: 'revoked',
  }, { id: revokedBy, role: 'partner' });

  return true;
}

export default {
  getCollaboratorRole,
  hasCollaboratorPermission,
  checkCollaboratorAccess,
  getCollaboratorRoleHistory,
  getCollaboratorRolePermissions,
  canAssignRole,
  addCollaborator,
  getReviewCollaborators,
  revokeCollaborator,
};
