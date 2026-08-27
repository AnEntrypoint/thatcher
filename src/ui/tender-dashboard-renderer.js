import { page } from '@/ui/layout.js';
import { esc, statusPill } from '@/ui/render-helpers.js';
import { renderPageHeader, renderStatsRow, renderEmptyState } from '@/ui/spacing-system.js';

export function renderTenderDashboard(user, tenders = [], reviews = []) {
  const open = tenders.filter(t => t.status !== 'closed' && t.status !== 'awarded').length;
  const awarded = tenders.filter(t => t.status === 'awarded').length;

  const stats = renderStatsRow([
    { label: 'Total tenders', value: tenders.length },
    { label: 'Open', value: open },
    { label: 'Awarded', value: awarded },
    { label: 'Reviews linked', value: reviews.length },
  ]);

  const rows = tenders.map(t => `<tr data-row data-navigate="/review/${esc(t.review_id || '')}" style="cursor:pointer">
    <td><strong>${esc(t.name || t.title || 'Untitled tender')}</strong></td>
    <td>${esc(t.review_name || '-')}</td>
    <td>${statusPill(t.status)}</td>
    <td>${t.deadline ? new Date(Number(t.deadline) * 1000).toLocaleDateString('en-ZA') : '-'}</td>
  </tr>`).join('');

  const table = tenders.length > 0
    ? `<div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tender</th><th>Review</th><th>Status</th><th>Deadline</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    : renderEmptyState('No tenders found');

  const content = `${renderPageHeader('Tenders', `${tenders.length} tender${tenders.length !== 1 ? 's' : ''}`)}
    ${stats}
    ${table}`;

  return page(user, 'Tenders | Thatcher', [{ label: 'Reviews', href: '/review' }, { label: 'Tenders', href: '/reviews/tenders' }], content);
}
