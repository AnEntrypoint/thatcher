import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { reviewZoneNav } from '@/ui/review/zone-nav.js';
import { SPACING, renderResolutionBar, renderEmptyState } from '@/ui/spacing-system.js';

function sectionCard(section, highlights) {
  const resolved = highlights.filter(h => h.status === 'resolved').length;
  const partial = highlights.filter(h => h.status === 'partial_resolved').length;
  const total = highlights.length;

  const highlightRows = highlights.map(h => `<div style="display:flex;align-items:center;gap:${SPACING.sm};padding:${SPACING.xs} 0;border-bottom:1px solid var(--color-border)">
    <span class="${h.status === 'resolved' ? 'pill pill-success' : h.status === 'partial_resolved' ? 'pill pill-warning' : 'pill pill-danger'}">${(h.status || 'unresolved').replace(/_/g, ' ')}</span>
    <span style="font-size:13px">${esc(h.text || h.note || 'Highlight')}</span>
  </div>`).join('');

  return `<div class="card-clean" style="margin-bottom:${SPACING.md}" id="section-${esc(section.id)}"><div class="card-clean-body">
      <div class="card-header">${esc(section.name || section.title || 'Untitled section')}</div>
      ${renderResolutionBar(resolved, partial, total)}
      <div style="margin-top:${SPACING.sm}">${highlightRows || '<div style="color:var(--color-text-muted);font-size:13px">No highlights in this section</div>'}</div>
    </div></div>`;
}

export function renderSectionResolution(user, review = {}, sections = [], highlightsBySection = {}) {
  const cards = sections.map(s => sectionCard(s, highlightsBySection[s.id] || [])).join('');

  const content = `<div class="page-header">
      <div>
        <h1 class="page-title">${esc(review.name || review.title || 'Review')} — Resolution</h1>
        <p class="page-subtitle">${sections.length} section${sections.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
    ${reviewZoneNav(esc(review.id || ''), 'resolution')}
    ${cards || renderEmptyState('No sections found for this review')}`;

  return page(user, `${review.name || review.title || 'Review'} resolution | Thatcher`, [
    { label: 'Reviews', href: '/review' },
    { label: review.name || review.title || 'Review', href: `/review/${esc(review.id || '')}` },
    { label: 'Resolution', href: `/review/${esc(review.id || '')}/resolution` },
  ], content);
}
