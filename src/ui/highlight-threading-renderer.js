import { page } from '@/ui/layout.js';
import { canEdit } from '@/ui/permissions-ui.js';
import { reviewZoneNav } from '@/ui/review-zone-nav.js';
import { esc } from '@/ui/render-helpers.js';
import { SPACING, renderStatsRow, renderPageHeader, renderButton, renderEmptyState } from '@/ui/spacing-system.js';

function fmtDate(ts) {
  if (!ts) return '';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleString();
  return String(ts);
}

const RESOLUTION_STATES = {
  unresolved: { label: 'Unresolved', color: 'var(--color-danger,#ef4444)', pill: 'pill pill-danger' },
  partial_resolved: { label: 'Partial', color: 'var(--color-warning,#f59e0b)', pill: 'pill pill-warning' },
  manager_resolved: { label: 'Manager', color: 'var(--color-info,#3b82f6)', pill: 'pill pill-info' },
  partner_resolved: { label: 'Partner', color: 'var(--color-primary,#8b5cf6)', pill: 'pill pill-primary' },
  resolved: { label: 'Resolved', color: 'var(--color-success,#22c55e)', pill: 'pill pill-success' },
};

function resolutionBadge(status) {
  const s = RESOLUTION_STATES[status] || RESOLUTION_STATES.unresolved;
  return `<span class="${s.pill}">${s.label}</span>`;
}

function responseItem(response) {
  const name = response.user?.name || response.user_name || 'Unknown';
  const initial = name.charAt(0).toUpperCase();
  const date = fmtDate(response.created_at);
  return `<div class="response-item">
    <div class="response-avatar">${initial}</div>
    <div class="response-content">
      <div class="response-meta">
        <span class="response-name">${esc(name)}</span>
        <span class="response-date">${date}</span>
      </div>
      <div class="response-text">${esc(response.text || response.content || '')}</div>
      ${response.attachment ? `<div class="response-attachment">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
        <a href="${response.attachment.url || '#'}" target="_blank" rel="noopener">${esc(response.attachment.name || 'Attachment')}</a>
      </div>` : ''}
    </div>
  </div>`;
}

function highlightThread(highlight, responses, canResolve, idx) {
  const status = highlight.status || 'unresolved';
  const badge = resolutionBadge(status);
  const color = RESOLUTION_STATES[status]?.color || 'var(--color-danger,#ef4444)';

  const threadItems = responses.map(r => responseItem(r)).join('');
  const sectionTag = highlight.section_name ? `<span class="review-meta-tag">${esc(highlight.section_name)}</span>` : '';

  const resolveSelect = canResolve ? `<div class="thread-card-actions">
    <label style="font-size:12px;color:var(--color-text-muted)">Mark as:</label>
    <select id="resolve-status-${highlight.id}" class="form-input" style="width:auto;padding:${SPACING.xs} ${SPACING.sm};font-size:13px;min-height:auto" aria-label="Resolution status" onchange="updateResolution('${highlight.id}')">
      <option value="unresolved" ${status === 'unresolved' ? 'selected' : ''}>Unresolved</option>
      <option value="partial_resolved" ${status === 'partial_resolved' ? 'selected' : ''}>Partial</option>
      <option value="manager_resolved" ${status === 'manager_resolved' ? 'selected' : ''}>Manager</option>
      <option value="partner_resolved" ${status === 'partner_resolved' ? 'selected' : ''}>Partner</option>
      <option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Resolved</option>
    </select>
  </div>` : '';

  const replyForm = `<div class="thread-reply">
    <textarea id="reply-${highlight.id}" class="form-input" style="resize:vertical;min-height:60px" rows="2" placeholder="Add a response..."></textarea>
    <button class="btn-primary-clean" style="align-self:flex-start;padding:${SPACING.sm} ${SPACING.md}" data-action="submitResponse" data-args='["${highlight.id}"]'>Reply</button>
  </div>`;

  return `<div class="thread-card" id="thread-${highlight.id}" data-thread-status="${status}">
    <div class="thread-card-header">
      <div class="thread-card-meta">
        <span class="thread-card-idx" style="background:${color}">${idx + 1}</span>
        <span class="thread-card-text">${esc(highlight.text || highlight.content || 'Area highlight')}</span>
        ${sectionTag}
      </div>
      ${badge}
    </div>
    <div class="thread-card-page">Page ${highlight.page_number || '?'}</div>
    <div class="thread-card-body">
      ${threadItems || `<div class="thread-card-empty">No responses yet. Be the first to reply.</div>`}
    </div>
    ${resolveSelect}
    ${replyForm}
  </div>`;
}

export function renderHighlightThreading(user, review, highlights, responseMap) {
  const canResolve = canEdit(user, 'review');
  const indexed = highlights.map((h, i) => ({ ...h, _index: i }));

  const stats = {
    total: highlights.length,
    resolved: highlights.filter(h => h.status === 'resolved').length,
    partial: highlights.filter(h => h.status === 'partial_resolved').length,
    open: highlights.filter(h => !h.status || h.status === 'unresolved').length,
  };

  const statsHtml = renderStatsRow([
    { value: stats.total, label: 'Total' },
    { value: stats.open, label: 'Open', color: 'var(--color-danger)' },
    { value: stats.partial, label: 'Partial', color: 'var(--color-warning)' },
    { value: stats.resolved, label: 'Resolved', color: 'var(--color-success)' },
  ]);

  const filterBar = `<div class="review-filter-bar">
    <button class="pill pill-primary" data-thread-filter="all" data-action="filterThreads" data-args='["all"]'>All (${stats.total})</button>
    <button class="pill pill-neutral" data-thread-filter="open" data-action="filterThreads" data-args='["open"]'>Open (${stats.open})</button>
    <button class="pill pill-neutral" data-thread-filter="resolved" data-action="filterThreads" data-args='["resolved"]'>Resolved (${stats.resolved})</button>
  </div>`;

  const threads = indexed.map(h => {
    const responses = responseMap?.[h.id] || [];
    return highlightThread(h, responses, canResolve, h._index);
  }).join('');

  const pageHeader = renderPageHeader(
    'Highlight Discussions',
    `${review.name || 'Review'}`,
    `${renderButton('Back to Review', { variant: 'ghost', size: 'sm', href: `/review/${review.id}` })}
     ${canResolve ? renderButton('Resolve All', { variant: 'primary', size: 'sm', action: "bulkResolve" }) : ''}`
  );

  const content = `
    ${pageHeader}
    ${statsHtml}
    ${filterBar}
    <div id="threads-container">
      ${threads || renderEmptyState('No highlights to discuss. Add highlights from the PDF viewer.')}
    </div>`;

  const threadScript = `
    if(!window.showToast)window.showToast=function(m,t){var c=document.getElementById('toast-container');if(!c){c=document.createElement('div');c.id='toast-container';c.className='toast-container';c.setAttribute('role','status');c.setAttribute('aria-live','polite');c.setAttribute('aria-atomic','true');document.body.appendChild(c)}var d=document.createElement('div');d.className='toast toast-'+(t||'info');d.textContent=m;c.appendChild(d);setTimeout(function(){d.style.opacity='0';setTimeout(function(){d.remove()},300)},3000)};
    window.filterThreads=function(f){
      document.querySelectorAll('[data-thread-filter]').forEach(b=>{
        b.className=b.dataset.threadFilter===f?'pill pill-primary':'pill pill-neutral';
      });
      document.querySelectorAll('#threads-container>.thread-card').forEach(c=>{
        const status=c.dataset.threadStatus;
        const isResolved=status==='resolved';
        if(f==='all')c.style.display='';
        else if(f==='resolved')c.style.display=isResolved?'':'none';
        else c.style.display=isResolved?'none':'';
      });
    };
    window.submitResponse=async function(hid){
      const ta=document.getElementById('reply-'+hid);
      if(!ta||!ta.value.trim()){showToast('Please enter a response','error');return}
      try{
        const res=await fetch('/api/mwr/review/highlight/'+hid+'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:ta.value.trim()})});
        if(res.ok){ta.value='';showToast('Response submitted','success');setTimeout(()=>location.reload(),500)}
        else{const err=await res.json().then(d=>d.error||d.message||'Failed').catch(()=>'Failed');showToast('Error: '+err,'error')}
      }catch(e){showToast('Error: '+e.message,'error')}
    };
    window.updateResolution=async function(hid){
      const sel=document.getElementById('resolve-status-'+hid);
      if(!sel)return;
      try{
        const res=await fetch('/api/mwr/review/highlight/'+hid,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:sel.value})});
        if(res.ok){showToast('Status updated','success');setTimeout(()=>location.reload(),500)}
        else{showToast('Failed to update','error')}
      }catch(e){showToast('Error: '+e.message,'error')}
    };
    window.bulkResolve=async function(){
      if(!(await window.gmConfirm({title:'Please confirm',message:'Resolve all highlights in this review?',danger:false,confirmLabel:'OK'})))return;
      try{
        const res=await fetch('/api/mwr/review/${review.id}?action=resolve-all',{method:'POST'});
        if(res.ok){showToast('All highlights resolved','success');setTimeout(()=>location.reload(),500)}
        else{showToast('Failed to resolve all','error')}
      }catch(e){showToast('Error: '+e.message,'error')}
    };`;

  const bc = [{ href: '/', label: 'Home' }, { href: '/review', label: 'Reviews' }, { href: `/review/${review.id}`, label: review.name || 'Review' }, { label: 'Highlights' }];
  return page(user, `${review.name || 'Review'} | Highlights`, bc, reviewZoneNav(review.id, 'highlights') + content, [threadScript]);
}
