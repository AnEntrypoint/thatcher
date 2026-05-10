import { TOAST_SCRIPT, settingsPage, settingsBack, inlineTable } from '@/ui/settings-renderer.js';

export function renderSettingsRfiTemplates(user, templates = []) {
  const dialog = `<div id="tpl-dialog" class="modal" style="display:none">
    <div class="modal-overlay" onclick="closeTplDialog()"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 id="tpl-dialog-title" class="text-lg font-semibold mb-4">Add RFI Template</h3>
      <input type="hidden" id="tpl-edit-id"/>
      <div class="form-group mb-3">
        <label class="label"><span class="label-text font-medium">Name</span></label>
        <input id="tpl-name" type="text" class="input input-solid max-w-full" placeholder="Template name"/>
      </div>
      <div class="form-group mb-4">
        <label class="label"><span class="label-text font-medium">Description</span></label>
        <textarea id="tpl-desc" class="input input-solid max-w-full" rows="3" placeholder="Optional description"></textarea>
      </div>
      <div class="modal-action">
        <button onclick="saveTpl()" class="btn btn-primary">Save</button>
        <button onclick="closeTplDialog()" class="btn btn-ghost">Cancel</button>
      </div>
    </div>
  </div>`;

  const rows = templates.map(t => `<tr class="hover">
    <td class="font-medium text-sm">${t.name || '-'}</td>
    <td class="text-sm text-base-content/60">${t.description || ''}</td>
    <td class="text-sm text-base-content/40">${t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</td>
    <td><div class="flex gap-2">
      <button class="btn btn-ghost btn-xs tpl-edit-btn" data-id="${t.id}" data-name="${(t.name||'').replace(/"/g,'&quot;')}" data-desc="${(t.description||'').replace(/"/g,'&quot;')}">Edit</button>
      <button class="btn btn-error btn-xs tpl-del-btn" data-id="${t.id}">Delete</button>
    </div></td>
  </tr>`).join('');

  const script = `${TOAST_SCRIPT}
function openAddTpl(){document.getElementById('tpl-edit-id').value='';document.getElementById('tpl-name').value='';document.getElementById('tpl-desc').value='';document.getElementById('tpl-dialog-title').textContent='Add RFI Template';document.getElementById('tpl-dialog').style.display='flex'}
function openEditTpl(id,name,desc){document.getElementById('tpl-edit-id').value=id;document.getElementById('tpl-name').value=name;document.getElementById('tpl-desc').value=desc;document.getElementById('tpl-dialog-title').textContent='Edit RFI Template';document.getElementById('tpl-dialog').style.display='flex'}
function closeTplDialog(){document.getElementById('tpl-dialog').style.display='none'}
async function saveTpl(){const id=document.getElementById('tpl-edit-id').value;const name=document.getElementById('tpl-name').value.trim();const description=document.getElementById('tpl-desc').value.trim();if(!name){showToast('Name is required','error');return}const url=id?'/api/rfi_template/'+id:'/api/rfi_template';const method=id?'PUT':'POST';try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description})});if(r.ok){showToast(id?'Updated':'Created','success');setTimeout(()=>location.reload(),500)}else{const d=await r.json().catch(()=>({}));showToast(d.error||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}
async function delTpl(id){if(!confirm('Delete this template?'))return;try{const r=await fetch('/api/rfi_template/'+id,{method:'DELETE'});if(r.ok){showToast('Deleted','success');setTimeout(()=>location.reload(),500)}else showToast('Delete failed','error')}catch(e){showToast('Error','error')}}
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.tpl-edit-btn').forEach(b=>b.addEventListener('click',function(){openEditTpl(this.dataset.id,this.dataset.name,this.dataset.desc)}));document.querySelectorAll('.tpl-del-btn').forEach(b=>b.addEventListener('click',function(){delTpl(this.dataset.id)}));document.querySelectorAll('.tpl-add-btn').forEach(b=>b.addEventListener('click',openAddTpl))});`;

  const content = `${settingsBack()}${dialog}
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">RFI Templates</h1>
      <button class="btn btn-primary btn-sm gap-1 tpl-add-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Template</button>
    </div>
    <div class="card-clean"><div class="card-clean-body" style="padding:0rem">${inlineTable(['Name','Description','Created','Actions'], rows, 'No RFI templates found')}</div></div>`;

  return settingsPage(user, 'RFI Templates - Settings', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'RFI Templates' }], content, [script]);
}
