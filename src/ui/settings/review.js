/*
 * Behaviour/config settings pages: audit-log (recreation) view, integrations,
 * notifications, review settings, file-review settings, and MWR permissions.
 * Ported unchanged from settings-renderer-advanced.js (renderSettingsRecreation,
 * renderSettingsIntegrations, renderSettingsNotifications) and
 * settings-renderer-advanced2.js (renderSettingsReviewSettings,
 * renderSettingsFileReview, renderSettingsMwrPermissions).
 */
import { TOAST_SCRIPT, settingsPage, settingsBack, inlineTable, bc, esc, icon } from '@/ui/settings/shared.js';

// Module-level togRow (base-content/80) backs renderSettingsReviewSettings and
// renderSettingsFileReview, ported from settings-renderer-advanced2.js's
// module-level togRow. renderSettingsNotifications below defines its OWN
// togRowLocal (base-content/70) -- the two were never actually the same
// helper in the original files (advanced.js's was function-scoped inside
// renderSettingsNotifications with a different opacity class), so they stay
// separate here rather than being incorrectly merged into one shared const.
const togRow = tg => `<div class="flex justify-between items-center py-3 border-b border-base-200"><div><div class="text-sm font-semibold">${tg.label}</div><div class="text-xs text-base-content/80">${tg.desc}</div></div><input type="checkbox" name="${tg.id}" ${tg.checked ? 'checked' : ''} class="checkbox checkbox-primary"/></div>`;

export function renderSettingsRecreation(user, _logs = [], _users = []) {
  const filters = `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body">
    <div class="flex flex-wrap gap-4 items-end">
      <div class="form-group"><label class="label"><span class="label-text font-semibold">Level</span></label><select id="filter-level" class="select select-solid"><option value="">All Levels</option><option value="info">Info</option><option value="warn">Warning</option><option value="error">Error</option></select></div>
      <div class="form-group"><label class="label"><span class="label-text font-semibold">Entity Type</span></label><select id="filter-entity" class="select select-solid"><option value="">All Entities</option><option value="engagement">Engagement</option><option value="review">Review</option><option value="rfi">RFI</option><option value="user">User</option><option value="client">Client</option></select></div>
      <div class="form-group"><label class="label"><span class="label-text font-semibold">Start Date</span></label><input type="date" id="filter-start" class="input input-solid"/></div>
      <div class="form-group"><label class="label"><span class="label-text font-semibold">End Date</span></label><input type="date" id="filter-end" class="input input-solid"/></div>
      <button data-action="applyAuditFilters" class="btn btn-primary btn-sm">Filter</button>
    </div>
  </div></div>`;
  const content = `${settingsBack()}<h1 class="text-2xl font-bold mb-6">Audit Logs</h1>${filters}
    <div class="card-clean"><div class="card-clean-body" style="padding:0">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Timestamp</th><th>Operation</th><th>Entity</th><th>Entity ID</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
        <tbody id="audit-tbody"><tr><td colspan="7" class="text-center py-8 text-base-content/70 text-sm">Loading...</td></tr></tbody>
      </table></div>
    </div></div>`;
  const script = `${TOAST_SCRIPT}
function _esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
async function loadAuditLogs(params){const tbody=document.getElementById('audit-tbody');try{const q=params?'?'+new URLSearchParams(params):'';const r=await fetch('/api/audit/logs'+q);const d=await r.json();const rows=d.data||[];tbody.innerHTML=rows.length?rows.map(function(l){const ts=l.timestamp;const date=ts?window.fmtDateTime(ts):'-';const details=l.details?JSON.stringify(l.details).substring(0,60)+'...':'-';return'<tr><td class="text-xs text-base-content/70">'+_esc(date)+'</td><td><span class="badge badge-flat-primary text-xs">'+_esc(l.operation||'-')+'</span></td><td class="text-sm">'+_esc(l.entity_type||'-')+'</td><td class="text-xs text-base-content/70">'+_esc(l.entity_id||'-')+'</td><td class="text-sm">'+_esc(l.user_id||'-')+'</td><td class="text-sm">'+_esc(l.action||'-')+'</td><td class="text-xs text-base-content/70">'+_esc(details)+'</td></tr>'}).join(''):'<tr><td colspan="7" class="text-center py-8 text-base-content/70 text-sm">No audit logs found</td></tr>'}catch(e){tbody.innerHTML='<tr><td colspan="7" class="text-center py-4 text-error text-sm">Failed to load: '+_esc(e.message)+'</td></tr>'}}
function applyAuditFilters(){const level=document.getElementById('filter-level').value;const entity=document.getElementById('filter-entity').value;const start=document.getElementById('filter-start').value;const end=document.getElementById('filter-end').value;const p={};if(level)p.level=level;if(entity)p.entityType=entity;if(start)p.from=new Date(start).toISOString();if(end)p.to=new Date(end+'T23:59:59').toISOString();loadAuditLogs(p)}
loadAuditLogs();`;
  return settingsPage(user, 'Audit Logs - Settings', bc('Audit Logs'), content, [script]);
}

const INTEGRATIONS = [
  { id: 'google_drive', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`, name: 'Google Drive', desc: 'Document storage and collaboration' },
  { id: 'gmail', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>`, name: 'Gmail', desc: 'Email integration for notifications' },
  { id: 'firebase', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`, name: 'Firebase (Legacy)', desc: 'Legacy data source for migration' },
];

export function renderSettingsIntegrations(user, integrations = {}) {
  const { private_key = '', mwr_api_key = '' } = integrations;
  const cards = INTEGRATIONS.map(integ => {
    const state = integrations[integ.id] || {};
    const connected = state.connected || false;
    return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body">
      <div class="flex items-center gap-4">
        <div class="text-2xl">${integ.icon}</div>
        <div class="flex-1"><div class="font-semibold">${integ.name}</div><div class="text-xs text-base-content/70">${integ.desc}</div></div>
        <div class="flex flex-col items-end gap-2">
          <span class="badge ${connected ? 'badge-success badge-flat-success' : 'badge-flat-secondary'} text-xs">${connected ? 'Connected' : 'Disconnected'}</span>
          <button data-action="toggleConfig" data-args='["${integ.id}"]' class="btn btn-ghost btn-xs">Configure</button>
        </div>
      </div>
      <div id="config-${integ.id}" class="hidden mt-4 pt-4 border-t border-base-200">
        <div class="flex gap-3 items-end flex-wrap">
          <div class="form-group flex-1 min-w-48"><label class="label"><span class="label-text font-semibold">API Key / Credentials</span></label><input type="password" id="key-${integ.id}" class="input input-solid max-w-full" placeholder="Paste the API key or credentials"/></div>
          <div class="flex gap-2"><button data-action="saveIntegration" data-args='["${integ.id}"]' class="btn btn-primary btn-sm">Save</button><button data-action="testIntegration" data-args='["${integ.id}"]' class="btn btn-ghost btn-sm">Test</button></div>
        </div>
      </div>
    </div></div>`;
  }).join('');
  const apiKeysCard = `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body">
    <h2 class="card-title text-base mb-4">Cross-App API Keys</h2>
    <div class="mb-5">
      <label class="label"><span class="label-text font-semibold">My Review Private Key</span></label>
      <div class="flex gap-2 items-center">
        <input type="text" id="mwr-private-key" class="input input-solid flex-1" readonly value="${esc(private_key)}" placeholder="No key generated"/>
        <button class="btn btn-ghost btn-sm" data-action="copyPrivateKey">Copy</button>
        <button class="btn btn-primary btn-sm" data-action="generatePrivateKey">Generate New Key</button>
      </div>
      <div class="text-xs text-base-content/70 mt-1">This key links Friday and My Review. Keep it confidential — anyone with access can import data.</div>
    </div>
    <div class="mb-4">
      <label class="label"><span class="label-text font-semibold">My Review API Key (from MWR app)</span></label>
      <input type="text" id="mwr-api-key" class="input input-solid w-full" value="${esc(mwr_api_key)}" placeholder="Paste the key from My Review Integrations settings"/>
      <div class="text-xs text-base-content/70 mt-1">Enter the private key generated in the My Review settings to enable cross-app access.</div>
    </div>
    <button class="btn btn-primary btn-sm" data-action="saveApiKeys">Save API Keys</button>
  </div></div>`;
  const content = `${settingsBack()}<h1 class="text-2xl font-bold mb-6">Integrations</h1>${apiKeysCard}${cards}`;
  const script = `${TOAST_SCRIPT}
function toggleConfig(id){const el=document.getElementById('config-'+id);el.classList.toggle('hidden')}
function saveIntegration(id){const key=document.getElementById('key-'+id).value.trim();if(!key){showToast('Enter the API key or credentials before saving','error');return}showToast('Integration credentials saved','success');toggleConfig(id)}
function testIntegration(id){showToast('Testing connection...','info');setTimeout(()=>showToast('Test complete','success'),1000)}
function generatePrivateKey(){const arr=new Uint8Array(32);crypto.getRandomValues(arr);const key=Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');document.getElementById('mwr-private-key').value=key}
function copyPrivateKey(){const v=document.getElementById('mwr-private-key').value;if(!v){showToast('No key to copy','error');return}navigator.clipboard.writeText(v).then(()=>showToast('Copied to clipboard','success')).catch(()=>showToast('Copy failed','error'))}
async function saveApiKeys(){const private_key=document.getElementById('mwr-private-key').value;const mwr_api_key=document.getElementById('mwr-api-key').value;try{const r=await fetch('/api/admin/settings/integrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({private_key,mwr_api_key})});if(r.ok){showToast('API keys saved','success')}else{showToast('Save failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}`;
  return settingsPage(user, 'Integrations - Settings', bc('Integrations'), content, [script]);
}

export function renderSettingsNotifications(user, config = {}) {
  const t = config.thresholds || {};
  const rfi = t.rfi || {};
  const notif = t.notification || {};
  const togRowLocal = tg => `<div class="flex justify-between items-center py-3 border-b border-base-200"><div><div class="text-sm font-semibold">${tg.label}</div><div class="text-xs text-base-content/70">${tg.desc}</div></div><input type="checkbox" name="${tg.id}" ${tg.checked ? 'checked' : ''} class="checkbox checkbox-primary"/></div>`;
  const toggles = [
    { id: 'rfi_reminders', label: 'RFI Reminders', desc: 'Send reminders for outstanding RFIs', checked: true },
    { id: 'deadline_alerts', label: 'Deadline Alerts', desc: 'Alert when deadlines are approaching', checked: true },
    { id: 'stage_transitions', label: 'Stage Transitions', desc: 'Notify on engagement stage changes', checked: true },
    { id: 'new_messages', label: 'New Messages', desc: 'Notify when new messages are received', checked: true },
    { id: 'weekly_reports', label: 'Weekly Reports', desc: 'Send weekly summary reports', checked: true },
  ];
  const triggerDialog = `<div id="notif-trigger-dialog" class="modal" style="display:none" role="dialog" aria-modal="true" aria-labelledby="notif-trigger-dialog-title">
    <div class="modal-overlay" data-dialog-close="notif-trigger-dialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 id="notif-trigger-dialog-title" class="text-lg font-semibold mb-4">Add Notification Trigger</h3>
      <div class="form-group mb-3"><label class="form-label">Trigger Type</label><select id="ntd-type" class="form-input"><option value="before">Before</option><option value="after">After</option></select></div>
      <div class="form-group mb-3"><label class="form-label">Days</label><input id="ntd-days" type="number" min="0" max="365" value="7" class="form-input"/></div>
      <div class="form-group mb-3"><label class="form-label">Reference Date</label><select id="ntd-ref" class="form-input"><option value="commencement_date">Commencement Date</option><option value="deadline_date">Deadline Date</option></select></div>
      <div class="form-group mb-3"><label class="form-label">Recipient</label><select id="ntd-recipient" class="form-input"><option value="client_admin">Client Admin</option><option value="client_user">Client User</option><option value="team_manager">Team Manager</option><option value="team_clerk">Team Clerk</option><option value="partner">Partner</option></select></div>
      <div class="form-group mb-4"><label class="flex items-center gap-2"><input id="ntd-active" type="checkbox" class="checkbox" checked/><span class="text-sm">Active</span></label></div>
      <div class="modal-action"><button data-action="saveNotifTrigger" class="btn btn-primary btn-sm">Save Trigger</button><button data-dialog-close="notif-trigger-dialog" class="btn btn-ghost btn-sm">Cancel</button></div>
    </div>
  </div>`;
  const content = `${settingsBack()}<h1 class="text-2xl font-bold mb-6">Notifications</h1>
    <form id="notif-form"><div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-2">Notification Toggles</h2>${toggles.map(togRowLocal).join('')}</div></div>
      <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-4">Configuration</h2>
        <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">RFI Notification Days</span></label><input type="text" name="notification_days" class="input input-solid max-w-full" value="${(rfi.notification_days || [7,3,1,0]).join(', ')}"/></div>
        <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Escalation Delay (hours)</span></label><input type="number" name="escalation_delay_hours" class="input input-solid max-w-full" value="${rfi.escalation_delay_hours || 24}"/></div>
        <div class="form-group"><label class="label"><span class="label-text font-semibold">Batch Size</span></label><input type="number" name="batch_size" class="input input-solid max-w-full" value="${notif.batch_size || 50}"/></div>
      </div></div>
    </div><button type="submit" class="btn btn-primary">Save Settings</button></form>
    <div class="flex justify-between items-center mt-8 mb-4">
      <h2 class="text-lg font-semibold">Engagement Notification Triggers</h2>
      <button data-action="openNotifTriggerDialog" class="btn btn-primary btn-sm">+ Add Trigger</button>
    </div>
    <div class="card-clean"><div class="card-clean-body" style="padding:0">
      <div class="table-wrap"><table class="data-table" id="triggers-table">
        <thead><tr><th>Type</th><th>Days</th><th>Reference</th><th>Recipient</th><th>Status</th><th></th></tr></thead>
        <tbody id="triggers-tbody"><tr><td colspan="6" class="text-center py-8 text-base-content/70 text-sm">Loading...</td></tr></tbody>
      </table></div>
    </div></div>
    ${triggerDialog}`;
  const script = `${TOAST_SCRIPT}
document.getElementById('notif-form').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);const data={};for(const[k,v]of fd.entries())data[k]=v;document.querySelectorAll('#notif-form input[type=checkbox]').forEach(cb=>{data[cb.name]=cb.checked});try{const res=await fetch('/api/admin/settings/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(res.ok){showToast('Settings saved','success')}else{showToast('Save failed','error')}}catch(err){showToast('Error: '+err.message,'error')}});
function _esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
async function loadTriggers(){const tbody=document.getElementById('triggers-tbody');try{const r=await fetch('/api/friday/engagement/notifications');const d=await r.json();const rows=d.data||[];tbody.innerHTML=rows.length?rows.map(function(t){return'<tr><td class="text-sm">'+_esc(t.trigger_type)+'</td><td class="text-sm">'+_esc(t.trigger_days)+' days</td><td class="text-sm">'+_esc(t.trigger_reference)+'</td><td class="text-sm">'+_esc(t.recipient_type)+'</td><td>'+(t.active?'<span class="badge badge-flat-success text-xs">Active</span>':'<span class="badge badge-flat-secondary text-xs">Inactive</span>')+'</td><td><button class="btn btn-ghost btn-xs" data-action="deleteNotifTrigger" data-args=\\'["\\'+encodeURIComponent(t.id)+\\'"]\\'>Delete</button></td></tr>'}).join(''):'<tr><td colspan="6" class="text-center py-8 text-base-content/70 text-sm">No triggers configured</td></tr>'}catch(e){tbody.innerHTML='<tr><td colspan="6" class="text-center py-4 text-error text-sm">Failed to load</td></tr>'}}
function openNotifTriggerDialog(){document.getElementById('notif-trigger-dialog').style.display='flex'}
async function saveNotifTrigger(){const type=document.getElementById('ntd-type').value;const days=Number(document.getElementById('ntd-days').value);const ref=document.getElementById('ntd-ref').value;const recipient=document.getElementById('ntd-recipient').value;const active=document.getElementById('ntd-active').checked;if(!days&&days!==0){showToast('Enter number of days','error');return}try{const r=await fetch('/api/friday/engagement/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trigger_type:type,trigger_days:days,trigger_reference:ref,recipient_type:recipient,active})});if(r.ok){showToast('Trigger added','success');document.getElementById('notif-trigger-dialog').style.display='none';loadTriggers()}else{const d=await r.json();showToast(d.message||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}
async function deleteNotifTrigger(id){if(!(await window.gmConfirm({title:'Please confirm',message:'Delete this trigger?',danger:true,confirmLabel:'OK'})))return;try{const r=await fetch('/api/friday/engagement/notifications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(r.ok){showToast('Deleted','success');loadTriggers()}else showToast('Delete failed','error')}catch(e){showToast('Error','error')}}
loadTriggers();`;
  return settingsPage(user, 'Notifications - Settings', bc('Notifications'), content, [script]);
}

export function renderSettingsReviewSettings(user, config = {}) {
  const review = config.review || {};
  const toggles = [
    { id: 'auto_save', label: 'Auto-save', desc: 'Automatically save review changes', checked: review.auto_save !== false },
    { id: 'highlight_notifications', label: 'Highlight Notifications', desc: 'Notify on new highlights', checked: review.highlight_notifications !== false },
    { id: 'require_resolution', label: 'Require Resolution', desc: 'All highlights resolved before closing', checked: !!review.require_resolution },
    { id: 'allow_private', label: 'Allow Private Reviews', desc: 'Enable private review visibility', checked: review.allow_private !== false },
    { id: 'enable_sections', label: 'Enable Sections', desc: 'Allow reviews organized into sections', checked: review.enable_sections !== false },
    { id: 'enable_wip_value', label: 'Enable WIP Value', desc: 'Track work-in-progress value', checked: !!review.enable_wip_value },
  ];
  const content = `${settingsBack()}<h1 class="text-2xl font-bold mb-6">Review Settings</h1>
    <form id="review-settings-form"><div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-2">Review Options</h2>${toggles.map(togRow).join('')}</div></div>
      <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-4">Defaults</h2>
        <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Default Status</span></label><select name="default_status" class="select select-solid max-w-full"><option value="active" ${review.default_status==='active'?'selected':''}>Active</option><option value="draft" ${review.default_status==='draft'?'selected':''}>Draft</option></select></div>
        <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Max Highlights Per Review</span></label><input type="number" name="max_highlights" class="input input-solid max-w-full" value="${review.max_highlights || 500}" min="1"/></div>
        <div class="form-group"><label class="label"><span class="label-text font-semibold">Default Currency</span></label><select name="default_currency" class="select select-solid max-w-full"><option value="ZAR" ${!review.default_currency||review.default_currency==='ZAR'?'selected':''}>ZAR</option><option value="USD" ${review.default_currency==='USD'?'selected':''}>USD</option><option value="EUR" ${review.default_currency==='EUR'?'selected':''}>EUR</option><option value="GBP" ${review.default_currency==='GBP'?'selected':''}>GBP</option></select></div>
      </div></div>
    </div><button type="submit" class="btn btn-primary">Save Review Settings</button></form>`;
  const script = `${TOAST_SCRIPT}document.getElementById('review-settings-form').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);const data={};for(const[k,v]of fd.entries())data[k]=v;document.querySelectorAll('#review-settings-form input[type=checkbox]').forEach(cb=>{data[cb.name]=cb.checked});document.querySelectorAll('#review-settings-form input[type=number]').forEach(n=>{if(data[n.name])data[n.name]=Number(data[n.name])});try{const res=await fetch('/api/admin/settings/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(res.ok){showToast('Settings saved','success')}else{showToast('Save failed','error')}}catch(e){showToast('Error: '+e.message,'error')}})`;
  return settingsPage(user, 'Review Settings', bc('Review Settings'), content, [script]);
}

export function renderSettingsFileReview(user, config = {}, frSettings = {}) {
  const fr = config.fileReview || {};
  const reviewFlags = frSettings.review_flags || [];
  const tenderFlags = frSettings.tender_flags || [];
  const flagManagers = frSettings.flags_managers || [];
  const tempAccess = frSettings.temp_review_access_period || 0;
  const toggles = [
    { id: 'auto_pdf_cache', label: 'Auto-cache PDFs', desc: 'Cache PDF files for faster loading', checked: fr.auto_pdf_cache !== false },
    { id: 'allow_annotations', label: 'Allow Annotations', desc: 'Enable PDF annotation tools', checked: fr.allow_annotations !== false },
    { id: 'mobile_resize', label: 'Mobile Resize', desc: 'Enable mobile-friendly resizable highlights', checked: fr.mobile_resize !== false },
    { id: 'coordinate_snap', label: 'Coordinate Snap', desc: 'Snap highlight coordinates to text boundaries', checked: !!fr.coordinate_snap },
  ];
  const flagChips = (flags, type) => flags.map(f => `<span class="pill pill-neutral" style="display:inline-flex;align-items:center;gap:4px">${esc(f)}<button type="button" data-action="removeFlag" data-args='${esc(JSON.stringify([type, f]))}' aria-label="Remove flag" style="background:none;border:none;cursor:pointer;line-height:1;color:inherit;display:inline-flex">${icon('close',16)}</button></span>`).join('');
  const content = `${settingsBack()}<h1 class="text-2xl font-bold mb-6">File Review Settings</h1>
  <div id="fr-review-flags" data-flags='${JSON.stringify(reviewFlags)}'></div>
  <div id="fr-tender-flags" data-flags='${JSON.stringify(tenderFlags)}'></div>
  <form id="file-review-settings-form">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-2">File Review Options</h2>${toggles.map(togRow).join('')}</div></div>
    <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-4">Access &amp; Limits</h2>
      <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Temp Access Period (days)</span></label><input type="number" name="temp_review_access_period" class="input input-solid max-w-full" value="${tempAccess}" min="0"/></div>
      <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Max File Size (MB)</span></label><input type="number" name="max_file_size_mb" class="input input-solid max-w-full" value="${fr.max_file_size_mb || 50}" min="1"/></div>
      <div class="form-group"><label class="label"><span class="label-text font-semibold">Allowed File Types</span></label><input type="text" name="allowed_types" class="input input-solid max-w-full" value="${fr.allowed_types || 'pdf,doc,docx,xls,xlsx,png,jpg'}"/></div>
    </div></div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-3">Review Flags</h2>
      <div id="review-flags-list" class="flex flex-wrap gap-2 mb-3">${flagChips(reviewFlags, 'review')}</div>
      <div class="flex gap-2"><input type="text" id="new-review-flag" class="input input-solid" placeholder="New flag label..." style="flex:1"/><button type="button" data-action="addFlag" data-args='["review"]' class="btn btn-primary btn-sm">Add</button></div>
    </div></div>
    <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-3">Tender Flags</h2>
      <div id="tender-flags-list" class="flex flex-wrap gap-2 mb-3">${flagChips(tenderFlags, 'tender')}</div>
      <div class="flex gap-2"><input type="text" id="new-tender-flag" class="input input-solid" placeholder="New flag label..." style="flex:1"/><button type="button" data-action="addFlag" data-args='["tender"]' class="btn btn-primary btn-sm">Add</button></div>
    </div></div>
  </div>
  <button type="submit" class="btn btn-primary">Save File Review Settings</button></form>`;
  const script = `${TOAST_SCRIPT}
var _rvFlags=${JSON.stringify(reviewFlags)};
var _tdFlags=${JSON.stringify(tenderFlags)};
function _escFlag(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function renderFlags(type){const list=type==='review'?_rvFlags:_tdFlags;const el=document.getElementById(type+'-flags-list');if(!el)return;el.innerHTML=list.map(f=>'<span class="pill pill-neutral" style="display:inline-flex;align-items:center;gap:4px">'+_escFlag(f)+'<button type="button" data-action="removeFlag" data-args=\\''+_escFlag(JSON.stringify([type,f]))+'\\' aria-label="Remove flag" style="background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;color:inherit">&times;</button></span>').join('')}
window.addFlag=function(type){const inp=document.getElementById('new-'+type+'-flag');const val=(inp?.value||'').trim();if(!val)return;if(type==='review'){_rvFlags=[..._rvFlags,val]}else{_tdFlags=[..._tdFlags,val]};inp.value='';renderFlags(type)};
window.removeFlag=function(type,flag){if(type==='review'){_rvFlags=_rvFlags.filter(f=>f!==flag)}else{_tdFlags=_tdFlags.filter(f=>f!==flag)};renderFlags(type)};
document.getElementById('file-review-settings-form').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);const data={};for(const[k,v]of fd.entries())data[k]=v;document.querySelectorAll('#file-review-settings-form input[type=checkbox]').forEach(cb=>{data[cb.name]=cb.checked});document.querySelectorAll('#file-review-settings-form input[type=number]').forEach(n=>{if(data[n.name])data[n.name]=Number(data[n.name])});data.review_flags=_rvFlags;data.tender_flags=_tdFlags;try{const res=await fetch('/api/admin/settings/file-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(res.ok){showToast('Settings saved','success')}else{showToast('Save failed','error')}}catch(err){showToast('Error: '+err.message,'error')}})`;
  return settingsPage(user, 'File Review Settings', bc('File Review Settings'), content, [script]);
}

export function renderSettingsMwrPermissions(user, permissions = []) {
  const rows = permissions.map(p => `<tr>
    <td class="text-sm">${esc(p.entity_type||'-')}</td>
    <td class="text-sm">${esc(p.entity_id||'-')}</td>
    <td class="text-sm">${esc(p.user_id||'-')}</td>
    <td class="text-sm">${esc(p.permission_type||'-')}</td>
    <td class="text-sm">${p.granted_at ? new Date(p.granted_at * 1000).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</td>
    <td><button type="button" class="btn btn-error btn-xs btn-outline" data-action="revokePermission" data-args='${esc(JSON.stringify([p.id]))}'>Revoke</button></td>
  </tr>`).join('');
  const content = `${settingsBack()}<div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">MWR Permissions</h1>
    <button class="btn btn-primary btn-sm" data-action="openDialog" data-args='["grant-perm-dialog"]'>+ Grant Permission</button>
  </div>
  ${inlineTable(['Entity Type','Entity ID','User ID','Permission','Granted','Actions'], rows, 'No permissions configured')}
  <div id="grant-perm-dialog" class="dialog-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="gp-dialog-title" data-dialog-close="grant-perm-dialog">
    <div class="dialog-panel" style="max-width:min(460px,90vw)">
      <div class="dialog-header"><span class="dialog-title" id="gp-dialog-title">Grant Permission</span><button class="dialog-close" data-dialog-close="grant-perm-dialog" aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label>Entity Type</label><input id="gp-entity-type" class="form-input" placeholder="e.g. review"/></div>
        <div class="modal-form-group"><label>Entity ID</label><input id="gp-entity-id" class="form-input" placeholder="e.g. 1a2b3c"/></div>
        <div class="modal-form-group"><label>User ID</label><input id="gp-user-id" class="form-input" placeholder="e.g. user_42"/></div>
        <div class="modal-form-group"><label>Permission Type</label><select id="gp-perm-type" class="form-input"><option value="view">view</option><option value="edit">edit</option><option value="admin">admin</option></select></div>
        <div id="gp-result" style="display:none;margin-top:8px"></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" data-dialog-close="grant-perm-dialog">Cancel</button>
        <button class="btn btn-primary btn-sm" data-action="grantPermission">Grant</button>
      </div>
    </div>
  </div>`;
  const script = `${TOAST_SCRIPT}window.grantPermission=async function(){var body={entity_type:document.getElementById('gp-entity-type').value.trim(),entity_id:document.getElementById('gp-entity-id').value.trim(),user_id:document.getElementById('gp-user-id').value.trim(),permission_type:document.getElementById('gp-perm-type').value};var res=document.getElementById('gp-result');if(!body.entity_type||!body.entity_id||!body.user_id){res.style.display='block';res.innerHTML='<div style="color:var(--color-danger);font-size:13px">All fields required.</div>';return}try{var r=await fetch('/api/mwr/permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var d=await r.json();if(r.ok&&d.success){showToast('Permission granted','success');(window.closeDialog?window.closeDialog('grant-perm-dialog'):document.getElementById('grant-perm-dialog').style.display='none');setTimeout(function(){location.reload()},500)}else{res.style.display='block';res.innerHTML='<div style="color:var(--color-danger);font-size:13px">'+(d.error||'Failed')+'</div>'}}catch(e){showToast('Error: '+e.message,'error')}};window.revokePermission=async function(id){if(!(await window.gmConfirm({title:'Revoke permission',message:'Revoke this permission?',confirmLabel:'Revoke',danger:true})))return;try{var r=await fetch('/api/permission/'+id,{method:'DELETE'});if(r.ok){showToast('Revoked','success');setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}`;
  return settingsPage(user, 'MWR Permissions', bc('MWR Permissions'), content, [script]);
}
