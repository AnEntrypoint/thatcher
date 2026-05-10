import { page } from '@/ui/layout.js';
import { esc, TOAST_SCRIPT } from '@/ui/render-helpers.js';
import { reviewZoneNav } from '@/ui/review-zone-nav.js';
import { SPACING, renderButton, renderPageHeader } from '@/ui/spacing-system.js';

export function renderReviewEdit(user, review, engagements = [], teams = []) {
  const r = review || {};
  const id = esc(r.id || '');
  const bc = [{ href: '/', label: 'Home' }, { href: '/review', label: 'Reviews' }, { href: `/review/${id}`, label: r.name || 'Review' }, { label: 'Edit' }];

  const statusOptions = ['active', 'open', 'in_progress', 'completed', 'closed', 'archived'].map(s =>
    `<option value="${s}"${r.status === s ? ' selected' : ''}>${s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>`
  ).join('');

  const typeOptions = ['standard', 'tender'].map(t =>
    `<option value="${t}"${(r.review_type || r.type) === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
  ).join('');

  const priorityOptions = ['normal', 'high', 'critical'].map(p =>
    `<option value="${p}"${r.priority_level === p ? ' selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`
  ).join('');

  const engOptions = engagements.map(e =>
    `<option value="${esc(e.id)}"${r.engagement_id === e.id ? ' selected' : ''}>${esc(e.name || e.id)}</option>`
  ).join('');

  const teamOptions = `<option value="">None</option>` + teams.map(t =>
    `<option value="${esc(t.id)}"${r.team_id === t.id ? ' selected' : ''}>${esc(t.name || t.id)}</option>`
  ).join('');

  const deadlineVal = r.deadline ? (typeof r.deadline === 'number' ? new Date(r.deadline * 1000).toISOString().slice(0, 10) : String(r.deadline).slice(0, 10)) : '';

  const pageHeader = renderPageHeader(
    'Edit Review',
    esc(r.name || ''),
    renderButton('Back to Review', { variant: 'ghost', size: 'sm', href: `/review/${id}` })
  );

  const formContent = `<form id="review-edit-form" class="form-grid" novalidate>
    <div class="form-field">
      <label class="form-label">Review Name <span class="req">*</span></label>
      <input type="text" name="name" class="form-input" value="${esc(r.name || r.title || '')}" required placeholder="Enter review name"/>
    </div>
    ${engOptions ? `<div class="form-field">
      <label class="form-label">Engagement</label>
      <select name="engagement_id" class="form-input"><option value="">-- None --</option>${engOptions}</select>
    </div>` : ''}
    <div class="form-field">
      <label class="form-label">Status</label>
      <select name="status" class="form-input">${statusOptions}</select>
    </div>
    <div class="form-field">
      <label class="form-label">Review Type</label>
      <select name="review_type" class="form-input">${typeOptions}</select>
    </div>
    <div class="form-field">
      <label class="form-label">Priority</label>
      <select name="priority_level" class="form-input">${priorityOptions}</select>
    </div>
    <div class="form-field">
      <label class="form-label">Financial Year</label>
      <input type="text" name="financial_year" class="form-input" value="${esc(r.financial_year || '')}" placeholder="e.g. 2024"/>
    </div>
    <div class="form-field">
      <label class="form-label">Deadline</label>
      <input type="date" name="deadline" class="form-input" value="${esc(deadlineVal)}"/>
    </div>
    <div class="form-field">
      <label class="form-label">WIP Value</label>
      <input type="number" name="wip_value" class="form-input" value="${r.wip_value || ''}" step="0.01" placeholder="0.00"/>
    </div>
    ${teamOptions.length > '<option value="">None</option>'.length ? `<div class="form-field">
      <label class="form-label">Team</label>
      <select name="team_id" class="form-input">${teamOptions}</select>
    </div>` : ''}
    <div class="form-field full">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" name="is_private"${r.is_private ? ' checked' : ''}/>
        <span class="form-label" style="margin:0">Private Review</span>
      </label>
    </div>
    <div class="form-field full">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" name="archived"${r.archived ? ' checked' : ''}/>
        <span class="form-label" style="margin:0">Archived</span>
      </label>
    </div>
    <div class="form-actions full" style="border-top:1px solid var(--color-border);padding-top:${SPACING.md};margin-top:${SPACING.sm}">
      <button type="button" data-action="deleteReview" data-args='["${id}"]' class="btn-danger-clean" style="margin-right:auto">Delete Review</button>
      <a href="/review/${id}" class="btn-ghost-clean">Cancel</a>
      <button type="submit" id="save-btn" class="btn-primary-clean">
        <span class="btn-text">Save Changes</span>
        <span class="btn-loading-text" style="display:none">Saving...</span>
      </button>
    </div>
  </form>`;

  const content = `
    ${pageHeader}
    ${reviewZoneNav(r.id, 'overview')}
    <div class="form-shell">
      <div class="form-section">
        <div class="form-section-title">Review Information</div>
        ${formContent}
      </div>
    </div>`;

  const script = `${TOAST_SCRIPT}
const form=document.getElementById('review-edit-form');
const sb=document.getElementById('save-btn');
form.addEventListener('submit',async e=>{
  e.preventDefault();
  sb.disabled=true;
  sb.querySelector('.btn-text').style.display='none';
  sb.querySelector('.btn-loading-text').style.display='inline';
  const fd=new FormData(form);
  const data={};
  for(const[k,v]of fd.entries())data[k]=v;
  form.querySelectorAll('input[type=checkbox]').forEach(cb=>{data[cb.name]=cb.checked});
  form.querySelectorAll('input[type=number]').forEach(inp=>{if(inp.name&&data[inp.name]!==undefined&&data[inp.name]!=='')data[inp.name]=Number(data[inp.name])});
  try{
    const res=await fetch('/api/review/${id}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await res.json();
    if(res.ok){showToast('Review updated successfully','success');setTimeout(()=>{window.location='/review/${id}'},600)}
    else{showToast(result.message||result.error||'Save failed','error');sb.disabled=false;sb.querySelector('.btn-text').style.display='inline';sb.querySelector('.btn-loading-text').style.display='none'}
  }catch(err){showToast('Error: '+err.message,'error');sb.disabled=false;sb.querySelector('.btn-text').style.display='inline';sb.querySelector('.btn-loading-text').style.display='none'}
});
window.deleteReview=async function(id){
  if(!confirm('Delete this review? This cannot be undone.'))return;
  try{
    const res=await fetch('/api/review/'+id,{method:'DELETE'});
    if(res.ok){showToast('Review deleted','success');setTimeout(()=>{window.location='/review'},800)}
    else{const r=await res.json();showToast(r.message||'Delete failed','error')}
  }catch(err){showToast('Error: '+err.message,'error')}
};`;

  return page(user, `Edit ${esc(r.name || 'Review')} | Moonlanding`, bc, content, [script]);
}
