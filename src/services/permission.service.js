// Adapted from moonlanding/src/services/permission.service.js

import { getCollaboratorRole, checkCollaboratorAccess } from '../services/collaborator-role.service.js';
import { PermissionError } from '../lib/error-handler.js';
import { getConfigEngineSync } from '../lib/config-generator-engine.js';

class PermissionService {
  can(user, spec, action) {
    if (!user) return false;
    if (!spec?.access?.[action]) return true; // No restriction defined = allow
    return spec.access[action].includes(user.role);
  }

  require(user, spec, action) {
    if (!this.can(user, spec, action)) {
      throw new PermissionError(`Cannot ${action} ${spec?.name || 'unknown'}`);
    }
  }

  checkFieldAccess(user, spec, fieldName, action) {
    if (!user) return false;
    const perm = spec.fieldPermissions?.[fieldName];
    if (!perm) return true;
    const allowed = perm[action];
    if (allowed === 'all') return true;
    return Array.isArray(allowed) && allowed.includes(user.role);
  }

  checkRowAccess(user, spec, record) {
    if (!user) return false;
    const rowAccess = spec.rowAccess || spec.row_access;
    if (!rowAccess) return true;

    const roles = getConfigEngineSync().getRoles();
    const partnerRole = Object.keys(roles).find(r => roles[r].hierarchy === 0);
    const clientAdminRole = Object.keys(roles).find(r => r.includes('client') && r.includes('admin'));
    const clientUserRole = Object.keys(roles).find(r => r === 'client_user');

    const scope = rowAccess.scope || rowAccess;

    if (scope === 'team' && record.team_id && user.team_id && record.team_id !== user.team_id) {
      return false;
    }

    if (scope === 'assigned' && record.assigned_to && record.assigned_to !== user.id && user.role !== partnerRole) {
      return false;
    }

    if (scope === 'assigned_or_team' && user.role !== partnerRole) {
      const assignedMatch = record.assigned_to && record.assigned_to === user.id;
      const teamMatch = record.team_id && user.team_id && record.team_id === user.team_id;
      if (!assignedMatch && !teamMatch) return false;
    }

    if (scope === 'client') {
      if ((clientAdminRole && user.role === clientAdminRole) || (clientUserRole && user.role === clientUserRole)) {
        if (record.client_id && user.client_id && record.client_id !== user.client_id) return false;
        if (clientUserRole && user.role === clientUserRole && !this.checkAssignment(user, spec, record)) {
          return false;
        }
      } else if (record.client_id && user.client_ids && !user.client_ids.includes(record.client_id)) {
        return false;
      }
    }

    return true;
  }

  filterRecords(user, spec, records) {
    if (!user || !Array.isArray(records)) return records;
    return records.filter(r => this.checkRowAccess(user, spec, r));
  }

  filterFields(user, spec, record) {
    if (!user) return record;
    const filtered = {};
    for (const [key, value] of Object.entries(record)) {
      if (spec.fields?.[key]?.hidden) continue;
      if (this.checkFieldAccess(user, spec, key, 'view')) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  enforceEditPermissions(user, spec, data) {
    if (!user) throw new PermissionError(`Cannot edit ${spec.name}`);
    if (!this.can(user, spec, 'edit')) throw new PermissionError(`Cannot edit ${spec.name}`);

    for (const field of Object.keys(data)) {
      if (!this.checkFieldAccess(user, spec, field, 'edit')) {
        throw new PermissionError(`Cannot edit ${spec.name}.${field}`);
      }
    }
  }

  checkOwnership(user, spec, record) {
    if (!record) return false;
    return record.created_by === user.id || record.user_id === user.id;
  }

  checkAssignment(user, spec, record) {
    // Simplified - check if user is assigned to record
    return record.assigned_to === user.id || record.team_id === user.team_id;
  }

  async hasCollaboratorPermission(collaboratorId, permission) {
    return (await getCollaboratorRole(collaboratorId))?.permissions?.includes(permission);
  }
}

export const permissionService = new PermissionService();
export default permissionService;

// Free-function wrappers over the singleton (parity with moonlanding's permission.service API).
export function can(user, spec, action) { return permissionService.can(user, spec, action); }
export function check(user, spec, action) { return permissionService.require(user, spec, action); }
