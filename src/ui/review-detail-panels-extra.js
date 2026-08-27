import { esc, statusPill } from '@/ui/render-helpers.js';

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  return String(ts);
}

// tablePanel is the caller's own closure (defined in review/detail-renderer.js)
// that wires up the shared .rv-panel tab shell -- passed in rather than
// imported to avoid a circular dependency between this file and that one.
export function tenderPanelHtml(reviewId, tenders = [], canEdit, tablePanel) {
  const rows = tenders.map(t => `<tr>
    <td><strong>${esc(t.name || t.title || 'Untitled tender')}</strong></td>
    <td>${statusPill(t.status)}</td>
    <td style="font-size:13px">${fmtDate(t.deadline)}</td>
    <td style="text-align:right">${canEdit ? `<button data-action="openDialog" data-args='["tender-dialog"]' class="btn-ghost-clean" style="font-size:12px;padding:4px 10px;min-height:28px">Edit</button>` : ''}</td>
  </tr>`).join('');

  const extraBtn = canEdit ? `<button data-action="openDialog" data-args='["tender-dialog"]' class="btn-primary-clean" style="font-size:13px;padding:6px 14px">+ Add Tender</button>` : '';

  return tablePanel('tender', 'Tender', tenders.length, extraBtn, ['Name', 'Status', 'Deadline', ''], rows, 'No tenders linked to this review');
}

export function tenderDialog(reviewId) {
  return `<div id="tender-dialog" class="dialog-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="tender-dialog-title" data-dialog-close="tender-dialog">
    <div class="dialog-panel" style="max-width:420px;width:100%">
      <h3 id="tender-dialog-title" style="font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 16px">Add Tender</h3>
      <div class="form-field" style="margin-bottom:12px">
        <label class="form-label">Name</label>
        <input type="text" id="tender-name" class="form-input" placeholder="Tender name"/>
      </div>
      <div class="form-field" style="margin-bottom:16px">
        <label class="form-label">Deadline</label>
        <input type="date" id="tender-deadline" class="form-input"/>
      </div>
      <div class="form-actions" style="padding-top:0;margin-top:0">
        <button data-dialog-close="tender-dialog" class="btn-ghost-clean" style="font-size:13px;padding:8px 16px">Cancel</button>
        <button data-action="saveTender" data-args='["${esc(reviewId)}"]' class="btn-primary-clean" style="font-size:13px;padding:8px 16px">Save</button>
      </div>
    </div>
  </div>
  <script>
  window.saveTender=async function(reviewId){var name=document.getElementById('tender-name').value.trim();if(!name){showToast('Name required','error');return}var dateVal=document.getElementById('tender-deadline').value;var deadline=dateVal?Math.floor(new Date(dateVal).getTime()/1000):null;try{var r=await fetch('/api/tender',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({review_id:reviewId,name:name,deadline:deadline})});if(r.ok){showToast('Tender added','success');document.getElementById('tender-dialog').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function linksPanelHtml(reviewId, links = [], canEdit, tablePanel) {
  const rows = links.map((l, i) => `<tr>
    <td><a href="${esc(l.url || l.href || '#')}" target="_blank" rel="noopener">${esc(l.label || l.name || l.url || 'Link')}</a></td>
    <td style="text-align:right">${canEdit ? `<button data-action="removeLink" data-args='["${esc(reviewId)}",${i}]' class="btn-danger-clean" style="font-size:12px;padding:4px 10px;min-height:28px">Remove</button>` : ''}</td>
  </tr>`).join('');

  const extraBtn = canEdit ? `<button data-action="openDialog" data-args='["link-dialog"]' class="btn-primary-clean" style="font-size:13px;padding:6px 14px">+ Add Link</button>` : '';

  return tablePanel('links', 'Links', links.length, extraBtn, ['Link', ''], rows, 'No links added to this review');
}

export function linkDialog(reviewId) {
  return `<div id="link-dialog" class="dialog-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="link-dialog-title" data-dialog-close="link-dialog">
    <div class="dialog-panel" style="max-width:420px;width:100%">
      <h3 id="link-dialog-title" style="font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 16px">Add Link</h3>
      <div class="form-field" style="margin-bottom:12px">
        <label class="form-label">Label</label>
        <input type="text" id="link-label" class="form-input" placeholder="Link label"/>
      </div>
      <div class="form-field" style="margin-bottom:16px">
        <label class="form-label">URL</label>
        <input type="url" id="link-url" class="form-input" placeholder="https://..."/>
      </div>
      <div class="form-actions" style="padding-top:0;margin-top:0">
        <button data-dialog-close="link-dialog" class="btn-ghost-clean" style="font-size:13px;padding:8px 16px">Cancel</button>
        <button data-action="saveLink" data-args='["${esc(reviewId)}"]' class="btn-primary-clean" style="font-size:13px;padding:8px 16px">Save</button>
      </div>
    </div>
  </div>
  <script>
  window.saveLink=async function(reviewId){var label=document.getElementById('link-label').value.trim();var url=document.getElementById('link-url').value.trim();if(!url){showToast('URL required','error');return}try{var r=await fetch('/api/review/'+reviewId,{credentials:'same-origin'});var d=await r.json();var review=d.data||d;var links=[];try{links=JSON.parse(review.links||'[]')||[]}catch(e){}links.push({label:label,url:url});var r2=await fetch('/api/review/'+reviewId,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({links:JSON.stringify(links)})});if(r2.ok){showToast('Link added','success');document.getElementById('link-dialog').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  window.removeLink=async function(reviewId,idx){try{var r=await fetch('/api/review/'+reviewId,{credentials:'same-origin'});var d=await r.json();var review=d.data||d;var links=[];try{links=JSON.parse(review.links||'[]')||[]}catch(e){}links.splice(idx,1);var r2=await fetch('/api/review/'+reviewId,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({links:JSON.stringify(links)})});if(r2.ok){showToast('Link removed','success');location.reload()}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function sectionsPanelHtml(reviewId, sections = [], SPACING, renderTable, renderButton) {
  const rows = sections.map(s => `<tr>
    <td><strong>${esc(s.name || s.title || 'Untitled section')}</strong></td>
    <td style="font-size:13px;color:var(--color-text-muted)">${s.status ? esc(s.status) : '-'}</td>
    <td style="text-align:right">${renderButton('Resolve', { variant: 'ghost', size: 'sm', href: `/review/${esc(reviewId)}/resolution` })}</td>
  </tr>`).join('');

  const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md}">
    <span style="font-size:15px;font-weight:600;color:var(--color-text)">Sections</span>
    <span style="font-size:13px;color:var(--color-text-muted)">${sections.length} section${sections.length !== 1 ? 's' : ''}</span>
  </div>`;

  return `<div id="rvpanel-sections" class="rv-panel" style="display:none">${header}${renderTable(['Name', 'Status', ''],
    rows || `<tr><td colspan="3" style="text-align:center;padding:${SPACING.xl} 0;color:var(--color-text-muted)">No sections found for this review</td></tr>`,
    SPACING.md)}</div>`;
}

export function compareDialogHtml(reviewId) {
  return `<div id="pdf-compare-dialog" class="dialog-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="pdf-compare-dialog-title" data-dialog-close="pdf-compare-dialog">
    <div class="dialog-panel" style="max-width:420px;width:100%">
      <h3 id="pdf-compare-dialog-title" style="font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 16px">Compare Review</h3>
      <div class="form-field" style="margin-bottom:16px">
        <label class="form-label">Compare against</label>
        <select id="compare-target" class="form-input"><option value="">Loading reviews...</option></select>
      </div>
      <div class="form-actions" style="padding-top:0;margin-top:0">
        <button data-dialog-close="pdf-compare-dialog" class="btn-ghost-clean" style="font-size:13px;padding:8px 16px">Cancel</button>
        <button data-action="goCompare" data-args='["${esc(reviewId)}"]' class="btn-primary-clean" style="font-size:13px;padding:8px 16px">Compare</button>
      </div>
    </div>
  </div>
  <script>
  (function(){var loaded=false;
  document.addEventListener('click',function(e){if(e.target&&e.target.dataset&&e.target.dataset.action==='openDialog'&&e.target.dataset.args==='["pdf-compare-dialog"]'&&!loaded){loaded=true;fetch('/api/review',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('compare-target');var items=(d.data||d||[]).filter(function(r){return r.id!=='${esc(reviewId)}'});sel.innerHTML=items.length?items.map(function(r){return '<option value="'+r.id+'">'+(r.name||r.title||r.id)+'</option>'}).join(''):'<option value="">No other reviews found</option>'}).catch(function(){var sel=document.getElementById('compare-target');if(sel)sel.innerHTML='<option value="">Failed to load</option>'})}});
  window.goCompare=function(reviewId){var target=document.getElementById('compare-target').value;if(!target){showToast('Pick a review to compare','error');return}window.location='/reviews/compare?left='+reviewId+'&right='+target};
  })();
  </script>`;
}
