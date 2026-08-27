import { page } from '@/ui/layout.js';
import { esc, statusPill, TABLE_SCRIPT } from '@/ui/render-helpers.js';
import { renderPageHeader } from '@/ui/spacing-system.js';

export function renderRfiList(user, rfis = [], engagements = []) {
  const engById = new Map(engagements.map(e => [e.id, e]));

  const rows = rfis.map(r => {
    const eng = engById.get(r.engagement_id);
    const due = r.due_date ? new Date(Number(r.due_date) * 1000) : null;
    const now = Date.now();
    const overdue = due && due.getTime() < now && r.status !== 'closed' && r.status !== 'responded' && r.status !== 'completed';
    return `<tr data-row data-navigate="/rfi/${esc(r.id)}" style="cursor:pointer">
      <td data-col="name"><strong>${esc(r.display_name || r.name || 'Untitled RFI')}</strong></td>
      <td data-col="engagement">${esc(eng?.name || r.engagement_id_display || '-')}</td>
      <td data-col="status">${overdue ? '<span class="pill pill-danger">Overdue</span>' : statusPill(r.status)}</td>
      <td data-col="due">${due ? due.toLocaleDateString('en-ZA') : '-'}</td>
    </tr>`;
  }).join('');

  const content = `${renderPageHeader('RFIs', `${rfis.length} request${rfis.length !== 1 ? 's' : ''} for information`)}
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search"><input id="search-input" type="text" placeholder="Search RFIs..."></div>
        <span class="table-count" id="row-count">${rfis.length} items</span>
      </div>
      <table class="data-table">
        <thead><tr><th data-sort="name">Name</th><th data-sort="engagement">Engagement</th><th data-sort="status">Status</th><th data-sort="due">Due</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="table-empty-row">No RFIs found</td></tr>`}</tbody>
      </table>
    </div>`;

  return page(user, 'RFIs | Thatcher', [{ label: 'My Review', href: '/review' }, { label: 'RFIs', href: '/rfi' }], content, [TABLE_SCRIPT]);
}
