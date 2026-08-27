import { page } from '@/ui/layout.js';
import { esc, statusPill, TABLE_SCRIPT } from '@/ui/render-helpers.js';
import { SPACING, renderPageHeader } from '@/ui/spacing-system.js';

export function renderBatchOperations(user, reviews = []) {
  const rows = reviews.map(r => `<tr data-row>
    <td><input type="checkbox" class="batch-select" value="${esc(r.id)}" aria-label="Select ${esc(r.name || r.title || 'review')}"></td>
    <td><a href="/review/${esc(r.id)}">${esc(r.name || r.title || 'Untitled review')}</a></td>
    <td>${statusPill(r.status)}</td>
    <td>${esc(r.engagement_id_display || r.engagement_id || '-')}</td>
  </tr>`).join('');

  const content = `${renderPageHeader('Batch review operations', `${reviews.length} review${reviews.length !== 1 ? 's' : ''}`)}
    <div class="table-toolbar" style="margin-bottom:${SPACING.md}">
      <button type="button" class="btn-primary-clean" data-action="batchArchiveSelected">Archive selected</button>
      <button type="button" class="btn-ghost-clean" data-action="batchExportSelected">Export selected</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th></th><th>Name</th><th>Status</th><th>Engagement</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="table-empty-row">No reviews found</td></tr>`}</tbody>
      </table>
    </div>`;

  const script = `(function(){
    window.batchArchiveSelected=function(){var ids=[].slice.call(document.querySelectorAll('.batch-select:checked')).map(function(c){return c.value});if(!ids.length){window.showToast&&window.showToast('No reviews selected','warning');return}Promise.all(ids.map(function(id){return fetch('/api/review/'+id,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'archived'})})})).then(function(){window.location.reload()})};
    window.batchExportSelected=function(){var ids=[].slice.call(document.querySelectorAll('.batch-select:checked')).map(function(c){return c.value});if(!ids.length){window.showToast&&window.showToast('No reviews selected','warning');return}window.location.href='/api/review/export?ids='+ids.join(',')};
  })();`;

  return page(user, 'Batch review operations | Thatcher', [{ label: 'Reviews', href: '/review' }, { label: 'Batch operations', href: '/reviews/batch' }], content, [TABLE_SCRIPT, script]);
}
