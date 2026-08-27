import { page } from '@/ui/layout.js';
import { esc, statusPill } from '@/ui/render-helpers.js';
import { SPACING, renderPageHeader, renderStatsRow, renderEmptyState } from '@/ui/spacing-system.js';

export function renderReviewAnalytics(user, data = {}) {
  const reviews = data.reviews || [];
  const highlights = data.highlights || [];
  const recentActivity = data.recentActivity || [];

  const byStatus = {};
  for (const r of reviews) { const s = r.status || 'unknown'; byStatus[s] = (byStatus[s] || 0) + 1; }

  const unresolved = highlights.filter(h => (h.status || 'unresolved') === 'unresolved').length;
  const resolved = highlights.filter(h => h.status === 'resolved').length;

  const stats = renderStatsRow([
    { label: 'Total reviews', value: reviews.length },
    { label: 'Total highlights', value: highlights.length },
    { label: 'Unresolved', value: unresolved, sub: unresolved > 0 ? 'Need attention' : 'All clear' },
    { label: 'Resolved', value: resolved },
  ]);

  const statusRows = Object.entries(byStatus).map(([status, count]) => `<tr>
    <td>${statusPill(status)}</td>
    <td>${count}</td>
  </tr>`).join('');

  const statusBreakdown = `<div class="card-clean" style="margin-bottom:${SPACING.lg}"><div class="card-clean-body">
      <div class="card-header">Reviews by status</div>
      <table class="data-table"><tbody>${statusRows || `<tr><td colspan="2" class="table-empty-row">No reviews</td></tr>`}</tbody></table>
    </div></div>`;

  const activityRows = recentActivity.slice(0, 20).map(a => `<tr>
    <td>${esc(a.action || a.type || '-')}</td>
    <td>${esc(a.entity_type || a.entity || '-')}</td>
    <td>${a.created_at ? new Date(Number(a.created_at) * 1000).toLocaleString('en-ZA') : '-'}</td>
  </tr>`).join('');

  const activityHtml = recentActivity.length > 0
    ? `<div class="table-wrap">
        <div class="table-toolbar"><span class="table-count">Recent activity</span></div>
        <table class="data-table">
          <thead><tr><th>Action</th><th>Entity</th><th>When</th></tr></thead>
          <tbody>${activityRows}</tbody>
        </table>
      </div>`
    : renderEmptyState('No recent activity');

  const content = `${renderPageHeader('Review analytics', `${reviews.length} review${reviews.length !== 1 ? 's' : ''} tracked`)}
    ${stats}
    ${statusBreakdown}
    ${activityHtml}`;

  return page(user, 'Review analytics | Thatcher', [{ label: 'Reviews', href: '/review' }, { label: 'Analytics', href: '/reviews/analytics' }], content);
}
