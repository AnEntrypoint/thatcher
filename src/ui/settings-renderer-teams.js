import { TOAST_SCRIPT, settingsPage, settingsBack, inlineTable } from '@/ui/settings-renderer.js';

const RFI_PALETTE = ['#B0B0B0', '#44BBA4', '#FF4141', '#7F7EFF', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

function parseMembers(t) {
  try {
    const u = t.users;
    if (!u) return [];
    const arr = Array.isArray(u) ? u : JSON.parse(u);
    if (!Array.isArray(arr)) return [];
    return arr.map(m => typeof m === 'object' ? (m.email || m.name || m.cloud_id || '') : String(m));
  } catch { return []; }
}

export function renderSettingsTeams(user, teams = [], allUsers = []) {
  const editDialog = `<div id="team-dialog" class="modal" style="display:none" data-overlay-close="true" data-action="closeTeamDialog">
    <div class="modal-overlay" data-action="closeTeamDialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 id="team-dialog-title" class="text-lg font-semibold mb-4">Edit Team</h3>
      <input type="hidden" id="team-edit-id"/>
      <div class="form-group mb-4">
        <label class="label"><span class="label-text font-medium">Team Name</span></label>
        <input id="team-name-input" type="text" class="input input-solid max-w-full" placeholder="Team name"/>
      </div>
      <div class="modal-action">
        <button data-action="saveTeam" class="btn btn-primary">Save</button>
        <button data-action="closeTeamDialog" class="btn btn-ghost">Cancel</button>
      </div>
    </div>
  </div>`;

  const rows = teams.map(t => {
    const members = parseMembers(t);
    const memberCount = members.length;
    const memberNames = members.slice(0, 3).map(m => String(m).split('@')[0]).join(', ');
    const moreCount = memberCount > 3 ? ` +${memberCount - 3} more` : '';
    const membersDisplay = memberCount > 0
      ? `<span class="text-sm text-base-content/60">${memberNames}${moreCount}</span>`
      : '<span class="text-base-content/30 text-sm">No members</span>';
    return `<tr class="hover">
      <td class="font-medium text-sm">${t.name || '-'}</td>
      <td><span class="badge badge-flat-primary text-xs mr-2">${memberCount} member${memberCount !== 1 ? 's' : ''}</span>${membersDisplay}</td>
      <td><div class="flex gap-2">
        <button class="btn btn-ghost btn-xs team-edit-btn" data-id="${t.id}" data-name="${(t.name||'').replace(/"/g,'&quot;')}">Edit</button>
        <button class="btn btn-error btn-xs team-delete-btn" data-id="${t.id}">Delete</button>
      </div></td>
    </tr>`;
  }).join('');

  const script = `${TOAST_SCRIPT}
function openEditTeam(id,name){document.getElementById('team-edit-id').value=id;document.getElementById('team-name-input').value=name;document.getElementById('team-dialog-title').textContent='Edit Team';document.getElementById('team-dialog').style.display='flex'}
function openAddTeam(){document.getElementById('team-edit-id').value='';document.getElementById('team-name-input').value='';document.getElementById('team-dialog-title').textContent='Add Team';document.getElementById('team-dialog').style.display='flex'}
function closeTeamDialog(){document.getElementById('team-dialog').style.display='none'}
async function saveTeam(){const id=document.getElementById('team-edit-id').value;const name=document.getElementById('team-name-input').value.trim();if(!name){showToast('Name is required','error');return}const url=id?'/api/team/'+id:'/api/team';const method=id?'PUT':'POST';try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(r.ok){showToast(id?'Team updated':'Team created','success');setTimeout(()=>location.reload(),500)}else{const d=await r.json();showToast(d.error||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}
async function deleteTeam(id){if(!confirm('Delete this team?'))return;try{const r=await fetch('/api/team/'+id,{method:'DELETE'});if(r.ok){showToast('Team deleted','success');setTimeout(()=>location.reload(),500)}else showToast('Delete failed','error')}catch(e){showToast('Error','error')}}
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.team-edit-btn').forEach(b=>b.addEventListener('click',function(){const id=this.dataset.id;const name=this.dataset.name;openEditTeam(id,name)}));document.querySelectorAll('.team-delete-btn').forEach(b=>b.addEventListener('click',function(){const id=this.dataset.id;deleteTeam(id)}));document.querySelectorAll('.team-add-btn').forEach(b=>b.addEventListener('click',openAddTeam))});`;

  const content = `${settingsBack()}${editDialog}
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Teams</h1>
      <button class="btn btn-primary btn-sm gap-1 team-add-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Team</button>
    </div>
    <div class="card-clean"><div class="card-clean-body" style="padding:0rem">${inlineTable(['Name', 'Members', 'Actions'], rows, 'No teams found')}</div></div>`;
  return settingsPage(user, 'Teams - Settings', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'Teams' }], content, [script]);
}

export function renderSettingsRfiSections(user, sections = []) {
  const rows = sections.map((s, i) => `<tr class="hover rfi-section-row" data-id="${s.id}">
    <td><span class="inline-block w-5 h-5 rounded" style="background:${s.color || '#B0B0B0'}"></span></td>
    <td class="text-sm">${s.name || '-'}</td>
    <td class="text-sm text-base-content/50">${s.order ?? i}</td>
    <td><div class="flex gap-1">
      <button class="btn btn-ghost btn-xs rfi-move-btn" data-id="${s.id}" data-direction="up" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
      <button class="btn btn-ghost btn-xs rfi-move-btn" data-id="${s.id}" data-direction="down" ${i === sections.length - 1 ? 'disabled' : ''}>&#9660;</button>
      <button class="btn btn-ghost btn-xs rfi-edit-btn" data-id="${s.id}" data-name="${(s.name || '').replace(/"/g,'&quot;')}" data-color="${s.color || '#B0B0B0'}">Edit</button>
      <button class="btn btn-error btn-xs rfi-delete-btn" data-id="${s.id}">Delete</button>
    </div></td>
  </tr>`).join('');

  const palette = RFI_PALETTE.map(c => `<div data-color="${c}" class="rounded cursor-pointer" style="background:${c};width:24px;height:24px;border:2px solid transparent;border-radius:4px" data-action="selectColor" data-args='["${c}"]' title="${c}"></div>`).join('');
  const formHtml = `<div id="section-form" class="card-clean" style="margin-bottom:1rem;display:none">
    <div class="card-clean-body">
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">
        <div class="form-group"><label class="label"><span class="label-text font-medium">Name</span></label><input type="text" id="section-name" class="input input-solid" style="max-width:200px" placeholder="Section name"/></div>
        <div><label class="label"><span class="label-text font-medium">Color</span></label><div id="color-palette" style="display:flex;gap:8px;flex-wrap:wrap">${palette}</div><input type="hidden" id="section-color" value="#B0B0B0"/></div>
        <div class="flex gap-2"><button data-action="saveSection" class="btn btn-primary btn-sm">Save</button><button data-action="cancelForm" class="btn btn-ghost btn-sm">Cancel</button></div>
      </div>
      <input type="hidden" id="edit-id" value=""/>
    </div>
  </div>`;

  const content = `${settingsBack()}
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">RFI Sections</h1>
      <button class="btn btn-primary btn-sm rfi-add-btn">Add Section</button>
    </div>
    ${formHtml}
    <div class="card-clean"><div class="card-clean-body" style="padding:0rem">${inlineTable(['Color', 'Name', 'Order', 'Actions'], rows, 'No RFI sections. Add one below.')}</div></div>`;

  const script = `${TOAST_SCRIPT}
function toggleAddForm(){document.getElementById('section-form').style.display='block';document.getElementById('edit-id').value='';document.getElementById('section-name').value='';selectColor('#B0B0B0')}
function cancelForm(){document.getElementById('section-form').style.display='none'}
function selectColor(c){document.getElementById('section-color').value=c;document.querySelectorAll('#color-palette div').forEach(el=>{el.style.borderColor=el.dataset.color===c?'#1a1a1a':'transparent'})}
function editSection(id,name,color){document.getElementById('section-form').style.display='block';document.getElementById('edit-id').value=id;document.getElementById('section-name').value=name;selectColor(color)}
async function saveSection(){const name=document.getElementById('section-name').value.trim();const color=document.getElementById('section-color').value;const id=document.getElementById('edit-id').value;if(!name){showToast('Name is required','error');return}const url=id?'/api/rfi_section/'+id:'/api/rfi_section';const method=id?'PUT':'POST';try{const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name,color})});if(res.ok){showToast(id?'Updated':'Created','success');setTimeout(()=>location.reload(),500)}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}
async function deleteSection(id){if(!confirm('Delete this section?'))return;try{const res=await fetch('/api/rfi_section/'+id,{method:'DELETE'});if(res.ok){showToast('Deleted','success');setTimeout(()=>location.reload(),500)}else{showToast('Delete failed','error')}}catch(e){showToast('Error','error')}}
async function moveSection(id,dir){try{const res=await fetch('/api/rfi_section/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({reorder:dir})});if(res.ok){location.reload()}else{showToast('Reorder failed','error')}}catch(e){showToast('Error','error')}}
selectColor('#B0B0B0');
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.rfi-add-btn').forEach(b=>b.addEventListener('click',function(e){e.preventDefault();toggleAddForm()}));document.querySelectorAll('.rfi-edit-btn').forEach(b=>b.addEventListener('click',function(e){e.preventDefault();editSection(this.dataset.id,this.dataset.name,this.dataset.color)}));document.querySelectorAll('.rfi-delete-btn').forEach(b=>b.addEventListener('click',function(e){e.preventDefault();deleteSection(this.dataset.id)}));document.querySelectorAll('.rfi-move-btn').forEach(b=>b.addEventListener('click',function(e){e.preventDefault();moveSection(this.dataset.id,this.dataset.direction)}))});`;

  return settingsPage(user, 'RFI Sections - Settings', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'RFI Sections' }], content, [script]);
}
