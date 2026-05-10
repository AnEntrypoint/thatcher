import { getConfigEngineSync } from '@/lib/config-generator-engine.js';

function getRoleHierarchy() {
  const config = getConfigEngineSync();
  const roles = config.getRoles();
  const hierarchy = {};
  let level = 0;
  for (const [roleName] of Object.entries(roles)) {
    hierarchy[roleName] = level++;
  }
  return hierarchy;
}

function getEntityPermissions() {
  const config = getConfigEngineSync();
  const entityNames = config.getAllEntities();
  const permissions = {};

  for (const name of entityNames) {
    if (!name) continue;
    try {
      const spec = config.generateEntitySpec(name);

      const access = spec.access || {};

      permissions[name] = {
        list: access.list || [],
        view: access.view || [],
        create: access.create || [],
        edit: access.edit || [],
        delete: access.delete || [],
      };
    } catch (e) {
      console.error(`[Permissions] Error loading permissions for ${name}:`, e.message);
      permissions[name] = { list: [], view: [], create: [], edit: [], delete: [] };
    }
  }
  return permissions;
}

export function canAccess(user, entity, action) {
  if (!user?.role) return false;
  const config = getConfigEngineSync();
  const allPermissions = getEntityPermissions();
  const permissions = allPermissions[entity];

  if (!permissions) return isPartner(user);
  const allowed = permissions[action] || [];
  if (allowed.includes(user.role)) return true;
  if (!allowed.length) return false;
  if (action === 'list' || action === 'view') return isClerk(user);
  return false;
}

export function canList(user, entity) {
  return canAccess(user, entity, 'list');
}

export function canView(user, entity) {
  return canAccess(user, entity, 'view');
}

export function canCreate(user, entity) {
  return canAccess(user, entity, 'create');
}

export function canEdit(user, entity) {
  return canAccess(user, entity, 'edit');
}

export function canDelete(user, entity) {
  return canAccess(user, entity, 'delete');
}

export function isPartner(user) {
  return ['partner', 'admin'].includes(user?.role);
}

export function isManager(user) {
  return ['manager'].includes(user?.role);
}

export function isClerk(user) {
  return ['clerk', 'user'].includes(user?.role);
}

export function isClientUser(user) {
  const config = getConfigEngineSync();
  const roles = config.getRoles();
  const clientRoles = Object.keys(roles).filter(r => r.includes('client'));
  return clientRoles.includes(user?.role);
}

export function isClientAdmin(user) {
  const config = getConfigEngineSync();
  const roles = config.getRoles();
  const clientAdminRole = Object.keys(roles).find(r => r === 'client_admin');
  return user?.role === clientAdminRole;
}

export function isAuditor(user) {
  const config = getConfigEngineSync();
  const roles = config.getRoles();
  const auditRoles = Object.keys(roles).filter(r => !r.includes('client'));
  return auditRoles.includes(user?.role);
}

const CLIENT_VISIBLE_ENTITIES = ['engagement', 'rfi', 'review', 'file', 'message', 'rfi_response'];

export function canClientAccessEntity(user, entityName) {
  if (!isClientUser(user)) return true;
  return CLIENT_VISIBLE_ENTITIES.includes(entityName);
}

export function getNavItems(user, domain) {
  const items = [];
  if (domain === 'mwr') return getMwrNavItems(user);
  if (canList(user, 'engagement')) items.push({ href: '/engagements', label: 'Engagements' });
  if (canList(user, 'client')) items.push({ href: '/client', label: 'Clients' });
  if (canList(user, 'rfi')) items.push({ href: '/rfi', label: 'RFIs' });
  if (canList(user, 'review')) items.push({ href: '/review', label: 'Reviews' });
  if (canList(user, 'user')) items.push({ href: '/user', label: 'Users' });
  if (canList(user, 'team')) items.push({ href: '/team', label: 'Teams' });
  if (canList(user, 'tender')) items.push({ href: '/tender', label: 'Tenders' });
  if (canList(user, 'checklist')) items.push({ href: '/checklist', label: 'Checklists' });
  if (canList(user, 'file')) items.push({ href: '/file', label: 'Files' });
  if (canList(user, 'letter')) items.push({ href: '/letter', label: 'Letters' });
  return items;
}

export function getMwrNavItems(user) {
  const items = [];
  if (canCreate(user, 'review')) items.push({ href: '/review/new', label: 'Start Review' });
  if (canList(user, 'review')) items.push({ href: '/reviews/active', label: 'Active Reviews' });
  if (canList(user, 'review')) items.push({ href: '/reviews/priority', label: 'Priority Reviews' });
  if (canList(user, 'review')) items.push({ href: '/reviews/history', label: 'History' });
  if (canList(user, 'review')) items.push({ href: '/reviews/archive', label: 'Archive' });
  return items;
}

export function getAdminItems(user) {
  const items = [];
  if (canList(user, 'permission_audit')) items.push({ href: '/admin/audit', label: 'Audit' });
  if (isPartner(user)) items.push({ href: '/admin/health', label: 'Health' });
  if (isPartner(user)) items.push({ href: '/admin/settings', label: 'Settings' });
  return items;
}

export function getQuickActions(user) {
  const actions = [];
  if (isClerk(user)) {
    actions.push({ href: '/rfi', label: 'View My RFIs', primary: true });
    actions.push({ href: '/engagements', label: 'View Engagements', outline: true });
  } else if (isClientUser(user)) {
    actions.push({ href: '/rfi', label: 'View My RFIs', primary: true });
    actions.push({ href: '/engagements', label: 'My Engagements', outline: true });
  } else {
    if (canCreate(user, 'engagement')) actions.push({ href: '/engagements/new', label: 'New Engagement', primary: true });
    if (canCreate(user, 'client')) actions.push({ href: '/client/new', label: 'New Client', outline: true });
    if (canCreate(user, 'review')) actions.push({ href: '/review/new', label: 'New Review', outline: true });
  }
  return actions;
}
