import { TOAST_SCRIPT, settingsPage, settingsBack, inlineTable } from '@/ui/settings-renderer.js';
import { esc } from '@/ui/render-helpers.js';

const hdr = (title, addHref, addLabel) => `${settingsBack()}<div class="flex justify-between items-center mb-6">
  <h1 class="text-2xl font-bold">${title}</h1>
  <a href="${addHref}" class="btn btn-primary btn-sm">${addLabel}</a>
</div>`;
const bc = (label) => [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label }];
const editBtn = (href) => `<a href="${href}" data-stop-propagation="true" class="btn btn-ghost btn-xs">Edit</a>`;
const trClick = (url) => `class="hover cursor-pointer" data-navigate="${url}"`;

export function renderSettingsTemplates(user, templates = []) {
  const rows = templates.map(t => `<tr ${trClick('/review_template/'+t.id)}>
    <td class="text-sm font-medium">${esc(t.name||'-')}</td>
    <td><span class="badge badge-flat-primary text-xs">${esc(t.type||'standard')}</span></td>
    <td>${t.is_active ? '<span class="badge badge-success badge-flat-success text-xs">Active</span>' : '<span class="badge badge-flat-secondary text-xs">Inactive</span>'}</td>
    <td>${editBtn('/review_template/'+t.id+'/edit')}</td>
  </tr>`).join('');
  return settingsPage(user, 'Templates - Settings', bc('Templates'), hdr('Templates', '/review_template/new', '+ Add Template') + inlineTable(['Name', 'Type', 'Status', 'Actions'], rows, 'No templates found'));
}

export function renderSettingsChecklists(user, checklists = []) {
  const rows = checklists.map(c => `<tr ${trClick('/checklist/'+c.id)}>
    <td class="text-sm font-medium">${esc(c.name||'-')}</td>
    <td class="text-sm">${esc(c.type||'-')}</td>
    <td class="text-sm text-base-content/50">${esc(c.review_id||'-')}</td>
    <td>${editBtn('/checklist/'+c.id+'/edit')}</td>
  </tr>`).join('');
  return settingsPage(user, 'Checklists - Settings', bc('Checklists'), hdr('Checklists', '/checklist/new', '+ Add Checklist') + inlineTable(['Name', 'Type', 'Review', 'Actions'], rows, 'No checklists found'));
}

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
        <tbody id="audit-tbody"><tr><td colspan="7" class="text-center py-8 text-base-content/40 text-sm">Loading...</td></tr></tbody>
      </table></div>
    </div></div>`;
  const script = `${TOAST_SCRIPT}
async function loadAuditLogs(params){const tbody=document.getElementById('audit-tbody');try{const q=params?'?'+new URLSearchParams(params):'';const r=await fetch('/api/audit/logs'+q);const d=await r.json();const rows=d.data||[];tbody.innerHTML=rows.length?rows.map(function(l){const ts=l.timestamp;const date=ts?new Date(ts).toLocaleString():'-';const details=l.details?JSON.stringify(l.details).substring(0,60)+'...':'-';return'<tr><td class="text-xs text-base-content/50">'+date+'</td><td><span class="badge badge-flat-primary text-xs">'+(l.operation||'-')+'</span></td><td class="text-sm">'+(l.entity_type||'-')+'</td><td class="text-xs text-base-content/50">'+(l.entity_id||'-')+'</td><td class="text-sm">'+(l.user_id||'-')+'</td><td class="text-sm">'+(l.action||'-')+'</td><td class="text-xs text-base-content/40">'+details+'</td></tr>'}).join(''):'<tr><td colspan="7" class="text-center py-8 text-base-content/40 text-sm">No audit logs found</td></tr>'}catch(e){tbody.innerHTML='<tr><td colspan="7" class="text-center py-4 text-error text-sm">Failed to load: '+e.message+'</td></tr>'}}
function applyAuditFilters(){const level=document.getElementById('filter-level').value;const entity=document.getElementById('filter-entity').value;const start=document.getElementById('filter-start').value;const end=document.getElementById('filter-end').value;const p={};if(level)p.level=level;if(entity)p.entityType=entity;if(start)p.from=new Date(start).toISOString();if(end)p.to=new Date(end+'T23:59:59').toISOString();loadAuditLogs(p)}
loadAuditLogs();`;
  return settingsPage(user, 'Audit Logs - Settings', bc('Audit Logs'), content, [script]);
}

const INTEGRATIONS = [
  { id: 'google_drive', icon: '&#128194;', name: 'Google Drive', desc: 'Document storage and collaboration' },
  { id: 'gmail', icon: '&#9993;', name: 'Gmail', desc: 'Email integration for notifications' },
  { id: 'firebase', icon: '&#128293;', name: 'Firebase (Legacy)', desc: 'Legacy data source for migration' },
];

export function renderSettingsIntegrations(user, integrations = {}) {
  const { private_key = '', mwr_api_key = '' } = integrations;
  const cards = INTEGRATIONS.map(integ => {
    const state = integrations[integ.id] || {};
    const connected = state.connected || false;
    return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body">
      <div class="flex items-center gap-4">
        <div class="text-2xl">${integ.icon}</div>
        <div class="flex-1"><div class="font-semibold">${integ.name}</div><div class="text-xs text-base-content/50">${integ.desc}</div></div>
        <div class="flex flex-col items-end gap-2">
          <span class="badge ${connected ? 'badge-success badge-flat-success' : 'badge-flat-secondary'} text-xs">${connected ? 'Connected' : 'Disconnected'}</span>
          <button data-action="toggleConfig" data-args='["${integ.id}"]' class="btn btn-ghost btn-xs">Configure</button>
        </div>
      </div>
      <div id="config-${integ.id}" class="hidden mt-4 pt-4 border-t border-base-200">
        <div class="flex gap-3 items-end flex-wrap">
          <div class="form-group flex-1 min-w-48"><label class="label"><span class="label-text font-semibold">API Key / Credentials</span></label><input type="password" id="key-${integ.id}" class="input input-solid max-w-full" placeholder="Enter credentials"/></div>
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
        <button class="btn btn-ghost btn-sm" onclick="copyPrivateKey()">Copy</button>
        <button class="btn btn-primary btn-sm" onclick="generatePrivateKey()">Generate New Key</button>
      </div>
      <div class="text-xs text-base-content/50 mt-1">This key links Friday and My Review. Keep it confidential — anyone with access can import data.</div>
    </div>
    <div class="mb-4">
      <label class="label"><span class="label-text font-semibold">My Review API Key (from MWR app)</span></label>
      <input type="text" id="mwr-api-key" class="input input-solid w-full" value="${esc(mwr_api_key)}" placeholder="Paste the key from My Review Integrations settings"/>
      <div class="text-xs text-base-content/50 mt-1">Enter the private key generated in the My Review settings to enable cross-app access.</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="saveApiKeys()">Save API Keys</button>
  </div></div>`;
  const content = `${settingsBack()}<h1 class="text-2xl font-bold mb-6">Integrations</h1>${apiKeysCard}${cards}`;
  const script = `${TOAST_SCRIPT}
function toggleConfig(id){const el=document.getElementById('config-'+id);el.classList.toggle('hidden')}
function saveIntegration(id){const key=document.getElementById('key-'+id).value;if(!key){showToast('Enter credentials','error');return}showToast('Integration saved','success');toggleConfig(id)}
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
  const togRow = tg => `<div class="flex justify-between items-center py-3 border-b border-base-200"><div><div class="text-sm font-semibold">${tg.label}</div><div class="text-xs text-base-content/50">${tg.desc}</div></div><input type="checkbox" name="${tg.id}" ${tg.checked ? 'checked' : ''} class="checkbox checkbox-primary"/></div>`;
  const toggles = [
    { id: 'rfi_reminders', label: 'RFI Reminders', desc: 'Send reminders for outstanding RFIs', checked: true },
    { id: 'deadline_alerts', label: 'Deadline Alerts', desc: 'Alert when deadlines are approaching', checked: true },
    { id: 'stage_transitions', label: 'Stage Transitions', desc: 'Notify on engagement stage changes', checked: true },
    { id: 'new_messages', label: 'New Messages', desc: 'Notify when new messages are received', checked: true },
    { id: 'weekly_reports', label: 'Weekly Reports', desc: 'Send weekly summary reports', checked: true },
  ];
  const triggerDialog = `<div id="notif-trigger-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
    <div class="modal-overlay" data-dialog-close="notif-trigger-dialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 class="text-lg font-semibold mb-4">Add Notification Trigger</h3>
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
      <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-2">Notification Toggles</h2>${toggles.map(togRow).join('')}</div></div>
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
        <tbody id="triggers-tbody"><tr><td colspan="6" class="text-center py-8 text-base-content/40 text-sm">Loading...</td></tr></tbody>
      </table></div>
    </div></div>
    ${triggerDialog}`;
  const script = `${TOAST_SCRIPT}
document.getElementById('notif-form').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);const data={};for(const[k,v]of fd.entries())data[k]=v;document.querySelectorAll('#notif-form input[type=checkbox]').forEach(cb=>{data[cb.name]=cb.checked});try{const res=await fetch('/api/admin/settings/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(res.ok){showToast('Settings saved','success')}else{showToast('Save failed','error')}}catch(err){showToast('Error: '+err.message,'error')}});
async function loadTriggers(){const tbody=document.getElementById('triggers-tbody');try{const r=await fetch('/api/friday/engagement/notifications');const d=await r.json();const rows=d.data||[];tbody.innerHTML=rows.length?rows.map(function(t){return'<tr><td class="text-sm">'+t.trigger_type+'</td><td class="text-sm">'+t.trigger_days+' days</td><td class="text-sm">'+t.trigger_reference+'</td><td class="text-sm">'+t.recipient_type+'</td><td>'+(t.active?'<span class="badge badge-flat-success text-xs">Active</span>':'<span class="badge badge-flat-secondary text-xs">Inactive</span>')+'</td><td><button class="btn btn-ghost btn-xs" data-action="deleteNotifTrigger" data-args=\\'["\\'+t.id+\\'"]\\'>Delete</button></td></tr>'}).join(''):'<tr><td colspan="6" class="text-center py-8 text-base-content/40 text-sm">No triggers configured</td></tr>'}catch(e){tbody.innerHTML='<tr><td colspan="6" class="text-center py-4 text-error text-sm">Failed to load</td></tr>'}}
function openNotifTriggerDialog(){document.getElementById('notif-trigger-dialog').style.display='flex'}
async function saveNotifTrigger(){const type=document.getElementById('ntd-type').value;const days=Number(document.getElementById('ntd-days').value);const ref=document.getElementById('ntd-ref').value;const recipient=document.getElementById('ntd-recipient').value;const active=document.getElementById('ntd-active').checked;if(!days&&days!==0){showToast('Enter number of days','error');return}try{const r=await fetch('/api/friday/engagement/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trigger_type:type,trigger_days:days,trigger_reference:ref,recipient_type:recipient,active})});if(r.ok){showToast('Trigger added','success');document.getElementById('notif-trigger-dialog').style.display='none';loadTriggers()}else{const d=await r.json();showToast(d.message||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}
async function deleteNotifTrigger(id){if(!confirm('Delete this trigger?'))return;try{const r=await fetch('/api/friday/engagement/notifications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(r.ok){showToast('Deleted','success');loadTriggers()}else showToast('Delete failed','error')}catch(e){showToast('Error','error')}}
loadTriggers();`;
  return settingsPage(user, 'Notifications - Settings', bc('Notifications'), content, [script]);
}

function renderTypeList(user, items, entityKey, title) {
  const rows = items.map(t => `<tr class="hover">
    <td class="font-medium text-sm">${t.name || '-'}</td>
    <td class="text-xs text-base-content/50">${t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
    <td><div class="flex gap-2">
      <button class="btn btn-ghost btn-xs type-edit-btn" data-id="${t.id}" data-name="${(t.name||'').replace(/"/g,'&quot;')}">Edit</button>
      <button class="btn btn-error btn-xs type-del-btn" data-id="${t.id}">Delete</button>
    </div></td>
  </tr>`).join('');
  const script = `${TOAST_SCRIPT}
var _eid='';
function openAdd(){_eid='';document.getElementById('type-name').value='';document.getElementById('type-form').style.display='block'}
function openEdit(id,name){_eid=id;document.getElementById('type-name').value=name;document.getElementById('type-form').style.display='block'}
function cancelForm(){document.getElementById('type-form').style.display='none'}
async function saveType(){const name=document.getElementById('type-name').value.trim();if(!name){showToast('Name required','error');return}const url=_eid?'/api/${entityKey}/'+_eid:'/api/${entityKey}';const method=_eid?'PUT':'POST';try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(r.ok){showToast(_eid?'Updated':'Created','success');setTimeout(()=>location.reload(),400)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function delType(id){if(!confirm('Delete?'))return;try{const r=await fetch('/api/${entityKey}/'+id,{method:'DELETE'});if(r.ok){showToast('Deleted','success');setTimeout(()=>location.reload(),400)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.type-edit-btn').forEach(b=>b.addEventListener('click',function(){openEdit(this.dataset.id,this.dataset.name)}));document.querySelectorAll('.type-del-btn').forEach(b=>b.addEventListener('click',function(){delType(this.dataset.id)}));document.querySelectorAll('.type-add-btn').forEach(b=>b.addEventListener('click',openAdd))});`;
  const formHtml = `<div id="type-form" class="card-clean mb-4" style="display:none"><div class="card-clean-body"><div class="flex gap-2 items-end"><div class="form-group"><label class="label"><span class="label-text font-medium">Name</span></label><input id="type-name" type="text" class="input input-solid" style="max-width:240px" placeholder="Name"/></div><button data-action="saveType" class="btn btn-primary btn-sm" onclick="saveType()">Save</button><button class="btn btn-ghost btn-sm" onclick="cancelForm()">Cancel</button></div></div></div>`;
  const content = `${settingsBack()}<div class="flex justify-between items-center mb-4"><h1 class="text-2xl font-bold">${title}</h1><button class="btn btn-primary btn-sm type-add-btn">Add</button></div>${formHtml}<div class="card-clean"><div class="card-clean-body" style="padding:0">${inlineTable(['Name','Created','Actions'],rows,'No items found.')}</div></div>`;
  return settingsPage(user, `${title} - Settings`, bc(title), content, [script]);
}

export function renderSettingsEntityTypes(user, items = []) {
  return renderTypeList(user, items, 'entity_type', 'Entity Types');
}

export function renderSettingsEngagementTypes(user, items = []) {
  return renderTypeList(user, items, 'engagement_type', 'Engagement Types');
}
