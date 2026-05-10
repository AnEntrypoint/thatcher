import { canCreate, canEdit } from '@/ui/permissions-ui.js';
import { page } from '@/ui/layout.js';
import { esc, statusBadge, TOAST_SCRIPT, TABLE_SCRIPT } from '@/ui/render-helpers.js';
import { SPACING } from '@/ui/spacing-system.js';

const RISK_LEVELS = [
  { value: 'low',      label: 'Low',      cls: 'badge-success badge-flat-success' },
  { value: 'medium',   label: 'Medium',   cls: 'badge-warning badge-flat-warning' },
  { value: 'high',     label: 'High',     cls: 'badge-error badge-flat-error' },
  { value: 'critical', label: 'Critical', cls: 'badge-error' },
];

export function renderClientList(user, clients) {
  const addBtn = canCreate(user, 'client')
    ? `<a href="/client/new" class="btn-primary-clean"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Client</a>`
    : '';
  const rows = (clients || []).map(c => {
    const sp = (c.status || 'active') === 'active' ? '<span class="pill pill-success">Active</span>' : '<span class="pill pill-neutral">Inactive</span>';
    return `<tr data-row data-navigate="/client/${esc(c.id)}" style="cursor:pointer">
      <td data-col="code" style="font-weight:600;color:var(--color-info)">${esc(c.client_code || c.code || '-')}</td>
      <td data-col="name"><strong>${esc(c.name || '-')}</strong></td>
      <td data-col="type">${esc(c.entity_type || c.industry || '-')}</td>
      <td data-col="email">${esc(Array.isArray(c.master_emails) ? c.master_emails[0] : (c.email || '-'))}</td>
      <td data-col="status">${sp}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5"><div class="empty-state"><svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><div class="empty-state-title">No clients found</div><div class="empty-state-desc">Add your first client to get started.</div></div></td></tr>`;

  const content = `<div class="page-header">
      <div><h1 class="page-title">Clients</h1><p class="page-subtitle">${(clients||[]).length} clients</p></div>
      ${addBtn}
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <div class="table-search"><input id="search-input" type="text" placeholder="Search clients..."></div>
        <div class="table-filter"><select data-filter="status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        <span class="table-count" id="row-count">${(clients||[]).length} items</span>
      </div>
      <table class="data-table">
        <thead><tr><th data-sort="code">Code</th><th data-sort="name">Name</th><th data-sort="type">Industry</th><th data-sort="email">Email</th><th data-sort="status">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  return page(user, 'Clients | Moonlanding', null, content, [TABLE_SCRIPT]);
}

export function renderClientDashboard(user, client, stats = {}) {
  const c = client || {};
  const riskLevel = RISK_LEVELS.find(r => r.value === c.risk_level);
  const riskCls = riskLevel?.cls || 'badge-flat-secondary';
  const riskBadge = c.risk_level ? `<span class="badge ${riskCls}">${riskLevel?.label || c.risk_level} Risk</span>` : '';

  const infoRows = [
    ['Name', esc(c.name || '-')],
    ['Email', c.email ? `<a href="mailto:${esc(c.email)}" style="color:var(--color-info)">${esc(c.email)}</a>` : '-'],
    ['Phone', c.phone ? `<a href="tel:${esc(c.phone)}" style="color:var(--color-info)">${esc(c.phone)}</a>` : '-'],
    ['Industry', esc(c.industry || '-')],
    ['Address', esc(c.address || '-')],
    ['Status', statusBadge(c.status || 'active')],
    ['Client Code', c.client_code ? `<code style="font-size:12px;background:var(--color-bg);padding:2px 8px;border-radius:4px">${esc(c.client_code)}</code>` : '-'],
    ['Created', c.created_at ? new Date(typeof c.created_at === 'number' ? c.created_at * 1000 : c.created_at).toLocaleDateString() : '-'],
  ].map(([l, v]) => `<div class="detail-row">
    <span class="detail-row-label">${l}</span>
    <span class="detail-row-value">${v}</span>
  </div>`).join('');

   const mkStat = (icon, value, label) => `<div class="card-clean"><div class="card-clean-body" style="padding:${SPACING.md}"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${SPACING.xs}"><span style="font-size:1.4rem">${icon}</span><span style="font-size:1.8rem;font-weight:700">${value}</span></div><div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-muted)">${label}</div></div></div>`;
   const statsHtml = `<div class="client-stats-grid">${mkStat('📁',stats.engagements||0,'Engagements')}${mkStat('📋',stats.activeRfis||0,'Active RFIs')}${mkStat('👤',stats.users||0,'Users')}${mkStat('📄',stats.reviews||0,'Reviews')}</div>`;

  const engRows = (stats.engagementList || []).map(e => `<tr class="hover cursor-pointer" data-navigate="/engagement/${e.id}"><td class="text-sm font-medium">${esc(e.name || '-')}</td><td>${statusBadge(e.stage)}</td><td>${statusBadge(e.status)}</td></tr>`).join('') || `<tr><td colspan="3" style="text-align:center;padding:40px 16px;color:var(--color-text-muted)"><div style="display:flex;flex-direction:column;align-items:center;gap:8px"><span style="font-size:1.8rem">📁</span><span style="font-size:14px">No engagements yet</span>${canEdit(user, 'client') ? `<a href="/engagement/new?client_id=${esc(c.id)}" class="btn btn-primary btn-xs" style="margin-top:4px">+ New Engagement</a>` : ''}</div></td></tr>`;

  const canEditClient = canEdit(user, 'client');
  const statusToggleBtn = canEditClient ? (c.status === 'inactive' ? `<button onclick="reactivateClient('${esc(c.id)}')" class="btn btn-ghost btn-sm border border-base-300">Re-activate</button>` : `<button onclick="setClientInactive('${esc(c.id)}')" class="btn btn-ghost btn-sm border border-base-300" style="color:var(--color-danger)">Set Inactive</button>`) : '';
  const actions = canEditClient ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><a href="/client/${esc(c.id)}/edit" class="btn btn-primary btn-sm">Edit Client</a><button data-action="openDialog" data-params='{"dialogId":"risk-dialog"}' class="btn btn-ghost btn-sm border border-base-300">Risk Assessment</button><button data-action="openDialog" data-params='{"dialogId":"test-email-dialog"}' class="btn btn-ghost btn-sm border border-base-300">Test Email</button><button data-action="showClientUsers" class="btn btn-ghost btn-sm border border-base-300">Manage Users</button>${statusToggleBtn}</div>` : '';

  const userDialog = clientUserManagementDialog(c.id);
  const riskDialog = clientRiskAssessmentDialog(c.id, c.risk_level);
  const emailDialog = clientTestEmailDialog(c.id);

  const content = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${esc(c.name || 'Client')}</h1>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
          ${riskBadge}
          ${statusBadge(c.status || 'active')}
          ${c.client_code ? `<code style="font-size:12px;background:var(--color-bg);padding:2px 8px;border-radius:4px;color:var(--color-text-muted)">${esc(c.client_code)}</code>` : ''}
        </div>
      </div>
      <div class="page-actions">${actions}</div>
    </div>
    ${statsHtml}
     <div class="client-detail-grid">
      <div class="card-clean">
        <div class="card-clean-body">
           <h2 style="font-size:0.875rem;font-weight:600;margin-bottom:${SPACING.sm}">Client Info</h2>
          <div class="detail-grid" style="grid-template-columns:1fr">${infoRows}</div>
        </div>
      </div>
      <div class="card-clean">
        <div class="card-clean-body">
           <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md}">
             <h2 style="font-size:0.875rem;font-weight:600;margin-bottom:${SPACING.md}">Engagements</h2>
            ${canEditClient ? `<a href="/engagement/new?client_id=${esc(c.id)}" class="btn btn-primary btn-xs">+ New</a>` : ''}
          </div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Name</th><th>Stage</th><th>Status</th></tr></thead>
            <tbody>${engRows}</tbody>
          </table></div>
        </div>
      </div>
    </div>
    ${userDialog.html}${riskDialog.html}${emailDialog.html}`;

  const clientStatusScript = `async function setClientInactive(id){if(!confirm('Set this client as inactive?'))return;try{var r=await fetch('/api/friday/client/inactive',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({client_id:id})});var d=await r.json();if(r.ok||d.success){showToast('Client set inactive','success');setTimeout(function(){location.reload()},600)}else{showToast(d.error||d.message||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}async function reactivateClient(id){try{var r=await fetch('/api/client/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({status:'active'})});if(r.ok){showToast('Client reactivated','success');setTimeout(function(){location.reload()},600)}else{var d=await r.json();showToast(d.error||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}`;
  const bc = [{ href: '/', label: 'Home' }, { href: '/client', label: 'Clients' }, { label: c.name || 'Client' }];
  return page(user, `${c.name || 'Client'} - Dashboard`, bc, content, [TOAST_SCRIPT, userDialog.script, riskDialog.script, emailDialog.script, clientStatusScript]);
}

export function clientUserManagementDialog(clientId) {
  const html = `<div id="client-user-dialog" class="modal" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-labelledby="client-user-dialog-title" aria-hidden="true">
    <div class="modal-overlay" data-dialog-close="client-user-dialog"></div>
    <div class="modal-content rounded-box max-w-lg p-6">
      <h3 class="text-lg font-semibold mb-4" id="client-user-dialog-title">Manage Client Users</h3>
      <div id="cud-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1"><label class="form-label">Email</label><input type="email" id="cud-email" class="form-input" placeholder="user@example.com"/></div>
        <div><label class="form-label">Role</label><select id="cud-role" class="form-input"><option value="client_user">User</option><option value="client_admin">Admin</option></select></div>
        <button class="btn btn-primary btn-sm" data-action="cudAdd">Add</button>
      </div>
      <div class="modal-action mt-4"><button class="btn btn-ghost" data-dialog-close="client-user-dialog">Close</button></div>
    </div>
  </div>`;
  const script = `window.showClientUsers=function(){document.getElementById('client-user-dialog').style.display='flex';cudLoad()};
async function cudLoad(){var c=document.getElementById('cud-list');c.innerHTML='<div style="text-align:center;color:var(--color-text-muted);font-size:13px;padding:8px">Loading...</div>';try{var res=await fetch('/api/user?client_id=${clientId}');var d=await res.json();var users=d.data||d||[];c.innerHTML='';if(!users.length){c.innerHTML='<div style="text-align:center;color:var(--color-text-muted);font-size:13px;padding:8px">No client users</div>';return}users.forEach(function(u){var div=document.createElement('div');div.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--color-border)';div.innerHTML='<div><div style="font-size:14px;font-weight:500">'+(u.name||'Unknown')+'</div><div style="font-size:12px;color:var(--color-text-muted)">'+(u.email||'')+'</div></div><div style="display:flex;gap:8px;align-items:center"><span class="pill pill-info">'+(u.role||'-')+'</span><button class="btn btn-xs btn-error" data-action="cudRemove" data-args=\\'["'+u.id+'"]\\'>Remove</button></div>';c.appendChild(div)})}catch(e){c.innerHTML='<div style="text-align:center;color:var(--color-danger);font-size:13px">Error loading users</div>'}}
window.cudAdd=async function(){var email=document.getElementById('cud-email').value.trim();var role=document.getElementById('cud-role').value;if(!email){showToast('Email required','error');return}try{var res=await fetch('/api/user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,role:role,client_id:'${clientId}',name:email.split('@')[0],status:'active'})});if(res.ok){showToast('User added','success');document.getElementById('cud-email').value='';cudLoad()}else{var d=await res.json().catch(function(){return{}});showToast(d.error||'Failed','error')}}catch(e){showToast('Error','error')}};
window.cudRemove=async function(uid){if(!confirm('Remove this user?'))return;try{var res=await fetch('/api/user/'+uid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:null,role:'client_user'})});if(res.ok){showToast('User removed','success');cudLoad()}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};`;
  return { html, script };
}

export function clientUserReplaceDialog(clientId) {
  const html = `<div id="client-replace-dialog" class="modal" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="modal-overlay" data-dialog-close="client-replace-dialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 class="text-lg font-semibold mb-4">Replace Client User</h3>
      <div style="margin-bottom:12px"><label class="form-label">Current User</label><select id="crd-from" class="form-input"><option value="">Select user to replace...</option></select></div>
      <div style="text-align:center;font-size:12px;color:var(--color-text-muted);padding:8px 0">Replace with</div>
      <div style="margin-bottom:12px"><label class="form-label">New User</label><select id="crd-to" class="form-input"><option value="">Select replacement user...</option></select></div>
      <div style="margin-bottom:16px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="crd-transfer" class="checkbox" checked/><span style="font-size:14px">Transfer all assignments</span></label></div>
      <div class="modal-action"><button class="btn btn-primary" data-action="crdConfirm">Replace</button><button class="btn btn-ghost" data-dialog-close="client-replace-dialog">Cancel</button></div>
    </div>
  </div>`;
  const script = `window.showClientReplace=function(){document.getElementById('client-replace-dialog').style.display='flex';fetch('/api/user?client_id=${clientId}').then(function(r){return r.json()}).then(function(d){var users=d.data||d||[];['crd-from','crd-to'].forEach(function(id){var sel=document.getElementById(id);while(sel.options.length>1)sel.remove(1);users.forEach(function(u){var o=document.createElement('option');o.value=u.id;o.textContent=(u.name||u.email||u.id);sel.appendChild(o)})})}).catch(function(){})};
window.crdConfirm=async function(){var from=document.getElementById('crd-from').value;var to=document.getElementById('crd-to').value;if(!from||!to){showToast('Select both users','error');return}if(from===to){showToast('Cannot replace with same user','error');return}try{var res=await fetch('/api/user/'+from,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({replaced_by:to,status:'inactive'})});if(res.ok){showToast('User replaced','success');document.getElementById('client-replace-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};`;
  return { html, script };
}

export function clientTestEmailDialog(clientId) {
  const html = `<div id="test-email-dialog" class="modal" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="modal-overlay" data-dialog-close="test-email-dialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 class="text-lg font-semibold mb-4">Send Test Email</h3>
      <div style="margin-bottom:12px"><label class="form-label">To</label><input type="email" id="ted-to" class="form-input" placeholder="recipient@example.com"/></div>
      <div style="margin-bottom:12px"><label class="form-label">Subject</label><input type="text" id="ted-subject" class="form-input" value="Test Email - Platform Notification"/></div>
      <div style="margin-bottom:16px"><label class="form-label">Message</label><textarea id="ted-body" class="form-input" style="min-height:80px;resize:vertical" rows="4">This is a test email from the Platform to verify email delivery to client users.</textarea></div>
      <div class="modal-action"><button class="btn btn-primary" data-action="tedSend">Send Test</button><button class="btn btn-ghost" data-dialog-close="test-email-dialog">Cancel</button></div>
    </div>
  </div>`;
  const script = `window.tedSend=async function(){var to=document.getElementById('ted-to').value.trim();if(!to){showToast('Email required','error');return}try{var res=await fetch('/api/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:to,subject:document.getElementById('ted-subject').value,body:document.getElementById('ted-body').value,client_id:'${clientId}'})});if(res.ok){showToast('Test email sent','success');document.getElementById('test-email-dialog').style.display='none'}else{showToast('Send failed (email service may not be configured)','info');document.getElementById('test-email-dialog').style.display='none'}}catch(e){showToast('Email service not available','info');document.getElementById('test-email-dialog').style.display='none'}};`;
  return { html, script };
}

export function clientRiskAssessmentDialog(clientId, currentRisk) {
  const options = RISK_LEVELS.map(r => `<label style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius);border:1px solid var(--color-border);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='var(--color-bg)'" onmouseout="this.style.background=''"><input type="radio" name="crad-risk" value="${r.value}" ${currentRisk === r.value ? 'checked' : ''} class="radio radio-primary"/><span class="badge ${r.cls}">${r.label}</span></label>`).join('');
  const html = `<div id="risk-dialog" class="modal" style="display:none" data-dialog-close-overlay="true" role="dialog" aria-modal="true" aria-hidden="true">
    <div class="modal-overlay" data-dialog-close="risk-dialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 class="text-lg font-semibold mb-4">Risk Assessment</h3>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">${options}</div>
      <div style="margin-bottom:16px"><label class="form-label">Notes</label><textarea id="crad-notes" class="form-input" style="min-height:60px;resize:vertical" rows="2" placeholder="Risk assessment notes..."></textarea></div>
      <div class="modal-action"><button class="btn btn-primary" data-action="cradSave">Save</button><button class="btn btn-ghost" data-dialog-close="risk-dialog">Cancel</button></div>
    </div>
  </div>`;
  const script = `window.cradSave=async function(){var sel=document.querySelector('input[name="crad-risk"]:checked');if(!sel){showToast('Select a risk level','error');return}try{var res=await fetch('/api/client/${clientId}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({risk_level:sel.value,risk_notes:document.getElementById('crad-notes').value})});if(res.ok){showToast('Risk assessment saved','success');document.getElementById('risk-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};`;
  return { html, script };
}

export function clientInfoCard(client) {
  const c = client || {};
  const infoRows = [
    ['Name', c.name], ['Email', c.email], ['Phone', c.phone],
    ['Industry', c.industry], ['Status', c.status ? statusBadge(c.status) : null],
    ['Risk', c.risk_level ? `<span class="badge badge-flat-secondary text-xs">${c.risk_level}</span>` : null],
  ].filter(([, v]) => v).map(([l, v]) => `<div class="detail-row"><span class="detail-row-label">${l}</span><span class="detail-row-value">${v}</span></div>`).join('');
  return `<div class="card-clean"><div class="card-clean-body"><h2 style="font-size:0.875rem;font-weight:600;margin-bottom:16px">Client Details</h2><div class="detail-grid" style="grid-template-columns:1fr">${infoRows || '<div style="color:var(--color-text-muted);font-size:14px">No details available</div>'}</div></div></div>`;
}
