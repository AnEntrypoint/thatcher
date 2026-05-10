import { page } from '@/ui/layout.js'
import { getQuickActions } from '@/ui/permissions-ui.js'
import { esc, stagePill, statusPill, TABLE_SCRIPT } from '@/ui/render-helpers.js'
import { SPACING, renderCard } from '@/ui/spacing-system.js'

export function renderDashboard(user, stats = {}) {
  const isClerk = user?.role === 'clerk';
  const statDefs = isClerk
    ? [
        { label: 'My RFIs',   value: stats.myRfis?.length || 0,     sub: 'Assigned to you',  href: '/rfi' },
        { label: 'Overdue',   value: stats.overdueRfis?.length || 0, sub: 'Need attention',   href: '/rfi', warn: true },
        { label: 'Reviews',   value: stats.reviews || 0,             sub: 'Total reviews',    href: '/review' },
        { label: 'Clients',   value: stats.clients || 0,             sub: 'Active clients',   href: '/client' },
      ]
    : [
        { label: 'Engagements', value: stats.engagements || 0, sub: 'Total engagements',  href: '/engagements' },
        { label: 'Clients',     value: stats.clients || 0,     sub: 'Active clients',     href: '/client' },
        { label: 'Open RFIs',   value: stats.rfis || 0,        sub: stats.overdueRfis?.length > 0 ? `${stats.overdueRfis.length} overdue` : 'All on track', href: '/rfi', warn: stats.overdueRfis?.length > 0 },
        { label: 'Reviews',     value: stats.reviews || 0,     sub: 'Active reviews',     href: '/review' },
      ];

  const statsHtml = `<div class="stats-row">${statDefs.map(s => `<a href="${s.href}" class="stat-card stat-card-clickable" style="text-decoration:none">
    <div class="stat-card-value${s.warn ? ' stat-card-warn' : ''}">${s.value}</div>
    <div class="stat-card-label">${s.label}</div>
    <div class="stat-card-sub">${esc(s.sub)}</div>
  </a>`).join('')}</div>`;

  const overdueAlert = stats.overdueRfis?.length > 0
    ? `<div class="alert alert-error" style="margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem">
        <div style="display:flex;align-items:center;gap:0.5rem">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>${stats.overdueRfis.length} overdue RFI${stats.overdueRfis.length !== 1 ? 's' : ''}</strong> require attention</span>
        </div>
        <a href="/rfi" class="btn-danger-clean" style="font-size:0.8125rem;padding:6px 14px;min-height:32px">View RFIs →</a>
      </div>` : '';

  const quickActions = getQuickActions(user);
  const actionsHtml = quickActions.length > 0
    ? `<div class="card-clean" style="margin-bottom:${SPACING.lg}"><div class="card-clean-body" style="padding:${SPACING.md}">
        <div class="card-header">Quick Actions</div>
        <div style="display:flex;flex-wrap:wrap;gap:${SPACING.sm}">${quickActions.map(a => `<a href="${a.href}" class="${a.primary ? 'btn-primary-clean' : 'btn-ghost-clean'}">${a.label}</a>`).join('')}</div>
      </div></div>` : '';

  const recentRows = (stats.recentEngagements || []).map(e => {
    const updated = e.updated_at ? new Date(typeof e.updated_at === 'number' ? e.updated_at * 1000 : e.updated_at).toLocaleDateString() : '-';
    return `<tr data-row data-navigate="/engagement/${esc(e.id)}" style="cursor:pointer">
      <td data-col="name"><strong>${esc(e.name || e.client_name || 'Untitled')}</strong></td>
      <td data-col="client">${esc(e.client_id_display || e.client_name || '-')}</td>
      <td data-col="stage">${stagePill(e.stage)}</td>
      <td data-col="status">${statusPill(e.status)}</td>
      <td data-col="updated">${updated}</td>
    </tr>`;
  }).join('');

  const emptyEngHtml = !isClerk && (stats.recentEngagements || []).length === 0
    ? `<div class="card-clean" style="margin-bottom:${SPACING.lg}">
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L4 7h16l-4-4z"/></svg>
          <div class="empty-state-title">No engagements yet</div>
          <div class="empty-state-desc">Create your first engagement to get started tracking work.</div>
          <a href="/engagements" class="btn-primary-clean">View Engagements</a>
        </div>
      </div>` : '';

  const recentHtml = !isClerk && (stats.recentEngagements || []).length > 0
    ? `<div class="table-wrap">
        <div class="table-toolbar">
          <div class="table-search"><input id="search-input" type="text" placeholder="Search engagements..."></div>
          <span class="table-count" id="row-count">${(stats.recentEngagements||[]).length} items</span>
        </div>
        <table class="data-table">
          <thead><tr><th data-sort="name">Name</th><th data-sort="client">Client</th><th data-sort="stage">Stage</th><th data-sort="status">Status</th><th data-sort="updated">Updated</th></tr></thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>` : '';

  const content = `<div class="page-header">
      <div>
        <h1 class="page-title">Welcome back, ${esc(user?.name?.split(' ')[0] || 'there')}</h1>
        <p class="page-subtitle">${new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
    ${statsHtml}${overdueAlert}${actionsHtml}${emptyEngHtml}${recentHtml}`;

  return page(user, 'Dashboard | Moonlanding', [], content, [TABLE_SCRIPT]);
}

export function renderAuditDashboard(user, auditData = {}) {
  const { summary = {}, recentActivity = [] } = auditData;
  const actRows = recentActivity.slice(0, 20).map(a =>
    `<tr data-row>
      <td data-col="time">${new Date((a.timestamp||a.created_at)*1000).toLocaleString()}</td>
      <td data-col="action"><span class="pill pill-info">${a.action||'-'}</span></td>
      <td data-col="entity">${a.entity_type||'-'}</td>
      <td data-col="id" style="font-size:12px">${a.entity_id||'-'}</td>
      <td data-col="user">${a.user_name||a.user_id||'-'}</td>
      <td data-col="reason" style="font-size:12px;color:var(--color-text-muted)">${a.reason||'-'}</td>
    </tr>`
   ).join('') || `<tr><td colspan="6" style="text-align:center;padding:${SPACING.xl};color:var(--color-text-muted)">No audit records found</td></tr>`;

  const statsHtml = `<div class="stats-row">${[
    { label: 'Total Actions (30d)', value: summary.total_actions || 0 },
    { label: 'Permission Grants',   value: summary.grants || 0 },
    { label: 'Permission Revokes',  value: summary.revokes || 0 },
    { label: 'Role Changes',        value: summary.role_changes || 0 },
  ].map(s => `<div class="stat-card"><div class="stat-card-value">${s.value}</div><div class="stat-card-label">${s.label}</div></div>`).join('')}</div>`;

  const content = `<div class="page-header"><h1 class="page-title">Audit Dashboard</h1><a href="/permission_audit" class="btn-ghost-clean">View All Records</a></div>
    ${statsHtml}
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search"><input id="search-input" type="text" placeholder="Search audit log..."></div>
        <span class="table-count" id="row-count">${recentActivity.length} items</span>
      </div>
      <table class="data-table">
        <thead><tr><th data-sort="time">Time</th><th data-sort="action">Action</th><th data-sort="entity">Entity Type</th><th data-sort="id">Entity ID</th><th data-sort="user">User</th><th data-sort="reason">Reason</th></tr></thead>
        <tbody>${actRows}</tbody>
      </table>
    </div>`;

  return page(user, 'Audit Dashboard | MOONLANDING', [{ href: '/', label: 'Dashboard' }, { href: '/admin/audit', label: 'Audit' }], content, [TABLE_SCRIPT]);
}

export function renderSystemHealth(user, healthData = {}) {
  const { database = {}, server: srv = {}, entities = {} } = healthData;
  const entRows = Object.entries(entities).map(([n, c]) =>
    `<tr data-row><td data-col="entity">${n}</td><td data-col="count" style="text-align:right">${c}</td></tr>`
   ).join('') || `<tr><td colspan="2" style="text-align:center;padding:${SPACING.xl};color:var(--color-text-muted)">No data</td></tr>`;

  const statsHtml = `<div class="stats-row">${[
    { label: 'Server Status', value: 'Online',                    sub: 'Port: '+(srv.port||3000) },
    { label: 'Database',      value: database.status||'Connected', sub: 'Size: '+(database.size||'N/A') },
    { label: 'Uptime',        value: srv.uptime||'N/A',            sub: 'Started: '+(srv.startTime||'N/A') },
  ].map(s => `<div class="stat-card"><div class="stat-card-value" style="font-size:20px">${s.value}</div><div class="stat-card-label">${s.label}</div><div class="stat-card-sub">${s.sub}</div></div>`).join('')}</div>`;

  const content = `<div class="page-header"><h1 class="page-title">System Health</h1></div>
    ${statsHtml}
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search"><input id="search-input" type="text" placeholder="Search entities..."></div>
        <span class="table-count" id="row-count">${Object.keys(entities).length} items</span>
      </div>
      <table class="data-table">
        <thead><tr><th data-sort="entity">Entity</th><th data-sort="count" style="text-align:right">Count</th></tr></thead>
        <tbody>${entRows}</tbody>
      </table>
    </div>`;

  return page(user, 'System Health | MOONLANDING', [{ href: '/', label: 'Dashboard' }, { href: '/admin/health', label: 'Health' }], content, [TABLE_SCRIPT]);
}
