import { h } from '@/ui/webjsx.js'
import { statusLabel, TOAST_SCRIPT } from '@/ui/render-helpers.js'
import { teamAvatarGroup } from '@/ui/widgets.js'

export function mobileReviewCard(review) {
  const r = review || {}
  const sts = r.status ? statusLabel(r.status) : ''
  const date = r.created_at ? `<span class="text-xs text-gray-500">${typeof r.created_at === 'number' ? new Date(r.created_at * 1000).toLocaleDateString() : r.created_at}</span>` : ''
  return `<div class="mobile-card mobile-review-card card-clean">
    <div class="card-clean-body">
      <div class="flex justify-between items-center mb-2"><h3 class="font-medium text-sm">${r.name || r.title || 'Untitled Review'}</h3>${sts}</div>
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">${r.engagement_name ? `<span>${r.engagement_name}</span>` : ''}${date}</div>
      ${r.highlights_count !== undefined ? `<div class="text-xs text-gray-500">${r.highlights_count} highlight${r.highlights_count !== 1 ? 's' : ''}</div>` : ''}
      <div class="flex gap-1 mt-2"><a href="/review/${r.id}" class="btn btn-xs btn-primary">View</a><a href="/review/${r.id}/edit" class="btn btn-xs btn-outline">Edit</a></div>
    </div></div>`
}

export function sidebarReviewDetails(review) {
  const r = review || {}
  const sts = r.status ? statusLabel(r.status) : ''
  const meta = [
    r.created_at ? ['Created', typeof r.created_at === 'number' ? new Date(r.created_at * 1000).toLocaleDateString() : r.created_at] : null,
    r.updated_at ? ['Updated', typeof r.updated_at === 'number' ? new Date(r.updated_at * 1000).toLocaleDateString() : r.updated_at] : null,
    r.creator_name ? ['Creator', r.creator_name] : null,
    r.manager_name ? ['Manager', r.manager_name] : null,
  ].filter(Boolean).map(([l, v]) => `<div class="sidebar-meta-row"><span class="text-gray-500 text-xs">${l}</span><span class="text-sm font-medium">${v}</span></div>`).join('')
  const highlights = r.highlights_count !== undefined ? `<div class="sidebar-section"><span class="text-xs text-gray-500">Highlights</span><span class="font-medium">${r.highlights_count}</span></div>` : ''
  const collaborators = r.collaborators?.length ? `<div class="sidebar-section"><span class="text-xs text-gray-500 mb-1">Collaborators</span>${teamAvatarGroup(r.collaborators, 5)}</div>` : ''
  const checklists = r.checklists_total !== undefined ? `<div class="sidebar-section"><span class="text-xs text-gray-500">Checklists</span><span class="font-medium">${r.checklists_completed || 0}/${r.checklists_total}</span></div>` : ''
  return `<aside class="sidebar-review-panel" id="sidebar-review-panel">
    <div class="sidebar-header"><h3 class="font-medium">Review Details</h3><button class="btn btn-ghost btn-xs sidebar-toggle" data-action="toggleSidebar" aria-label="Toggle sidebar">&times;</button></div>
    <div class="sidebar-body">
      <div class="sidebar-section"><h4 class="font-medium text-sm mb-1">${r.name || r.title || 'Untitled Review'}</h4>${sts}</div>
      ${meta ? `<div class="sidebar-section">${meta}</div>` : ''}
      ${highlights}${collaborators}${checklists}
    </div></aside>`
}

export function archiveReviewDialog() {
  return `<div id="archive-review-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="archive-review-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="archive-review-dialog-title">Archive Review</span><button class="dialog-close" data-dialog-close="archive-review-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="archive-ctx">This action will archive the review. Archived reviews are hidden from active lists but can be restored.</div>
        <div class="modal-form-group"><label class="form-label" for="ard-confirm">Type ARCHIVE to confirm</label><input type="text"  id="ard-confirm" class="archive-type-input" placeholder="Type ARCHIVE"/></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="archive-review-dialog">Cancel</button><button class="btn btn-error btn-sm" id="ard-btn" data-action="ardConfirm">Archive</button></div>
    </div></div>
  <script>${TOAST_SCRIPT}
  window._ardId=null;
  window.showArchiveDialog=function(reviewId){window._ardId=reviewId;document.getElementById('archive-review-dialog').style.display='flex';document.getElementById('ard-confirm').value=''};
  window.ardConfirm=async function(){if(document.getElementById('ard-confirm').value!=='ARCHIVE'){showToast('Type ARCHIVE to confirm','error');return}try{var res=await fetch('/api/review/'+window._ardId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'archived'})});if(res.ok){showToast('Review archived','success');document.getElementById('archive-review-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast('Archive failed','error')}}catch(e){showToast('Error','error')}};</script>`
}

export function reviewOpenCloseToggle(reviewId, isOpen) {
  const on = isOpen ? 'rvw-on rvw-green' : ''
  return `<div class="rvw-toggle">
    <div class="rvw-toggle-track ${on}" id="rvw-oc-track" role="switch" tabindex="0" aria-checked="${isOpen}" aria-label="Review open/closed status" data-action="rvwToggleOC" data-args='["${reviewId}"]' onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();rvwToggleOC('${reviewId}')}"><div class="rvw-toggle-knob"></div></div>
    <span class="rvw-toggle-label">${isOpen ? 'Open' : 'Closed'}</span>
  </div>
  <script>${TOAST_SCRIPT}
  window.rvwToggleOC=async function(id){var t=document.getElementById('rvw-oc-track');var isOn=t.classList.contains('rvw-on');var newStatus=isOn?'closed':'open';try{var res=await fetch('/api/review/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:newStatus})});if(res.ok){t.classList.toggle('rvw-on');t.classList.toggle('rvw-green');t.setAttribute('aria-checked',!isOn);t.nextElementSibling.textContent=isOn?'Closed':'Open';showToast('Review '+(isOn?'closed':'opened'),'success')}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};</script>`
}

export function reviewPrivateToggle(reviewId, isPrivate) {
  const on = isPrivate ? 'rvw-on rvw-purple' : ''
  return `<div class="rvw-toggle">
    <div class="rvw-toggle-track ${on}" id="rvw-priv-track" role="switch" tabindex="0" aria-checked="${isPrivate}" aria-label="Review private/public toggle" data-action="rvwTogglePriv" data-args='["${reviewId}"]' onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();rvwTogglePriv('${reviewId}')}"><div class="rvw-toggle-knob"></div></div>
    <span class="rvw-toggle-label"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="${isPrivate ? 'M8 1a4 4 0 014 4v2h1a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1h1V5a4 4 0 014-4zm2 6V5a2 2 0 10-4 0v2h4z' : 'M12 7h1a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1h7V5a2 2 0 10-4 0v1H4V5a4 4 0 018 0v2z'}"/></svg>${isPrivate ? 'Private' : 'Public'}</span>
  </div>
  <script>${TOAST_SCRIPT}
  window.rvwTogglePriv=async function(id){var t=document.getElementById('rvw-priv-track');var isOn=t.classList.contains('rvw-on');try{var res=await fetch('/api/review/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_private:isOn?0:1})});if(res.ok){t.classList.toggle('rvw-on');t.classList.toggle('rvw-purple');showToast(isOn?'Made public':'Made private','success');setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};</script>`
}

export function markAllHighlightsResolved(reviewId, unresolvedCount = 0) {
  return `<div id="bulk-resolve-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="bulk-resolve-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:380px">
      <div class="dialog-header"><span class="dialog-title" id="bulk-resolve-dialog-title">Resolve All Highlights</span><button class="dialog-close" data-dialog-close="bulk-resolve-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="bulk-resolve-count" id="brc-count">${unresolvedCount}</div>
        <div class="bulk-resolve-label">unresolved highlights will be marked as resolved</div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="bulk-resolve-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="bulkResolve" data-args='["${reviewId}"]'>Resolve All</button></div>
    </div></div>
  <script>${TOAST_SCRIPT}
  window.showBulkResolve=function(reviewId,count){document.getElementById('brc-count').textContent=count;document.getElementById('bulk-resolve-dialog').style.display='flex'};
  window.bulkResolve=async function(id){try{var res=await fetch('/api/review/'+id+'/resolve-all',{method:'POST',headers:{'Content-Type':'application/json'}});if(res.ok){showToast('All highlights resolved','success');document.getElementById('bulk-resolve-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{var alt=await fetch('/api/highlight?review_id='+id);var hl=await alt.json();var highlights=(hl.data||hl||[]).filter(function(h){return !h.resolved&&h.status!=='resolved'});var resolved=0;for(var h of highlights){var r2=await fetch('/api/highlight/'+h.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolved:1,status:'resolved'})});if(r2.ok)resolved++}showToast(resolved+' highlights resolved','success');document.getElementById('bulk-resolve-dialog').style.display='none';setTimeout(function(){location.reload()},500)}}catch(e){showToast('Error: '+e.message,'error')}};</script>`
}
