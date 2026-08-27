import { page } from '@/ui/layout.js'
import { esc, statusPill, TABLE_SCRIPT, emptyRow } from '@/ui/render-helpers.js'
import { SPACING } from '@/ui/spacing-system.js'

export function renderClientList(user, clients = []) {
  const rows = clients.map(c => `<tr data-row data-navigate="/client/${esc(c.id)}/dashboard" style="cursor:pointer">
    <td data-col="name"><strong>${esc(c.name || 'Untitled')}</strong></td>
    <td data-col="email">${esc(c.email || '-')}</td>
    <td data-col="status">${statusPill(c.status)}</td>
  </tr>`).join('')

  const content = `<div class="page-header">
      <div>
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">${clients.length} client${clients.length === 1 ? '' : 's'}</p>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search"><input id="search-input" type="text" placeholder="Search clients..."></div>
        <span class="table-count" id="row-count">${clients.length} items</span>
      </div>
      <table class="data-table">
        <thead><tr><th data-sort="name">Name</th><th data-sort="email">Email</th><th data-sort="status">Status</th></tr></thead>
        <tbody>${rows || emptyRow(3, 'No clients found')}</tbody>
      </table>
    </div>`

  return page(user, 'Clients | Thatcher', [{ label: 'Clients', href: '/client' }], content, [TABLE_SCRIPT])
}

export function renderClientDashboard(user, client, stats = {}) {
  const statDefs = [
    { label: 'Engagements', value: stats.engagements || 0, sub: 'Total engagements' },
    { label: 'Active RFIs', value: stats.activeRfis || 0, sub: 'Awaiting response', warn: (stats.activeRfis || 0) > 0 },
    { label: 'Users', value: stats.users || 0, sub: 'Client-side users' },
    { label: 'Reviews', value: stats.reviews || 0, sub: 'Total reviews' },
  ]

  const statsHtml = `<div class="stats-row">${statDefs.map(s => `<div class="stat-card">
    <div class="stat-card-value${s.warn ? ' stat-card-warn' : ''}">${s.value}</div>
    <div class="stat-card-label">${s.label}</div>
    <div class="stat-card-sub">${esc(s.sub)}</div>
  </div>`).join('')}</div>`

  const engRows = (stats.engagementList || []).map(e => `<tr data-row data-navigate="/engagement/${esc(e.id)}" style="cursor:pointer">
    <td data-col="name"><strong>${esc(e.name || 'Untitled')}</strong></td>
    <td data-col="status">${statusPill(e.status)}</td>
  </tr>`).join('')

  const engHtml = (stats.engagementList || []).length > 0
    ? `<div class="table-wrap">
        <div class="table-toolbar"><span class="table-count">${stats.engagementList.length} recent engagements</span></div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Status</th></tr></thead>
          <tbody>${engRows}</tbody>
        </table>
      </div>`
    : `<div class="card-clean"><div class="empty-state">
        <div class="empty-state-title">No engagements yet</div>
        <div class="empty-state-desc">This client has no engagements on record.</div>
      </div></div>`

  const content = `<div class="page-header">
      <div>
        <h1 class="page-title">${esc(client?.name || 'Client')}</h1>
        <p class="page-subtitle">${esc(client?.email || '')}</p>
      </div>
    </div>
    ${statsHtml}
    <div style="margin-top:${SPACING.lg}">${engHtml}</div>`

  return page(user, `${client?.name || 'Client'} | Thatcher`, [
    { label: 'Clients', href: '/client' },
    { label: client?.name || 'Client', href: `/client/${esc(client?.id || '')}/dashboard` },
  ], content, [TABLE_SCRIPT])
}
