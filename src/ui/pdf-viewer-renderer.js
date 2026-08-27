import { fullPage } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { reviewZoneNav } from '@/ui/review/zone-nav.js';
import { renderEmptyState, SPACING } from '@/ui/spacing-system.js';

// highlights here are pre-flattened by the caller (page-handler-reviews.js):
// each carries x/y/width/height (from bounding_rect) + rects[] + page_number,
// ready for absolute-positioned overlay markup over the rendered PDF page.
export function renderPdfViewer(user, review = {}, highlights = [], sections = []) {
  const pdfUrl = review.file_url || review.pdf_url || (review.id ? `/api/review/${esc(review.id)}/pdf-file` : '');

  const overlays = highlights.map(h => `<div class="pdf-highlight-overlay" data-highlight-id="${esc(h.id)}" data-page="${h.page_number}"
    style="position:absolute;left:${h.x}px;top:${h.y}px;width:${h.width}px;height:${h.height}px;background:rgba(255,214,10,0.35);border:1px solid rgba(255,180,0,0.8);cursor:pointer"
    title="${esc(h.text || h.note || 'Highlight')}"></div>`).join('');

  const sectionList = sections.map(s => `<li><a href="#section-${esc(s.id)}">${esc(s.name || s.title || 'Untitled section')}</a></li>`).join('');

  const content = `<div style="padding:${SPACING.md} var(--page-gutter)">
      ${reviewZoneNav(esc(review.id || ''), 'pdf')}
      <h1 class="page-title" style="margin-bottom:${SPACING.md}">${esc(review.name || review.title || 'Review')} — PDF</h1>
    </div>
    <div style="display:flex;gap:${SPACING.md};padding:0 var(--page-gutter) ${SPACING.lg};align-items:flex-start">
      <aside style="width:220px;flex-shrink:0" class="card-clean"><div class="card-clean-body">
        <div class="card-header">Sections</div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:${SPACING.xs}">${sectionList || '<li style="color:var(--color-text-muted);font-size:13px">No sections</li>'}</ul>
      </div></aside>
      <div style="flex:1;position:relative;min-width:0">
        ${pdfUrl
          ? `<div style="position:relative;border:1px solid var(--color-border);border-radius:var(--radius);overflow:auto;max-height:80vh">
              <iframe src="${esc(pdfUrl)}" title="Review PDF" style="width:100%;height:80vh;border:0;display:block"></iframe>
              <div style="position:absolute;inset:0;pointer-events:none">${overlays}</div>
            </div>`
          : renderEmptyState('No PDF file attached to this review')}
      </div>
    </div>`;

  return fullPage(user, `${review.name || review.title || 'Review'} PDF | Thatcher`, content);
}

export function renderPdfEditorPlaceholder(user, review = {}) {
  const content = `<div style="padding:${SPACING.md} var(--page-gutter)">
      ${reviewZoneNav(esc(review.id || ''), 'pdf')}
      <h1 class="page-title" style="margin-bottom:${SPACING.md}">${esc(review.name || review.title || 'Review')} — Editor</h1>
    </div>
    <div style="padding:0 var(--page-gutter) ${SPACING.lg}">
      <div class="card-clean"><div class="empty-state">
        <div class="empty-state-title">PDF editor not yet available</div>
        <div class="empty-state-desc">Inline PDF editing is not built yet. Use the <a href="/review/${esc(review.id || '')}/pdf">PDF viewer</a> to review and highlight this document instead.</div>
      </div></div>
    </div>`;

  return fullPage(user, `${review.name || review.title || 'Review'} editor | Thatcher`, content);
}
