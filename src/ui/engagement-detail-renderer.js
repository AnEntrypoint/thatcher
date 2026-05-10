import { page } from '@/ui/layout.js';
import { canEdit, isPartner, isManager } from '@/ui/permissions-ui.js';
import { esc, STAGE_CONFIG } from '@/ui/render-helpers.js';
import { stageTransitionDialog, chatPanel, checklistPanel, activityPanel, filesPanel, letterPanel, engDetailScript, aiPanel, reviewsPanel } from '@/ui/engagement-detail-panels.js';
import { SPACING, renderInfoGrid, renderProgress } from '@/ui/spacing-system.js';
import { pushMwrScript, importQueriesScript, teamScript, rfiGroupScript, ratingScript, rfiSectionScript, rfiAnalysisScript, dateEditScript } from '@/ui/engagement-detail-scripts.js';

function stagePipelineHtml(e) {
  const currentIdx = STAGE_CONFIG.findIndex(s => s.key === e.stage);
  const stages = STAGE_CONFIG.map((s, i) => {
    const isCurrent = i === currentIdx;
    const isPast = i < currentIdx;
    const bg = isCurrent || isPast ? s.color : '#e2e8f0';
    const color = isCurrent || isPast ? '#fff' : '#94a3b8';
    const opacity = isPast ? '0.7' : '1';
    return `<div data-action="openStageTransition" data-args='["${esc(s.key)}"]' title="${s.label}" style="flex:1;min-width:0;padding:${SPACING.xs} ${SPACING.xs};text-align:center;background:${bg};color:${color};opacity:${opacity};font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.label}</div>`;
  }).join('');
  return `<div style="display:flex;flex-direction:row;width:100%;border-radius:6px;overflow:hidden;height:34px">${stages}</div>`;
}

export function renderEngagementCardView(user, engagements) {
  const cards = engagements.map(e => {
    const cfg = STAGE_CONFIG.find(s => s.key === e.stage);
    const stageLbl = cfg ? `<span class="badge ${cfg.badge} text-xs">${cfg.label}</span>` : '';
    const pct = typeof e.progress === 'number' ? Math.min(100, Math.round(e.progress)) : 0;
    return `<div data-navigate="/engagement/${esc(e.id)}" class="card-clean">
      <div class="card-clean-body" style="padding:${SPACING.md}">
        <div class="font-semibold text-sm mb-1">${esc(e.name || 'Untitled')}</div>
        <div class="text-xs text-base-content/60 mb-2">${esc(e.client_name || '')}</div>
        ${stageLbl}
        <progress class="progress progress-primary w-full mt-3" value="${pct}" max="100"></progress>
        <div class="flex justify-between mt-1 text-xs text-base-content/40"><span>${e.year || ''}</span><span>${pct}%</span></div>
      </div>
    </div>`;
  }).join('');
  return `<div class="engagement-card-grid">${cards || '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--color-text-muted)">No engagements found</div>'}</div>`;
}

export function renderEngagementDetail(user, engagement, client, rfis = [], sections = []) {
  const e = engagement || {};
  const stageCfg = STAGE_CONFIG.find(s => s.key === e.stage);
  const stageLabel = stageCfg ? stageCfg.label : (e.stage || '-');
  const stageBadgeCls = stageCfg ? stageCfg.badge : 'badge-flat-secondary';
  const canTransition = isPartner(user) || isManager(user);

  function fmtDate(v) {
    if (!v) return '-';
    const n = typeof v === 'number' ? (v > 1e10 ? v : v * 1000) : new Date(v).getTime();
    return new Date(n).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtCurrency(v) {
    if (!v && v !== 0) return '-';
    return 'R ' + Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  const assignedUsersHtml = (e.assigned_users_resolved || []).length
    ? (e.assigned_users_resolved || []).map(u => `<span class="badge badge-flat-primary text-xs mr-1">${esc(u.name)}</span>`).join('')
    : '<span class="text-base-content/40 text-sm italic">Not assigned</span>';

  const infoItems = [
    ['Client', esc(client?.name || e.client_name || e.client_id_display || e.client_id || '-')],
    ['Type', esc(e.type || e.engagement_type || e.repeat_interval || '-')],
    ['Year', esc(e.year || '-')],
    ['Team', esc(e.team_name || e.team_id_display || e.team_id || '-')],
    ['Status', e.status ? `<span class="badge ${e.status==='active'?'badge-success badge-flat-success':'badge-warning badge-flat-warning'} text-xs">${e.status}</span>` : '-'],
    ['Fee', fmtCurrency(e.fee || e.fees)],
    ['Commenced', canEdit(user, 'engagement') ? `<span style="cursor:pointer;text-decoration:underline dotted" title="Click to edit" onclick="openDateEdit('${esc(e.id)}','commencement_date',${JSON.stringify(e.commencement_date||'')})">${fmtDate(e.commencement_date)}</span>` : fmtDate(e.commencement_date)],
    ['Deadline', canEdit(user, 'engagement') ? `<span style="cursor:pointer;text-decoration:underline dotted" title="Click to edit" onclick="openDateEdit('${esc(e.id)}','deadline_date',${JSON.stringify(e.deadline_date||e.deadline||'')})">${fmtDate(e.deadline_date || e.deadline)}</span>` : fmtDate(e.deadline_date || e.deadline)],
    ['Created', fmtDate(e.created_at)],
    ['Assigned', assignedUsersHtml],
  ];

  const infoGrid = renderInfoGrid(infoItems);
  const pct = typeof e.progress === 'number' ? Math.min(100, Math.round(e.progress)) : 0;
  const progressHtml = `<div style="margin-top:${SPACING.lg};padding-top:${SPACING.md};border-top:1px solid var(--color-border)">${renderProgress(pct, 100, 'primary', '0px')}</div>`;
  const rfiRowHtml = r => { const rs = r.status || 'pending'; const rc = rs==='active'?'badge-success badge-flat-success':rs==='closed'?'badge-flat-secondary':'badge-warning badge-flat-warning'; return `<tr class="hover cursor-pointer" data-navigate="/rfi/${esc(r.id)}"><td class="text-sm">${esc(r.name||r.title||'RFI')}</td><td><span class="badge ${rc} text-xs">${rs}</span></td><td class="text-sm">${r.deadline?new Date(r.deadline).toLocaleDateString():'-'}</td></tr>`; };
  const rfiRows = rfis.length ? rfis.map(rfiRowHtml).join('') : `<tr><td colspan="3" class="text-center py-6 text-base-content/40 text-sm">No RFIs</td></tr>`;
  const rfiJsonData = JSON.stringify(rfis.map(r => ({ id: r.id, name: r.name||r.title||'RFI', status: r.status||'pending', deadline: r.deadline||'' })));

  const canRate = user.role === 'client_admin';
  const ratingStars = e.client_rating ? [1,2,3,4,5].map(i => `<span style="color:${i<=e.client_rating?'#f59e0b':'#d1d5db'};font-size:1rem">&#9733;</span>`).join('') : '';
  const ratingBtn = canRate ? `<button data-action="openRatingDialog" data-args='["${esc(e.id)}","${e.client_rating||0}"]' class="btn btn-ghost btn-sm">${ratingStars || '&#9733; Rate'}</button>` : (ratingStars ? `<span style="padding:4px 8px">${ratingStars}</span>` : '');
  const stageBtn = canTransition ? `<button data-action="openStageTransition" data-args='["${esc(e.stage)}"]' class="btn btn-ghost btn-sm">Move Stage</button>` : '';
  const editBtn = canEdit(user, 'engagement') ? `<a href="/engagement/${esc(e.id)}/edit" class="btn btn-primary btn-sm">Edit</a>` : '';
  const recreateBtn = isPartner(user) ? `<button data-action="recreateEngagement" data-args='["${esc(e.id)}"]' class="btn btn-ghost btn-sm">Recreate</button>` : '';
  const colorBtn = canEdit(user, 'engagement') ? `<button data-action="openColorPicker" data-args='["${esc(e.id)}","${esc(e.color || '#3b82f6')}"]' class="btn btn-ghost btn-sm">Color</button>` : '';
  const teamBtn = (isPartner(user) || isManager(user)) ? `<button data-action="openTeamDialog" data-args='["${esc(e.id)}"]' class="btn btn-ghost btn-sm">Team</button>` : '';
  const reportBtn = `<a href="/engagement/${esc(e.id)}/report" target="_blank" class="btn btn-ghost btn-sm">Report</a>`;
  const pushMwrBtn = (isPartner(user) || isManager(user)) ? `<button data-action="openPushToMwr" class="btn btn-ghost btn-sm">Push to MWR</button>` : '';
  const newRfiBtn = `<a href="/rfi/new?engagement_id=${esc(e.id)}" class="btn btn-primary btn-sm">+ RFI</a>`;
  const colorBar = `<div style="height:4px;background:${esc(e.color || '#3b82f6')};border-radius:2px;margin-bottom:${SPACING.sm}"></div>`;
  const TABS = ['Details','RFIs','Reviews','Chat','Checklist','Activity','Files','Letter','AI'];
  const tabBar = `<div class="tab-bar">${TABS.map((t,i) => `<button data-action="switchEngTab" data-args='["${t.toLowerCase()}"]' id="engtab-${t.toLowerCase()}" class="tab-btn${i===0?' active':''}">${t}</button>`).join('')}</div>`;
  const markAllBtn = (isPartner(user) || isManager(user)) ? `<button data-action="markAllRfiQuestionsAccepted" data-args='["${esc(e.id)}"]' class="btn btn-ghost btn-sm">Mark All Accepted</button>` : '';
  const importQueriesBtn = (isPartner(user) || isManager(user)) ? `<button data-action="openImportQueries" class="btn btn-ghost btn-sm">Import Queries</button>` : '';
  const reorderSectionsBtn = (isPartner(user) || isManager(user)) ? `<button data-action="openReorderSections" class="btn btn-ghost btn-sm">Reorder Sections</button>` : '';
  const rfiAnalysisBtn = `<button data-action="openRfiAnalysis" class="btn btn-ghost btn-sm">RFI Analysis</button>`;
  const groupByDropdown = `<select id="rfi-group-by" class="select select-sm" onchange="rfiApplyGroupBy(this.value)" style="font-size:0.75rem;height:28px;min-height:28px"><option value="">Group: None</option><option value="status">Group: Status</option><option value="deadline_month">Group: Deadline Month</option></select>`;
  const rfiTableControls = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">${groupByDropdown}${markAllBtn}${importQueriesBtn}${reorderSectionsBtn}</div>`;
  const sectionCardsHtml = sections.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px">${sections.map(s => `<div class="card-clean"><div class="card-clean-body" style="padding:10px"><div class="text-sm font-semibold mb-1">${esc(s.name)}</div><progress class="progress progress-primary w-full" value="0" max="100"></progress><div class="text-xs text-base-content/40 mt-1">0%</div></div></div>`).join('')}</div>` : '';
  const makeRfiTable = (tbodyId) => `${sectionCardsHtml}${rfiTableControls}<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Deadline</th></tr></thead><tbody id="${tbodyId}">${rfiRows}</tbody></table></div>`;

  const content = `
    <nav class="breadcrumb-clean"><a href="/">Home</a><span class="breadcrumb-sep">/</span><a href="/engagements">Engagements</a><span class="breadcrumb-sep">/</span><span>${esc(e.name || 'Engagement')}</span></nav>
    ${colorBar}
    <div class="page-header">
      <div><h1 class="page-title">${esc(e.name || e.client_name || 'Engagement')}</h1><div style="margin-top:${SPACING.xs}"><span class="badge ${stageBadgeCls}">${stageLabel}</span></div></div>
      <div style="display:flex;gap:${SPACING.sm};flex-shrink:0;align-items:center">${ratingBtn}${stageBtn}${rfiAnalysisBtn}${reportBtn}${colorBtn}${teamBtn}${recreateBtn}${pushMwrBtn}${editBtn}</div>
    </div>
    <div class="card-clean overflow-hidden mb-4" style="padding:${SPACING.sm}">${stagePipelineHtml(e)}</div>
    ${tabBar}
    <div id="tab-details" class="eng-tab-panel"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="card-clean"><div class="card-clean-body"><h2 class="text-sm font-semibold text-base-content mb-4">Engagement Details</h2>${infoGrid}${progressHtml}</div></div>
      <div class="card-clean"><div class="card-clean-body"><div class="flex justify-between items-center mb-4"><h2 class="text-sm font-semibold text-base-content">RFIs (${rfis.length})</h2>${newRfiBtn}</div>${makeRfiTable('rfi-tbody-details')}</div></div>
    </div></div>
    <div id="tab-rfis" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body"><div class="flex justify-between items-center mb-4"><h2 class="text-sm font-semibold text-base-content">All RFIs</h2>${newRfiBtn}</div>${makeRfiTable('rfi-tbody-rfis')}</div></div></div>
    ${reviewsPanel(e.id)}${chatPanel(e.id)}${checklistPanel(e.id, user)}${activityPanel(e.id)}${filesPanel(e.id)}${letterPanel(e.id)}${aiPanel(e.id)}
    ${stageTransitionDialog(e.id, e.stage)}
    <div id="push-mwr-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title">Push to MWR</span><button class="dialog-close" data-dialog-close="push-mwr-dialog">&times;</button></div>
        <div class="dialog-body"><p class="text-sm text-gray-500 mb-3">Create a MyWorkReview review linked to this engagement.</p>
          <div class="modal-form-group"><label>Review Name</label><input id="pmwr-name" class="form-input" type="text" placeholder="Review name..." value="${esc(e.name || '')}"/></div>
          <div class="modal-form-group"><label>Or link to existing review</label><select id="pmwr-existing" class="select select-bordered w-full"><option value="">— Create new —</option></select></div>
          <div id="pmwr-result" style="display:none;margin-top:8px"></div></div>
        <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="push-mwr-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="submitPushToMwr">Push to MWR</button></div></div>
    </div>
    <div id="team-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="dialog-panel" style="max-width:500px"><div class="dialog-header"><span class="dialog-title">Manage Team Members</span><button class="dialog-close" data-dialog-close="team-dialog">&times;</button></div>
        <div class="dialog-body"><div id="team-members-list" style="margin-bottom:16px"></div>
          <div style="border-top:1px solid var(--color-border);padding-top:12px"><div class="text-sm font-semibold mb-2">Add Member</div>
            <div style="display:flex;gap:8px;align-items:center"><select id="team-add-select" class="select select-bordered w-full" style="flex:1"><option value="">Select user...</option></select><button class="btn btn-primary btn-sm" onclick="teamAddMember()">Add</button></div>
          </div></div>
        <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="team-dialog">Close</button></div></div>
    </div>
    <div id="import-queries-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="dialog-panel" style="max-width:600px"><div class="dialog-header"><span class="dialog-title">Import Review Queries</span><button class="dialog-close" data-dialog-close="import-queries-dialog">&times;</button></div>
        <div class="dialog-body"><p class="text-sm text-gray-500 mb-3">Select MWR highlights to import as RFI questions.</p>
          <div class="modal-form-group"><label>Target RFI</label><select id="iq-rfi" class="select select-bordered w-full"><option value="">Select RFI...</option>${rfis.map(r => `<option value="${esc(r.id)}">${esc(r.name||r.id)}</option>`).join('')}</select></div>
          <div id="iq-highlights-wrap" style="margin-top:8px;max-height:280px;overflow-y:auto"></div></div>
        <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="import-queries-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="submitImportQueries">Import Selected</button></div></div>
    </div>
    <div id="reorder-sections-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="dialog-panel" style="max-width:480px"><div class="dialog-header"><span class="dialog-title">Reorder Sections</span><button class="dialog-close" data-dialog-close="reorder-sections-dialog">&times;</button></div>
        <div class="dialog-body"><div id="reorder-sections-list" style="display:flex;flex-direction:column;gap:8px"></div></div>
        <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="reorder-sections-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="saveReorderSections">Save Order</button></div>
      </div>
    </div>
    <div id="rfi-analysis-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="dialog-panel" style="max-width:640px"><div class="dialog-header"><span class="dialog-title">RFI Analysis</span><button class="dialog-close" data-dialog-close="rfi-analysis-dialog">&times;</button></div>
        <div class="dialog-body" id="rfi-analysis-body">Loading...</div>
        <div class="dialog-footer"><button onclick="window.print()" class="btn btn-ghost btn-sm">Print</button><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-analysis-dialog">Close</button></div>
      </div>
    </div>
    <div id="date-edit-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
      <div class="modal-overlay" data-dialog-close="date-edit-dialog"></div>
      <div class="modal-content rounded-box max-w-sm p-6">
        <h3 class="text-lg font-semibold mb-4" id="date-edit-label">Edit Date</h3>
        <div class="form-group mb-4"><input id="date-edit-input" type="date" class="input input-solid w-full"/></div>
        <div class="modal-action"><button onclick="saveDateEdit('${esc(e.id)}')" class="btn btn-primary">Save</button><button data-dialog-close="date-edit-dialog" class="btn btn-ghost">Cancel</button></div>
      </div>
    </div>
    <div id="rating-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
      <div class="modal-overlay" data-dialog-close="rating-dialog"></div>
      <div class="modal-content rounded-box max-w-sm p-6">
        <h3 class="text-lg font-semibold mb-4">Rate This Engagement</h3>
        <div class="form-group mb-4"><label class="form-label mb-2">Rating</label>
          <div id="rating-stars" style="display:flex;gap:8px;font-size:2rem;cursor:pointer">${[1,2,3,4,5].map(i => `<span data-star="${i}" style="color:#d1d5db" onclick="setRatingStar(${i})">&#9733;</span>`).join('')}</div></div>
        <div class="form-group mb-4"><label class="form-label" for="rating-notes">Notes (optional)</label><textarea id="rating-notes" class="form-input" rows="3" placeholder="Add any feedback..."></textarea></div>
        <div class="modal-action"><button data-action="submitRating" data-args='["${esc(e.id)}"]' class="btn btn-primary">Submit Rating</button><button data-dialog-close="rating-dialog" class="btn btn-ghost">Cancel</button></div>
      </div>
    </div>
  `;

  const canManageTeam = isPartner(user) || isManager(user);
  const sectionsJson = JSON.stringify(sections.map(s => ({ id: s.id, name: s.name, sort_order: s.sort_order })));
  return page(user, `${esc(e.name || 'Engagement')} | Moonlanding`, null, content, [engDetailScript(e.id), rfiGroupScript(rfiJsonData), ratingScript(), pushMwrScript(e.id), importQueriesScript(e.id), rfiSectionScript(sectionsJson, e.id), rfiAnalysisScript(rfiJsonData), dateEditScript(e.id), ...(canManageTeam ? [teamScript(e.id, e.assigned_users_resolved || [])] : [])]);
}
