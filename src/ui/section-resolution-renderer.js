import { page } from '@/ui/layout.js';
import { canEdit } from '@/ui/permissions-ui.js';
import { reviewZoneNav } from '@/ui/review-zone-nav.js';
import { esc } from '@/ui/render-helpers.js';
import { SPACING, renderPageHeader, renderButton, renderResolutionBar, renderEmptyState } from '@/ui/spacing-system.js';

const RESOLUTION_STATES = {
  unresolved: { label: 'Unresolved', color: '#ef4444', icon: '&#9679;' },
  partial_resolved: { label: 'Partial', color: '#f59e0b', icon: '&#9684;' },
  manager_resolved: { label: 'Manager', color: '#3b82f6', icon: '&#9670;' },
  partner_resolved: { label: 'Partner', color: '#8b5cf6', icon: '&#9671;' },
  resolved: { label: 'Resolved', color: '#22c55e', icon: '&#10003;' },
};

function sectionCard(section, highlights, canResolve) {
  const total = highlights.length;
  const resolved = highlights.filter(h => h.status === 'resolved').length;
  const partial = highlights.filter(h => h.status === 'partial_resolved').length;
  const managerResolved = highlights.filter(h => h.status === 'manager_resolved').length;
  const partnerResolved = highlights.filter(h => h.status === 'partner_resolved').length;
  const isMandatory = section.mandatory || section.is_mandatory;
  const allResolved = resolved === total && total > 0;

  const cardClass = allResolved ? 'section-card section-card-complete' : isMandatory ? 'section-card section-card-mandatory' : 'section-card section-card-default';

  const roleBreakdown = total > 0 ? `<div class="role-breakdown">
    <div class="role-breakdown-item"><span class="role-breakdown-dot" style="background:#3b82f6"></span>Manager: ${managerResolved}</div>
    <div class="role-breakdown-item"><span class="role-breakdown-dot" style="background:#8b5cf6"></span>Partner: ${partnerResolved}</div>
  </div>` : '';

  const highlightRows = highlights.map(h => {
    const color = RESOLUTION_STATES[h.status]?.color || '#ef4444';
    const icon = RESOLUTION_STATES[h.status]?.icon || '&#9675;';
    const text = esc((h.text || h.content || 'Highlight').substring(0, 60));
    const truncated = (h.text || h.content || '').length > 60 ? '...' : '';
    return `<div class="section-highlight-row" data-highlight-id="${h.id}">
      <span class="section-highlight-status" style="color:${color}">${icon}</span>
      <span class="section-highlight-text" title="${esc(h.text || h.content || 'Highlight')}">${text}${truncated}</span>
      <span class="section-highlight-page">p.${h.page_number || '?'}</span>
    </div>`;
  }).join('');

  const resolveBtn = canResolve && !allResolved
    ? `<div class="section-card-actions"><button class="btn-primary-clean" style="width:100%;justify-content:center;padding:8px" data-action="resolveSection" data-args='["${section.id}"]'>Resolve All in Section</button></div>`
    : '';

  return `<div class="${cardClass}" data-section-id="${section.id}" data-section-complete="${allResolved}">
    <div class="section-card-header" data-action="toggleSection" data-args='["${section.id}"]'>
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="section-card-name">${esc(section.name || 'Unnamed Section')}</span>
          ${isMandatory ? '<span class="tag-required">REQUIRED</span>' : ''}
        </div>
        <div class="section-card-count">${total} highlight${total !== 1 ? 's' : ''}</div>
      </div>
      <button style="background:none;border:none;font-size:16px;color:var(--color-text-light);cursor:pointer;padding:4px" aria-label="Toggle section">&#9660;</button>
    </div>
    <div class="section-card-body" id="section-body-${section.id}">
      ${renderResolutionBar(resolved, partial, total)}
      ${roleBreakdown}
      <div style="margin-top:${SPACING.md}">
        ${highlightRows || `<div style="font-size:13px;color:var(--color-text-light);font-style:italic;padding:8px 0">No highlights in this section</div>`}
      </div>
    </div>
    ${resolveBtn}
  </div>`;
}

export function renderSectionResolution(user, review, sections, highlightsBySection) {
  const canResolve = canEdit(user, 'review');
  const allHighlights = Object.values(highlightsBySection).flat();
  const totalHighlights = allHighlights.length;
  const totalResolved = allHighlights.filter(h => h.status === 'resolved').length;
  const totalPartial = allHighlights.filter(h => h.status === 'partial_resolved').length;
  const mandatorySections = sections.filter(s => s.mandatory || s.is_mandatory);
  const mandatoryComplete = mandatorySections.every(s => {
    const hs = highlightsBySection[s.id] || [];
    return hs.length === 0 || hs.every(h => h.status === 'resolved');
  });

  const overallPct = totalHighlights > 0 ? Math.round((totalResolved / totalHighlights) * 100) : 0;
  const pctClass = overallPct === 100 ? 'summary-card-pct-success' : overallPct > 50 ? 'summary-card-pct-warning' : 'summary-card-pct-danger';

  const summaryCard = `<div class="summary-card" style="border-left:4px solid ${overallPct === 100 ? 'var(--color-success)' : overallPct > 50 ? 'var(--color-warning)' : 'var(--color-danger)'}">
    <div class="summary-card-row">
      <div>
        <div style="font-size:15px;font-weight:600;color:var(--color-text)">Overall Resolution</div>
        <div style="font-size:13px;color:var(--color-text-muted);margin-top:4px">${totalResolved} of ${totalHighlights} highlights resolved</div>
      </div>
      <div class="summary-card-pct ${pctClass}">${overallPct}%</div>
    </div>
    ${renderResolutionBar(totalResolved, totalPartial, totalHighlights)}
    ${!mandatoryComplete
      ? `<div class="summary-card-alert summary-card-alert-danger">Mandatory sections have unresolved highlights. Status changes may be blocked until completed.</div>`
      : `<div class="summary-card-alert summary-card-alert-success">All mandatory sections are complete</div>`}
  </div>`;

  const sectionCards = sections.map(s => {
    const hs = highlightsBySection[s.id] || [];
    return sectionCard(s, hs, canResolve);
  }).join('');

  const pageHeader = renderPageHeader(
    'Section Resolution',
    'Track and resolve highlights by section',
    `${renderButton('Back to Review', { variant: 'ghost', size: 'sm', href: `/review/${review.id}` })}
     ${canResolve ? renderButton('Resolve All Sections', { variant: 'primary', size: 'sm', action: 'resolveAll' }) : ''}`
  );

  const sectionFilter = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${SPACING.md}">
    <span style="font-size:14px;font-weight:600;color:var(--color-text)">Sections (${sections.length})</span>
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--color-text-muted);cursor:pointer">
      <input type="checkbox" id="hide-complete" onchange="toggleComplete()"/>
      Hide completed sections
    </label>
  </div>`;

  const content = `
    ${pageHeader}
    ${summaryCard}
    ${sectionFilter}
    ${sectionCards || renderEmptyState('No sections defined for this review')}`;

  const sectionScript = `
    window.showToast=window.showToast||function(m,t){alert(m)};
    window.toggleSection=function(id){
      const body=document.getElementById('section-body-'+id);
      if(!body)return;
      const isHidden=body.style.display==='none';
      body.style.display=isHidden?'':'none';
    };
    window.toggleComplete=function(){
      const hide=document.getElementById('hide-complete')?.checked;
      document.querySelectorAll('[data-section-complete="true"]').forEach(c=>{c.style.display=hide?'none':''});
    };
    window.resolveSection=async function(id){
      if(!confirm('Resolve all highlights in this section?'))return;
      try{
        const res=await fetch('/api/mwr/review/section/'+id+'/resolve-all',{method:'POST'});
        if(res.ok){showToast('Section resolved','success');setTimeout(()=>location.reload(),300)}
        else{alert('Failed to resolve section')}
      }catch(e){alert('Error: '+e.message)}
    };
    window.resolveAll=async function(){
      if(!confirm('Resolve ALL highlights in ALL sections? This cannot be undone.'))return;
      try{
        const res=await fetch('/api/mwr/review/${review.id}/resolve-all',{method:'POST'});
        if(res.ok){showToast('All highlights resolved','success');setTimeout(()=>location.reload(),300)}
        else{alert('Failed to resolve all')}
      }catch(e){alert('Error: '+e.message)}
    };`;

  const bc = [{ href: '/', label: 'Home' }, { href: '/review', label: 'Reviews' }, { href: `/review/${review.id}`, label: review.name || 'Review' }, { label: 'Resolution' }];
  return page(user, `${review.name || 'Review'} | Resolution`, bc, reviewZoneNav(review.id, 'resolution') + content, [sectionScript]);
}
