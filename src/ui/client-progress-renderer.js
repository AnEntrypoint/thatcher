import { page } from '@/ui/layout.js'
import { esc, statusPill, progressBar } from '@/ui/render-helpers.js'
import { SPACING } from '@/ui/spacing-system.js'

export function renderClientProgress(user, client, engagements = [], rfiStats = {}) {
  const total = rfiStats.total || 0
  const responded = rfiStats.responded || 0
  const overdue = rfiStats.overdue || 0
  const pct = total > 0 ? (responded / total) * 100 : 0

  const overdueAlert = overdue > 0
    ? `<div class="alert-strip alert-strip-danger" style="margin-bottom:${SPACING.lg}">
        <span><strong>${overdue} overdue RFI${overdue !== 1 ? 's' : ''}</strong> require attention</span>
      </div>` : ''

  const rfiSummary = `<div class="card-clean" style="margin-bottom:${SPACING.lg}"><div class="card-clean-body">
      <div class="card-header">RFI response progress</div>
      ${progressBar(pct)}
      <p class="form-hint" style="margin-top:${SPACING.sm}">${responded} of ${total} RFIs responded</p>
    </div></div>`

  const engRows = engagements.map(e => `<tr data-row data-navigate="/engagement/${esc(e.id)}" style="cursor:pointer">
    <td data-col="name"><strong>${esc(e.name || 'Untitled')}</strong></td>
    <td data-col="status">${statusPill(e.status)}</td>
  </tr>`).join('')

  const engHtml = engagements.length > 0
    ? `<div class="table-wrap">
        <div class="table-toolbar"><span class="table-count">${engagements.length} engagement${engagements.length !== 1 ? 's' : ''}</span></div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Status</th></tr></thead>
          <tbody>${engRows}</tbody>
        </table>
      </div>`
    : `<div class="card-clean"><div class="empty-state">
        <div class="empty-state-title">No engagements yet</div>
        <div class="empty-state-desc">This client has no engagements to track progress on.</div>
      </div></div>`

  const content = `<div class="page-header">
      <div>
        <h1 class="page-title">${esc(client?.name || 'Client')} — Progress</h1>
      </div>
    </div>
    ${overdueAlert}${rfiSummary}${engHtml}`

  return page(user, `${client?.name || 'Client'} progress | Thatcher`, [
    { label: 'Clients', href: '/client' },
    { label: client?.name || 'Client', href: `/client/${esc(client?.id || '')}/dashboard` },
    { label: 'Progress', href: `/client/${esc(client?.id || '')}/progress` },
  ], content)
}
