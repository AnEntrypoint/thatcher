import { settingsPage, settingsBack, inlineTable, TOAST_SCRIPT } from '@/ui/settings-renderer.js';
import { esc } from '@/ui/render-helpers.js';

const bc = (label, extra = []) => [
  { href: '/', label: 'Dashboard' },
  { href: '/admin/settings', label: 'Settings' },
  ...extra,
  { label },
];

const ROLES = ['partner','manager','clerk','client_admin','client_user','admin','user'];
const ROLE_BADGE = { partner:'badge-flat-primary', manager:'badge-flat-success', clerk:'badge-warning badge-flat-warning', client_admin:'badge-flat-secondary', client_user:'badge-flat-secondary', admin:'badge-error badge-flat-error', user:'badge-flat-secondary' };

function roleBadge(role) {
  const map = { partner:'pill pill-info', manager:'pill pill-success', clerk:'pill pill-warning', client_admin:'pill pill-neutral', client_user:'pill pill-neutral', admin:'pill pill-danger', user:'pill pill-neutral' };
  const cls = map[role] || 'pill pill-neutral';
  return role ? `<span class="${cls}">${role}</span>` : '-';
}

function field(label, id, type = 'text', value = '', extra = '') {
  return `<div class="form-group">
    <label class="label" for="${id}"><span class="label-text font-semibold">${label}</span></label>
    <input type="${type}" id="${id}" value="${esc(value)}" ${extra} class="form-input" placeholder="Enter ${label.toLowerCase()}"/>
  </div>`;
}

function selectField(label, id, options, selected = '') {
  const opts = options.map(o => {
    const val = typeof o === 'string' ? o : o.value;
    const lbl = typeof o === 'string' ? o.charAt(0).toUpperCase() + o.slice(1) : o.label;
    return `<option value="${esc(val)}" ${val === selected ? 'selected' : ''}>${lbl}</option>`;
  }).join('');
  return `<div class="form-group">
    <label class="label" for="${id}"><span class="label-text font-semibold">${label}</span></label>
    <select id="${id}" class="form-input">${opts}</select>
  </div>`;
}

export function renderSettingsUserDetail(user, targetUser = {}, teams = []) {
  const isNew = !targetUser.id;
  const title = isNew ? 'Add User' : `User: ${targetUser.name || targetUser.email || '-'}`;
  const teamOpts = [{ value: '', label: 'No team' }, ...teams.map(t => ({ value: t.id, label: t.name || t.id }))];

  const form = `<form id="user-form" class="space-y-4">
    ${field('Full Name', 'u-name', 'text', targetUser.name || '')}
    ${field('Email', 'u-email', 'email', targetUser.email || '', isNew ? '' : 'readonly')}
    ${selectField('Role', 'u-role', ROLES, targetUser.role || 'clerk')}
    ${selectField('Team', 'u-team', teamOpts, targetUser.team_id || '')}
    ${selectField('Status', 'u-status', ['active','inactive','deleted'], targetUser.status || 'active')}
    ${isNew ? field('Password', 'u-password', 'password', '') : ''}
    <div class="flex gap-3 pt-4 border-t border-base-200">
      <button type="button" data-action="saveUser" data-args='["${esc(targetUser.id || '')}"]' class="btn btn-primary">${isNew ? 'Create User' : 'Save Changes'}</button>
      ${!isNew ? `<button type="button" data-action="resetPassword" data-args='["${esc(targetUser.id)}"]' class="btn btn-ghost">Reset Password</button>` : ''}
      ${!isNew && targetUser.status !== 'deleted' ? `<button type="button" data-action="deactivateUser" data-args='["${esc(targetUser.id)}"]' class="btn btn-error btn-outline">Deactivate</button>` : ''}
    </div>
  </form>`;

  const content = `${settingsBack()}<div class="flex items-center gap-3 mb-6">
    <a href="/admin/settings/users" class="btn btn-ghost btn-sm">&#8592; Users</a>
    <h1 class="text-2xl font-bold">${esc(title)}</h1>
    ${targetUser.role ? roleBadge(targetUser.role) : ''}
  </div>
  <div class="card-clean"><div class="card-clean-body">${form}</div></div>`;

  const script = `${TOAST_SCRIPT}
async function saveUser(id){
  const data={name:document.getElementById('u-name').value.trim(),role:document.getElementById('u-role').value,team_id:document.getElementById('u-team').value||null,status:document.getElementById('u-status').value};
  ${isNew ? "data.email=document.getElementById('u-email').value.trim();data.password=document.getElementById('u-password').value;" : ''}
  if(!data.name){showToast('Name required','error');return}
  ${isNew ? "if(!data.email){showToast('Email required','error');return}" : ''}
  try{const url=id?'/api/user/'+id:'/api/user';const r=await fetch(url,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(r.ok){showToast(id?'User updated':'User created','success');setTimeout(()=>window.location='/admin/settings/users',800)}else{const d=await r.json();showToast(d.error||'Failed','error')}}catch(e){showToast('Error','error')}
}
async function resetPassword(id){const pw=prompt('Enter new password (min 8 chars):');if(!pw||pw.length<8){showToast('Password too short','error');return}try{const r=await fetch('/api/user/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(r.ok)showToast('Password reset','success');else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function deactivateUser(id){if(!confirm('Deactivate this user?'))return;try{const r=await fetch('/api/user/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'inactive'})});if(r.ok){showToast('User deactivated','success');setTimeout(()=>location.reload(),600)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}`;

  return settingsPage(user, title + ' - Settings', bc(title, [{ href: '/admin/settings/users', label: 'Users' }]), content, [script]);
}

export function renderSettingsTeamDetail(user, team = {}, allUsers = []) {
  const isNew = !team.id;
  const title = isNew ? 'Add Team' : `Team: ${team.name || '-'}`;
  const memberIds = Array.isArray(team.users) ? team.users.map(u => typeof u === 'string' ? u : u.id || u.cloud_id) : [];
  const members = allUsers.filter(u => memberIds.includes(u.id));
  const available = allUsers.filter(u => !memberIds.includes(u.id) && u.status !== 'deleted');

  const memberRows = members.map(m => `<tr>
    <td class="text-sm">${esc(m.name||'-')}</td>
    <td class="text-sm text-base-content/60">${esc(m.email||'-')}</td>
    <td>${roleBadge(m.role)}</td>
    <td><button data-action="removeMember" data-args='["${esc(team.id||'')}","${esc(m.id)}"]' class="btn btn-error btn-xs btn-outline">Remove</button></td>
  </tr>`).join('') || `<tr><td colspan="4" class="text-center py-6 text-base-content/40 text-sm">No members yet</td></tr>`;

  const availOpts = available.map(u => `<option value="${esc(u.id)}">${esc(u.name||u.email||u.id)}</option>`).join('');

  const form = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="card-clean"><div class="card-clean-body">
      <h2 class="card-title text-base">Team Details</h2>
      <div class="space-y-4">
        ${field('Team Name', 't-name', 'text', team.name || '')}
        ${selectField('Context', 't-context', ['general','engagement_team','review_team'], team.context || 'general')}
        <button data-action="saveTeam" data-args='["${esc(team.id||'')}"]' class="btn btn-primary">${isNew ? 'Create Team' : 'Save Changes'}</button>
      </div>
    </div></div>
    <div class="card-clean"><div class="card-clean-body">
      <div class="flex justify-between items-center mb-4">
        <h2 class="card-title text-base">Members (${members.length})</h2>
        ${!isNew ? `<div class="flex gap-2"><select id="add-member-select" class="select select-solid select-sm"><option value="">Select user...</option>${availOpts}</select><button data-action="addMember" data-args='["${esc(team.id||'')}"]' class="btn btn-primary btn-sm">Add</button></div>` : '<span class="text-sm text-base-content/40">Save team first to add members</span>'}
      </div>
      ${inlineTable(['Name','Email','Role',''], memberRows, 'No members')}
    </div></div>
  </div>`;

  const content = `${settingsBack()}<div class="flex items-center gap-3 mb-6">
    <a href="/admin/settings/teams" class="btn btn-ghost btn-sm">&#8592; Teams</a>
    <h1 class="text-2xl font-bold">${esc(title)}</h1>
  </div>${form}`;

  const script = `${TOAST_SCRIPT}
async function saveTeam(id){
  const data={name:document.getElementById('t-name').value.trim(),context:document.getElementById('t-context').value};
  if(!data.name){showToast('Name required','error');return}
  try{const url=id?'/api/team/'+id:'/api/team';const r=await fetch(url,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(r.ok){const d=await r.json();const newId=(d.data||d).id||id;showToast(id?'Team updated':'Team created','success');setTimeout(()=>window.location='/admin/settings/teams/'+newId,800)}else{const d=await r.json();showToast(d.error||'Failed','error')}}catch(e){showToast('Error','error')}
}
async function addMember(teamId){const uid=document.getElementById('add-member-select').value;if(!uid){showToast('Select a user','error');return}try{const r=await fetch('/api/friday/team/user-removal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:teamId,user_id:uid,action:'add'})});if(r.ok){showToast('Member added','success');setTimeout(()=>location.reload(),600)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function removeMember(teamId,uid){if(!confirm('Remove this member?'))return;try{const r=await fetch('/api/friday/team/user-removal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:teamId,user_id:uid,action:'remove'})});if(r.ok){showToast('Member removed','success');setTimeout(()=>location.reload(),600)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}`;

  return settingsPage(user, title + ' - Settings', bc(title, [{ href: '/admin/settings/teams', label: 'Teams' }]), content, [script]);
}
