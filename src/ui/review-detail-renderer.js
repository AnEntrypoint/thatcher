import { page } from '@/ui/layout.js';
import { reviewZoneNav } from '@/ui/review-zone-nav.js';
export { reviewZoneNav };
import { canEdit } from '@/ui/permissions-ui.js';
import { esc, statusBadge, TOAST_SCRIPT } from '@/ui/render-helpers.js';
import { reviewDetailScript } from '@/ui/review-detail-script.js';
import { highlightRow, collaboratorRow, addCollaboratorDialog } from '@/ui/review-detail-panels.js';
import { tenderPanelHtml, tenderDialog, linksPanelHtml, linkDialog, sectionsPanelHtml, compareDialogHtml } from '@/ui/review-detail-panels-extra.js';
import { retryHighlightDialog, switchTemplateButton } from '@/ui/engagement-dialogs.js';
import { reviewTemplateChoiceDialog } from '@/ui/review-dialogs.js';
import { SPACING, renderCard, renderTable, renderButton, renderInfoGrid } from '@/ui/spacing-system.js';

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString();
  try { return new Date(ts).toLocaleDateString(); } catch { return String(ts); }
}

export function renderReviewDetail(user, review, highlights = [], collaborators = [], checklists = [], sections = [], tenders = []) {
  const r = review || {};
  const canEditReview = canEdit(user, 'review');
  const totalH = highlights.length;
  const resolvedH = highlights.filter(h => h.resolved || h.status === 'resolved').length;
  const openH = totalH - resolvedH;
  const pct = totalH > 0 ? Math.round((resolvedH / totalH) * 100) : 0;

  let parsedLinks = [];
  try { parsedLinks = JSON.parse(r.links || '[]') || []; } catch {}

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'highlights', label: 'Highlights', count: totalH },
    { id: 'collaborators', label: 'Collaborators', count: collaborators.length },
    { id: 'checklists', label: 'Checklists', count: checklists.length },
    { id: 'sections', label: 'Sections', count: sections.length },
    { id: 'tender', label: 'Tender', count: tenders.length > 0 ? tenders.length : undefined },
    { id: 'links', label: 'Links', count: parsedLinks.length > 0 ? parsedLinks.length : undefined },
    { id: 'history', label: 'History' },
  ];

  const tabBar = `<nav class="tab-bar" style="margin-bottom:${SPACING.lg}">
    ${TABS.map((t, i) => `<button data-action="switchTab" data-args='["${t.id}"]' id="rvtab-${t.id}" class="tab-btn${i === 0 ? ' active' : ''}" aria-selected="${i === 0}">${t.label}${t.count !== undefined ? `<span class="tab-count">${t.count}</span>` : ''}</button>`).join('')}
  </nav>`;

  const progressSection = totalH > 0
    ? `<div style="margin-top:${SPACING.md}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.sm}">
          <span style="font-size:13px;font-weight:600;color:var(--color-text-muted)">Resolution</span>
          <span style="font-size:13px;color:var(--color-text-light)">${resolvedH}/${totalH} resolved</span>
        </div>
        <div class="resolution-bar"><div class="resolution-bar-segment resolution-bar-resolved" style="width:${pct}%"></div></div>
      </div>`
    : `<div style="margin-top:${SPACING.md};font-size:13px;color:var(--color-text-light)">No highlights yet</div>`;

  const detailsCard = renderCard(`<div class="card-header">Review Details</div>${renderInfoGrid([
    ['Name', esc(r.name || r.title || '-')],
    ['Status', statusBadge(r.status)],
    ['Type', esc(r.review_type || r.type || '-')],
    ['Financial Year', esc(r.financial_year || '-')],
    ['Deadline', fmtDate(r.deadline)],
    ['Created', fmtDate(r.created_at)],
  ])}${progressSection}`, { padding: SPACING.md });

  const actions = [
    renderButton('Open PDF', { variant: 'primary', size: 'sm', href: `/review/${esc(r.id)}/pdf` }),
    renderButton('Compare', { variant: 'ghost', size: 'sm', action: 'openDialog', args: ['pdf-compare-dialog'] }),
    renderButton('Discussions', { variant: 'ghost', size: 'sm', href: `/review/${esc(r.id)}/highlights` }),
    renderButton('Sections', { variant: 'ghost', size: 'sm', href: `/review/${esc(r.id)}/sections` }),
    renderButton('Resolution', { variant: 'ghost', size: 'sm', href: `/review/${esc(r.id)}/resolution` }),
    ...(canEditReview ? [
      renderButton('Edit', { variant: 'outline', size: 'sm', href: `/review/${esc(r.id)}/edit` }),
      renderButton('Export PDF', { variant: 'ghost', size: 'sm', action: 'exportPdf', args: [`${esc(r.id)}`] }),
      renderButton('Notify', { variant: 'ghost', size: 'sm', action: 'openDialog', args: ['notify-collab-dialog'] }),
    ] : []),
    ...(resolvedH < totalH && canEditReview ? [renderButton('Bulk Resolve', { variant: 'success', size: 'sm', action: 'bulkResolve', args: [`${esc(r.id)}`] })] : []),
    ...(canEditReview ? [renderButton('Retry Highlight', { variant: 'ghost', size: 'sm', action: 'openRetryHighlight' })] : []),
    ...(canEditReview ? [switchTemplateButton(esc(r.id))] : []),
  ];

  function tablePanel(id, heading, countBadge, extraBtn, cols, bodyRows, emptyMsg) {
    const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md}">
      <div><span style="font-size:15px;font-weight:600;color:var(--color-text)">${heading}</span>${countBadge ? `<span style="font-size:13px;color:var(--color-text-muted);margin-left:8px">(${countBadge})</span>` : ''}</div>
      <div style="display:flex;align-items:center;gap:8px">${extraBtn || ''}</div>
    </div>`;
    return `<div id="rvpanel-${id}" class="rv-panel" style="display:none">${header}${renderTable(cols,
      bodyRows || `<tr><td colspan="${cols.length}" style="text-align:center;padding:${SPACING.xl} 0;color:var(--color-text-muted)">${emptyMsg}</td></tr>`,
      SPACING.md)}</div>`;
  }

  const flaggedCount = highlights.filter(h => { try { return (JSON.parse(h.flags||'[]')||[]).includes('flagged'); } catch { return false; } }).length;
  const hRows = highlights.map(h => highlightRow(h)).join('');
  const highlightsPanel = tablePanel('highlights', 'Highlights', totalH,
    `<span style="font-size:13px;color:var(--color-text-muted)">${resolvedH} resolved, ${openH} open</span><button id="btn-filter-flagged" data-action="filterByFlag" style="font-size:12px;padding:4px 10px;border:1px solid ${flaggedCount > 0 ? '#f59e0b' : 'var(--color-border,#e5e7eb)'};background:${flaggedCount > 0 ? '#fffbeb' : 'transparent'};color:${flaggedCount > 0 ? '#92400e' : 'var(--color-text-muted)'};border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">⚑ Flagged${flaggedCount > 0 ? ` (${flaggedCount})` : ''}</button>${renderButton('Open PDF', { variant: 'primary', size: 'sm', href: `/review/${esc(r.id)}/pdf` })}`,
    ['Highlight', 'Page', 'Status', 'Tags', 'By', 'Actions'], hRows,
    `<a href="/review/${esc(r.id)}/pdf" style="color:var(--color-primary);font-weight:500;text-decoration:none">Open the PDF</a> to start adding highlights`);

  const collabRows = collaborators.map(c => collaboratorRow(c)).join('');
  const collabPanel = tablePanel('collaborators', 'Collaborators', collaborators.length,
    canEditReview ? renderButton('+ Add Collaborator', { variant: 'primary', size: 'sm', action: 'openDialog', args: ['collab-dialog'] }) : '',
    ['User', 'Role', 'Expires', 'Actions'], collabRows, 'No collaborators added yet');

  const clRows = checklists.map(cl => {
    const clPct = cl.total_items > 0 ? Math.round((cl.completed_items || 0) / cl.total_items * 100) : 0;
    return `<tr><td style="font-weight:500">${esc(cl.name || '-')}</td><td style="font-size:13px;color:var(--color-text-muted)">${cl.total_items || 0} items</td><td><div style="display:flex;align-items:center;gap:8px"><div class="resolution-bar" style="width:80px"><div class="resolution-bar-segment resolution-bar-resolved" style="width:${clPct}%"></div></div><span style="font-size:12px;color:var(--color-text-muted)">${cl.completed_items || 0}/${cl.total_items || 0}</span></div></td><td><a href="/checklist/${esc(cl.id)}" class="btn-ghost-clean" style="font-size:13px;padding:4px 10px">View</a></td></tr>`;
  }).join('');
  const checklistPanel = tablePanel('checklists', 'Checklists', checklists.length,
    canEditReview ? renderButton('+ Add from Template', { variant: 'primary', size: 'sm', action: 'openChecklistPicker', args: [`${esc(r.id)}`] }) : '',
    ['Name', 'Items', 'Progress', ''], clRows, 'No checklists attached');

  const checklistPickerDialog = `<div id="checklist-picker-dialog" class="dialog-backdrop" style="display:none" data-dialog-close="checklist-picker-dialog">
    <div class="dialog" style="max-width:520px" onclick="event.stopPropagation()">
      <div class="dialog-header"><h2 style="font-size:17px;font-weight:600;margin:0">Attach Checklist</h2><button class="dialog-close" data-dialog-close="checklist-picker-dialog" aria-label="Close">&times;</button></div>
      <div class="dialog-body" style="padding:16px 20px">
        <label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:6px">Choose a template</label>
        <select id="checklist-picker-template" class="input" style="width:100%;margin-bottom:12px"><option value="">Loading templates...</option></select>
        <label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:6px">Checklist name</label>
        <input id="checklist-picker-name" type="text" class="input" style="width:100%" placeholder="Leave blank to use template name"/>
      </div>
      <div class="dialog-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--color-border,#e5e7eb)">
        <button class="btn-ghost-clean" data-dialog-close="checklist-picker-dialog">Cancel</button>
        <button class="btn-primary-clean" id="checklist-picker-save" data-action="saveChecklistFromTemplate" data-args='["${esc(r.id)}"]'>Attach</button>
      </div>
    </div>
  </div>`;

  const historyPanel = `<div id="rvpanel-history" class="rv-panel" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md}">
      <span style="font-size:15px;font-weight:600;color:var(--color-text)">History</span>
      <button class="btn-ghost-clean" style="font-size:13px" data-action="loadHistory" data-args='["${esc(r.id)}"]'>Refresh</button>
    </div>
    <div id="history-list" style="display:flex;flex-direction:column;gap:8px"><div style="font-size:13px;color:var(--color-text-muted);padding:24px 0;text-align:center">Loading history...</div></div>
  </div>`;

  const metaTags = [statusBadge(r.status),
    r.review_type ? `<span class="pill pill-neutral" style="text-transform:uppercase;font-size:11px;letter-spacing:0.5px">${esc(r.review_type)}</span>` : '',
    r.financial_year ? `<span style="font-size:13px;color:var(--color-text-muted)">FY ${esc(r.financial_year)}</span>` : '',
    pct === 100 ? `<span class="pill pill-success">Complete</span>` : '',
  ].filter(Boolean).join(' ');

  const bc = [{ href: '/', label: 'Home' }, { href: '/review', label: 'Reviews' }, { href: `/review/${r.id}`, label: r.name || 'Review' }, { label: 'Overview' }];
  const pageHeader = `<div class="page-header" style="align-items:flex-start"><div><h1 class="page-title">${esc(r.name || r.title || 'Review')}</h1><div class="review-meta-row">${metaTags}</div></div><div style="display:flex;flex-wrap:wrap;gap:8px">${actions.join('')}</div></div>`;

  const overviewPanel = `<div id="rvpanel-overview" class="rv-panel">${detailsCard}</div>`;
  const sectionsPanel = sectionsPanelHtml(r.id, sections, SPACING, renderTable, renderButton);
  const notifyDialog = `<div id="notify-collab-dialog" class="dialog-backdrop" style="display:none" data-dialog-close="notify-collab-dialog">
    <div class="dialog" style="max-width:480px" onclick="event.stopPropagation()">
      <div class="dialog-header"><h2 style="font-size:17px;font-weight:600;margin:0">Notify Collaborators</h2><button class="dialog-close" data-dialog-close="notify-collab-dialog">&times;</button></div>
      <div class="dialog-body" style="padding:16px 20px">
        <label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:6px">Recipients</label>
        <div id="notify-recipients" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;max-height:160px;overflow-y:auto">${collaborators.map(c => `<label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" name="notify_user" value="${esc(c.user_id||c.id)}" checked/> ${esc(c.user_name||c.name||c.email||c.user_id||'-')}</label>`).join('') || '<span style="font-size:13px;color:var(--color-text-muted)">No collaborators added yet</span>'}</div>
        <label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:6px">Message</label>
        <textarea id="notify-message" rows="4" class="input" style="width:100%;resize:vertical" placeholder="Enter your message..."></textarea>
      </div>
      <div class="dialog-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--color-border,#e5e7eb)">
        <button class="btn-ghost-clean" data-dialog-close="notify-collab-dialog">Cancel</button>
        <button class="btn-primary-clean" id="notify-send-btn" onclick="sendCollabNotify('${esc(r.id)}')">Send Notification</button>
      </div>
    </div>
  </div>`;

  const notifyScript = `<script>
async function sendCollabNotify(reviewId){var msg=document.getElementById('notify-message').value.trim();if(!msg){showToast('Enter a message','error');return;}var checked=Array.from(document.querySelectorAll('#notify-recipients input[name="notify_user"]:checked')).map(function(i){return i.value;});if(!checked.length){showToast('Select at least one recipient','error');return;}var btn=document.getElementById('notify-send-btn');if(btn){btn.disabled=true;btn.textContent='Sending...';}try{var r=await fetch('/api/mwr/review/'+reviewId+'/notify',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({user_ids:checked,message:msg})});if(r.ok){showToast('Notification sent','success');document.getElementById('notify-collab-dialog').style.display='none';document.getElementById('notify-message').value='';}else{var d=await r.json();showToast(d.error||'Failed','error');}}catch(e){showToast('Error: '+e.message,'error');}finally{if(btn){btn.disabled=false;btn.textContent='Send Notification';}}}
</script>`;

  const content = `${pageHeader}${reviewZoneNav(r.id, 'overview')}${tabBar}
    <div>${overviewPanel}${highlightsPanel}${collabPanel}${checklistPanel}${sectionsPanel}${tenderPanelHtml(r.id, tenders, canEditReview, tablePanel)}${linksPanelHtml(r.id, parsedLinks, canEditReview, tablePanel)}${historyPanel}${addCollaboratorDialog(r.id)}${checklistPickerDialog}${tenderDialog(r.id)}${linkDialog(r.id)}${compareDialogHtml(r.id)}${notifyDialog}${notifyScript}${retryHighlightDialog(esc(r.id))}${reviewTemplateChoiceDialog()}</div>`;

  return page(user, `${esc(r.name || 'Review')} | Moonlanding`, bc, content, [reviewDetailScript(r.id)]);
}
