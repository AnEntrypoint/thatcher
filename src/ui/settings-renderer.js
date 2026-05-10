import { page } from '@/ui/layout.js';
import { TOAST_SCRIPT, TABLE_SCRIPT, statusBadge as _statusBadge } from '@/ui/render-helpers.js';
import { SPACING, renderCard } from '@/ui/spacing-system.js';

export { TOAST_SCRIPT } from '@/ui/render-helpers.js';

export function settingsPage(user, title, bc, content, scripts = []) {
  return page(user, title, bc, content, scripts);
}

export function settingsBack() {
  return `<a href="/admin/settings" class="btn btn-ghost btn-sm gap-1 mb-4">&#8592; Back to Settings</a>`;
}

export function inlineTable(headers, rows, emptyMsg) {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const empty = `<tr><td colspan="${headers.length}" class="text-center py-8 text-base-content/40 text-sm">${emptyMsg}</td></tr>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${rows || empty}</tbody></table></div>`;
}

const KNOWN_ROLE_LABELS = { admin:'Admin', partner:'Partner', manager:'Manager', clerk:'Clerk', user:'User', auditor:'Auditor', client_admin:'Client Admin', client_user:'Client User' };

export function roleBadge(role) {
  const r = (role || '').toLowerCase();
  const pillMap = { admin:'pill pill-danger', partner:'pill pill-info', manager:'pill pill-success', clerk:'pill pill-warning', user:'pill pill-neutral', auditor:'pill pill-neutral', client_admin:'pill pill-info', client_user:'pill pill-neutral' };
  const cls = pillMap[r] || 'pill pill-neutral';
  const label = KNOWN_ROLE_LABELS[r] || (r.length > 20 ? 'Staff' : (r.charAt(0).toUpperCase() + r.slice(1))) || 'Staff';
  return `<span class="${cls}">${label}</span>`;
}

function statusBadge(status) { return _statusBadge(status); }

const SETTINGS_CARDS = [
  { key: 'system', icon: '&#9881;', title: 'System Info', desc: 'Database, server, cache configuration', href: '/admin/settings/system' },
  { key: 'users', icon: '&#128100;', title: 'Users', desc: 'Manage user accounts and roles', href: '/admin/settings/users', countKey: 'users' },
  { key: 'teams', icon: '&#128101;', title: 'Teams', desc: 'Manage audit teams', href: '/admin/settings/teams', countKey: 'teams' },
  { key: 'rfi-sections', icon: '&#128193;', title: 'RFI Sections', desc: 'Manage RFI section categories and colors', href: '/admin/settings/rfi-sections', countKey: 'rfiSections' },
  { key: 'templates', icon: '&#128196;', title: 'Templates', desc: 'Review templates and sections', href: '/admin/settings/templates', countKey: 'templates' },
  { key: 'notifications', icon: '&#128276;', title: 'Notifications', desc: 'Configure alerts, reminders, and reports', href: '/admin/settings/notifications' },
  { key: 'integrations', icon: '&#128279;', title: 'Integrations', desc: 'Google Drive, Gmail, and external services', href: '/admin/settings/integrations' },
  { key: 'checklists', icon: '&#9745;', title: 'Checklists', desc: 'Manage checklist definitions', href: '/admin/settings/checklists', countKey: 'checklists' },
  { key: 'rfi-templates', icon: '&#128203;', title: 'RFI Templates', desc: 'Manage RFI template definitions', href: '/admin/settings/rfi-templates', countKey: 'rfiTemplates' },
  { key: 'recreation', icon: '&#128203;', title: 'Audit Logs', desc: 'Audit trail, recreation history and event log', href: '/admin/settings/recreation' },
  { key: 'entity-types', icon: '&#127970;', title: 'Entity Types', desc: 'Manage client entity type definitions', href: '/admin/settings/entity-types', countKey: 'entityTypes' },
  { key: 'engagement-types', icon: '&#128196;', title: 'Engagement Types', desc: 'Manage engagement type definitions', href: '/admin/settings/engagement-types', countKey: 'engagementTypes' },
  { key: 'permissions', icon: '&#128274;', title: 'Permissions', desc: 'MWR permissions and access control', href: '/admin/settings/permissions' },
];

export function renderSettingsHome(user, config = {}, counts = {}) {
  const cards = SETTINGS_CARDS.map(c => {
    const cnt = c.countKey && counts[c.countKey] !== undefined ? counts[c.countKey] : null;
    const badge = cnt !== null ? `<span class="badge badge-flat-primary text-xs">${cnt.toLocaleString()} items</span>` : '';
    return `<a href="${c.href}" class="card-clean" style="text-decoration:none;border:1px solid var(--color-border);transition:box-shadow 0.15s">
      <div class="card-clean-body" style="padding:${SPACING.md}">
        <div style="display:flex;align-items:flex-start;gap:${SPACING.md}">
          <div style="font-size:1.25rem;width:2.25rem;height:2.25rem;display:flex;align-items:center;justify-content:center;background:var(--color-base-200);border-radius:8px;flex-shrink:0">${c.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:0.875rem;color:var(--color-base-content)">${c.title}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:${SPACING.xs};line-height:1.4">${c.desc}</div>
            ${badge ? `<div style="margin-top:${SPACING.sm}">${badge}</div>` : ''}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--color-text-muted);margin-top:${SPACING.xs}"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </a>`;
  }).join('');
  const content = `
    <div class="flex items-center justify-between mb-6">
      <div><h1 class="text-2xl font-bold text-base-content">Settings</h1><p class="text-sm text-base-content/50 mt-1">System configuration and administration</p></div>
    </div>
    <div class="settings-home-grid">${cards}</div>`;
  return settingsPage(user, 'Settings', [{ href: '/', label: 'Dashboard' }, { label: 'Settings' }], content);
}

export function renderSettingsSystem(user, config = {}) {
  const t = config.thresholds || {};
  const sections = [
    { icon: '🗄️', title: 'System Information', items: [['Database Type', config.database?.type || 'SQLite'], ['Server Port', config.server?.port || 3004], ['Session TTL', (t.cache?.session_ttl_seconds || 3600) + 's'], ['Page Size (Default)', t.system?.default_page_size || 50], ['Page Size (Max)', t.system?.max_page_size || 500]] },
    { icon: '📋', title: 'RFI Configuration', items: [['Max Days Outstanding', (t.rfi?.max_days_outstanding || 90) + ' days'], ['Escalation Delay', (t.rfi?.escalation_delay_hours || 24) + ' hours'], ['Notification Days', (t.rfi?.notification_days || [7, 3, 1, 0]).join(', ')]] },
    { icon: '✉️', title: 'Email Configuration', items: [['Batch Size', t.email?.send_batch_size || 10], ['Max Retries', t.email?.send_max_retries || 3], ['Rate Limit Delay', (t.email?.rate_limit_delay_ms || 6000) + 'ms']] },
    { icon: '⚙️', title: 'Workflow Configuration', items: [['Stage Transition Lockout', (t.workflow?.stage_transition_lockout_minutes || 5) + ' min'], ['Collaborator Default Expiry', (t.collaborator?.default_expiry_days || 7) + ' days'], ['Collaborator Max Expiry', (t.collaborator?.max_expiry_days || 30) + ' days']] },
  ];
  const cards = sections.map(s => `<div class="card-clean">
    <div class="card-clean-body" style="padding:1rem">
      <h2 class="font-semibold text-sm flex items-center gap-2 mb-3"><span>${s.icon}</span> ${s.title}</h2>
      ${s.items.map(([l, v]) => `<div class="flex justify-between items-center py-2 border-b border-base-200 last:border-0">
        <span class="text-sm text-base-content/60">${l}</span>
        <span class="text-sm font-semibold font-mono bg-base-200 px-2 py-0.5 rounded">${v}</span>
      </div>`).join('')}
    </div>
  </div>`).join('');
  const content = `${settingsBack()}
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem">
      <h1 class="text-2xl font-bold">System Info</h1>
      <span class="badge badge-flat-success text-xs">Read-only</span>
    </div>
    <div class="settings-info-grid">${cards}</div>`;
  return settingsPage(user, 'System Info - Settings', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'System Info' }], content);
}

export function renderSettingsUsers(user, users = []) {
  const active = users.filter(u => (u.status||'active') === 'active').length;
  const rows = users.map(u => `<tr class="hover cursor-pointer" data-row data-navigate="/user/${u.id}">
    <td data-col="name">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">${(u.name||'?').charAt(0).toUpperCase()}</div>
        <div>
          <div class="text-sm font-medium">${u.name || '-'}</div>
          <div class="text-xs text-base-content/50">${u.email || ''}</div>
        </div>
      </div>
    </td>
    <td data-col="role">${roleBadge(u.role || '-')}</td>
    <td data-col="status">${statusBadge(u.status)}</td>
    <td><a href="/user/${u.id}/edit" data-stop-propagation="true" class="btn btn-ghost btn-xs">Edit</a></td>
  </tr>`).join('');

  const content = `${settingsBack()}
  <div class="flex justify-between items-center mb-2">
    <div>
      <h1 class="text-2xl font-bold">Users</h1>
      <p class="text-sm text-base-content/50 mt-0.5">${users.length} total &middot; ${active} active</p>
    </div>
    <a href="/user/new" class="btn btn-primary btn-sm gap-1">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add User
    </a>
  </div>
  <div class="table-toolbar mb-3">
    <div class="table-search"><input id="search-input" type="text" placeholder="Search users..."></div>
    <div class="table-filter">
      <select data-filter="role">
        <option value="">All roles</option>
        <option value="admin">Admin</option>
        <option value="partner">Partner</option>
        <option value="manager">Manager</option>
        <option value="clerk">Clerk</option>
        <option value="auditor">Auditor</option>
        <option value="user">User</option>
      </select>
    </div>
    <div class="table-filter">
      <select data-filter="status">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
    <span class="table-count" id="row-count">${users.length} items</span>
  </div>
  <div class="card-clean">
    <div class="card-clean-body" style="padding:0rem">
      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th data-sort="name">User</th>
          <th data-sort="role">Role</th>
          <th data-sort="status">Status</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center py-10 text-base-content/40">No users found</td></tr>'}</tbody>
      </table></div>
    </div>
  </div>`;
  return settingsPage(user, 'Users - Settings', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'Users' }], content, [TABLE_SCRIPT]);
}

export { renderSettingsTeams, renderSettingsRfiSections } from '@/ui/settings-renderer-teams.js';
