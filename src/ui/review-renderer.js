import { canCreate } from '@/ui/permissions-ui.js';
import { page } from '@/ui/layout.js';
import { reviewCreateDialog, reviewTemplateChoiceDialog, reviewContextMenu, reviewFlagsDialog, reviewTagsDialog, reviewValueDialog, reviewDeadlineDialog, reviewNotificationDialog } from '@/ui/review-dialogs.js';
import { SPACING, renderButton, renderEmptyState, renderStatsRow, renderPageHeader } from '@/ui/spacing-system.js';

export { reviewCreateDialog, reviewTemplateChoiceDialog, reviewContextMenu, reviewFlagsDialog, reviewTagsDialog, reviewValueDialog, reviewDeadlineDialog, reviewNotificationDialog };
export { renderMwrHome, renderSectionReport } from '@/ui/review-mwr-renderer.js';

const TOAST_SCRIPT = `window.showToast=(m,t='info')=>{let c=document.getElementById('toast-container');if(!c){c=document.createElement('div');c.id='toast-container';c.className='toast-container';c.setAttribute('role','status');c.setAttribute('aria-live','polite');c.setAttribute('aria-atomic','true');document.body.appendChild(c)}const d=document.createElement('div');d.className='toast toast-'+t;d.textContent=m;c.appendChild(d);setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300)},3000)};`;

const TAB_DEFS = [
  { key: 'all', label: 'All', filter: () => true },
  { key: 'active', label: 'Active', filter: r => r.status === 'active' || r.status === 'open' || r.status === 'in_progress' },
  { key: 'priority', label: 'Priority', filter: r => r.is_priority || r.flagged || r.flags_count > 0 },
  { key: 'history', label: 'History', filter: r => r.status === 'completed' || r.status === 'closed' },
  { key: 'archive', label: 'Archive', filter: r => r.status === 'archived' || r.archived === 1 },
];

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString();
  return String(ts);
}

function statusBadge(status) {
  const s = status || 'open';
  const map = { active: 'pill pill-info', open: 'pill pill-info', in_progress: 'pill pill-info', completed: 'pill pill-success', closed: 'pill pill-success', archived: 'pill pill-neutral' };
  const cls = map[s] || 'pill pill-warning';
  return `<span class="${cls}">${s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>`;
}

function reviewRow(r) {
  const isPri = (r.is_priority || r.flagged || (r.flags_count > 0)) ? 1 : 0;
  return `<tr class="review-row" data-status="${r.status || ''}" data-flags="${r.flags_count || 0}" data-highlights="${r.highlights_count || 0}" data-archived="${r.archived || 0}" data-priority="${isPri}" data-stage="${r.stage || r.status || ''}" data-navigate="/review/${r.id}" oncontextmenu="showCtxMenu(event,'${r.id}')" style="cursor:pointer">
    <td style="width:32px"><button class="review-priority-star${isPri?' is-priority':''}" data-action="togglePriority" data-args='["${r.id}"]' aria-label="Toggle priority" onclick="event.stopPropagation()">${isPri?'★':'☆'}</button></td>
    <td class="review-row-name">${r.name || r.title || 'Untitled'}</td>
    <td style="font-size:13px;color:var(--color-text-muted)">${r.engagement_name || r.engagement_id_display || '-'}</td>
    <td>${statusBadge(r.status)}</td>
    <td style="text-align:center;font-size:13px">${r.highlights_count !== undefined ? r.highlights_count : '-'}</td>
    <td style="font-size:13px">${fmtDate(r.deadline)}</td>
    <td style="font-size:13px;color:var(--color-text-light)">${fmtDate(r.created_at)}</td>
  </tr>`;
}

export function renderReviewListTabbed(user, reviews) {
  const counts = {};
  TAB_DEFS.forEach(t => { counts[t.key] = reviews.filter(t.filter).length; });

  const tabBar = `<nav class="tab-bar" style="margin-bottom:${SPACING.lg}">
    ${TAB_DEFS.map(t => `<button class="tab-btn${t.key === 'all' ? ' active' : ''}" data-tab="${t.key}" data-action="switchTab" data-args='["${t.key}"]'>${t.label}<span class="tab-count">${counts[t.key]}</span></button>`).join('')}
  </nav>`;

  const createBtn = canCreate(user, 'review')
    ? renderButton('New Review', { variant: 'primary', size: 'sm', action: 'openDialog', args: ['review-create-dialog'] })
    : '';

  const pageHeader = renderPageHeader(
    'Reviews',
    `${reviews.length} total`,
    `<label for="review-search" class="sr-only">Search reviews</label>
     <input type="text" id="review-search" placeholder="Search reviews..." class="form-input review-search-input" aria-label="Search reviews"/>
     ${createBtn}`
  );

  const reviewRows = reviews.length ? reviews.map(reviewRow).join('') : '';
  const emptyState = reviews.length === 0 ? renderEmptyState(
    `<div style="font-size:32px;margin-bottom:12px;opacity:0.3">&#128196;</div>
     <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
     <div class="empty-state-title">No reviews yet</div>
     <div class="empty-state-desc">Create a new review to start tracking work.</div>`
  ) : '';

  const tableWrap = `<div class="table-wrap">
    <div class="table-toolbar">
      <div class="table-search"></div>
      <span class="table-count" id="row-count">${reviews.length} items</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:32px" aria-label="Priority"></th>
          <th>Name</th>
          <th>Engagement</th>
          <th>Status</th>
          <th style="text-align:center">Highlights</th>
          <th>Deadline</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody id="review-tbody">${reviewRows || `<tr><td colspan="7">${emptyState}</td></tr>`}</tbody>
    </table>
  </div>`;

  const content = `${pageHeader}${tabBar}${tableWrap}${reviewContextMenu()}`;
  const bc = [{ href: '/', label: 'Dashboard' }, { href: '/review', label: 'Reviews' }];

  const tabScript = `window.switchTab=function(key){
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function(b){b.classList.toggle('active',b.dataset.tab===key)});
    var rows=document.querySelectorAll('#review-tbody tr.review-row');var count=0;
    rows.forEach(function(r){var show=true;
      if(key==='active')show=r.dataset.status==='active'||r.dataset.status==='open'||r.dataset.status==='in_progress';
      else if(key==='priority')show=r.dataset.priority==='1';
      else if(key==='history')show=r.dataset.status==='completed'||r.dataset.status==='closed';
      else if(key==='archive')show=r.dataset.status==='archived'||r.dataset.archived==='1';
      r.style.display=show?'':'none';if(show)count++;
    });
    var el=document.getElementById('row-count');if(el)el.textContent=count+' items';
  }`;

  const ctxScript = `var ctxEl=document.getElementById('review-ctx-menu');
  window.showCtxMenu=function(e,id){e.preventDefault();if(!ctxEl)return;ctxEl.dataset.reviewId=id;ctxEl.style.display='block';ctxEl.style.left=e.pageX+'px';ctxEl.style.top=e.pageY+'px'};
  document.addEventListener('click',function(){if(ctxEl)ctxEl.style.display='none'});
  window.ctxAction=function(action){var id=ctxEl&&ctxEl.dataset.reviewId;if(!id)return;
    if(action==='open')window.location='/review/'+id;
    else if(action==='pdf')window.location='/review/'+id+'/pdf';
    else if(action==='edit')window.location='/review/'+id+'/edit';
    else if(action==='highlights')window.location='/review/'+id+'/highlights';
  }`;

  const priorityScript = `window.togglePriority=async function(id){try{var btn=document.querySelector('button[data-args=\\'["'+id+'"]\\']');var on=btn&&btn.classList.contains('is-priority');var res=await fetch('/api/review/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_priority:on?0:1})});if(res.ok){btn.classList.toggle('is-priority');btn.textContent=btn.classList.contains('is-priority')?'★':'☆';showToast('Priority updated','success')}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}};`;
  const searchScript = `(function(){var input=document.getElementById('review-search');if(!input)return;
    input.addEventListener('input',function(){var q=input.value.toLowerCase();
      document.querySelectorAll('#review-tbody tr.review-row').forEach(function(r){
        var text=r.textContent.toLowerCase();r.style.display=text.indexOf(q)>=0?'':'none';
      });
    });
  })()`;

  return page(user, 'Reviews | Moonlanding', bc, content, [TOAST_SCRIPT, tabScript, ctxScript, searchScript, priorityScript]);
}

export function reviewSearchField() {
  return `<label for="review-search" class="sr-only">Search reviews</label><input type="text" id="review-search" placeholder="Search reviews..." class="form-input review-search-input" aria-label="Search reviews"/>`;
}

export function hideEmptyReviewsToggle() {
  return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--color-text-muted);cursor:pointer" title="Hide reviews with 0 highlights"><input type="checkbox" id="hide-empty-toggle"/>Hide empty</label>`;
}

export function reviewGroupedList(reviews, groupBy) {
  const groups = {};
  reviews.forEach(r => {
    const key = r[groupBy] || r[`${groupBy}_name`] || r[`${groupBy}_id`] || 'Ungrouped';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return Object.entries(groups).map(([name, items]) =>
    `<div class="card-clean" style="margin-bottom:${SPACING.md}">
      <div class="card-clean-body" style="padding:${SPACING.md}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${SPACING.sm};cursor:pointer" data-action="toggleReviewGroup" data-self>
          <span style="font-weight:600;font-size:14px">${name}</span>
          <span class="pill pill-neutral">${items.length}</span>
        </div>
        <div class="review-group-items">
          ${items.map(r => `<div class="list-item-row" style="padding:8px 0" data-navigate="/review/${r.id}">
            <span class="list-item-name">${r.name || r.title || 'Untitled'}</span>
            ${r.status ? statusBadge(r.status) : ''}
          </div>`).join('')}
        </div>
      </div>
    </div>`
  ).join('');
}

export function renderReviewSections(user, review, sections) {
  const totalHighlights = sections.reduce((s, sec) => s + (sec.highlights_count || 0), 0);
  const resolvedHighlights = sections.reduce((s, sec) => s + (sec.resolved_count || 0), 0);
  const pct = totalHighlights > 0 ? Math.round(resolvedHighlights / totalHighlights * 100) : 0;

  const statsHtml = renderStatsRow([
    { value: sections.length, label: 'Sections' },
    { value: totalHighlights, label: 'Total Highlights' },
    { value: resolvedHighlights, label: 'Resolved', color: 'var(--color-success)' },
    { value: `${pct}%`, label: 'Progress' },
  ]);

  const sectionRows = sections.map((sec, i) => {
    const secPct = sec.highlights_count > 0 ? Math.round((sec.resolved_count || 0) / sec.highlights_count * 100) : 0;
    return `<div class="card-clean" style="margin-bottom:${SPACING.sm}">
      <div class="card-clean-body" style="padding:${SPACING.md}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.sm}">
          <span style="font-weight:600;font-size:14px">${sec.name || `Section ${i + 1}`}</span>
          <span style="font-size:13px;color:var(--color-text-muted)">${sec.highlights_count || 0} highlights</span>
        </div>
        <div class="resolution-bar" style="margin-bottom:${SPACING.xs}">
          <div class="resolution-bar-segment resolution-bar-resolved" style="width:${secPct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-muted)">
          <span>Resolved: ${sec.resolved_count || 0}</span>
          <span>Flagged: ${sec.flagged_count || 0}</span>
          <span>${secPct}%</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const content = `${renderPageHeader(`Sections: ${review.name || 'Review'}`, '')}${statsHtml}${sectionRows || renderEmptyState('No sections found')}`;
  const bc = [{ href: '/', label: 'Dashboard' }, { href: '/review', label: 'Reviews' }, { href: `/review/${review.id}`, label: review.name || 'Review' }, { label: 'Sections' }];
  return page(user, `Sections - ${review.name || 'Review'}`, bc, content);
}

