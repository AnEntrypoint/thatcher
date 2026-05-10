import { page } from '@/ui/layout.js';
import { canCreate } from '@/ui/permissions-ui.js';
import { SPACING } from '@/ui/spacing-system.js';
import { TOAST_SCRIPT as TOAST, esc } from '@/ui/render-helpers.js';
import { modalDialog } from '@/ui/dialog-factory.js';

export function checklistTemplatesUI(user, templates = []) {
  const rows = templates.map(t => `<tr class="hover cursor-pointer" data-navigate="/admin/settings/checklists/${esc(t.id)}">
    <td class="font-medium text-sm">${esc(t.name || 'Untitled')}</td>
    <td class="text-sm">${t.item_count || 0} items</td>
    <td>${t.active ? '<span class="badge badge-success badge-flat-success text-xs">Active</span>' : '<span class="badge badge-flat-secondary text-xs">Inactive</span>'}</td>
    <td class="text-sm text-base-content/50">${t.created_at ? new Date(typeof t.created_at === 'number' ? t.created_at * 1000 : t.created_at).toLocaleDateString() : '-'}</td>
  </tr>`).join('');
  const createBtn = canCreate(user, 'checklist') ? `<button class="btn btn-primary btn-sm" data-action="chtCreate">+ New Template</button>` : '';
  const bc = [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'Checklists' }];
  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Checklist Templates</h1>${createBtn}</div>
    <div class="card-clean"><div class="card-clean-body" style="padding:0rem">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Items</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center py-8 text-base-content/40">No templates</td></tr>'}</tbody>
      </table></div>
    </div></div>`;
  const script = `${TOAST}window.chtCreate=async function(){var name=prompt('Template name:');if(!name)return;try{var r=await fetch('/api/checklist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,active:true})});if(r.ok){var d=await r.json();window.location='/admin/settings/checklists/'+(d.data?.id||d.id||'');}else showToast('Failed','error')}catch(e){showToast('Error','error')}}`;
  return page(user, 'Checklist Templates | Moonlanding', bc, content, [script]);
}

export function checklistDialog(checklistId) {
  const body = `<div id="ckd-items" class="flex flex-col gap-2 mb-4"></div>
    <div class="flex gap-2">
      <input id="ckd-new" class="input input-solid flex-1" placeholder="New item..."/>
      <button class="btn btn-primary btn-sm" data-action="ckdAdd">Add</button>
    </div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="checklist-dialog">Close</button>`;
  const cid = esc(checklistId);
  return modalDialog('checklist-dialog', 'Checklist', body, footer, { maxWidth: 'lg' }) + `
  <script>
  window.openChecklist=function(id){var cid=id||'${cid}';document.getElementById('checklist-dialog').style.display='flex';fetch('/api/checklist_item?checklist_id='+cid).then(function(r){return r.json()}).then(function(d){var items=d.data||d||[];var el=document.getElementById('ckd-items');el.innerHTML=items.map(function(it){return'<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" class="checkbox checkbox-sm" '+(it.is_done?'checked':'')+' onchange="ckdToggle(\\''+it.id+'\\',this.checked)"/><span class="text-sm'+(it.is_done?' line-through text-base-content/40':'')+'">'+(it.name||it.title||'')+'</span></label>'}).join('')||'<div class="text-base-content/40 text-sm py-4 text-center">No items</div>'}).catch(function(){})};
  window.ckdToggle=async function(id,done){try{await fetch('/api/checklist_item/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_done:done})})}catch(e){}};
  window.ckdAdd=async function(){var name=document.getElementById('ckd-new').value.trim();if(!name)return;try{await fetch('/api/checklist_item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checklist_id:'${cid}',name:name})});document.getElementById('ckd-new').value='';openChecklist('${cid}')}catch(e){}};
  </script>`;
}

export function pushChecklistCrossRef(engagementId) {
  return `<script>
  window.pushChecklistCrossRef=async function(checklistId,targetEngId){try{var r=await fetch('/api/checklist/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checklist_id:checklistId,source_engagement_id:'${engagementId}',target_engagement_id:targetEngId})});if(r.ok)showToast('Checklist pushed','success');else showToast('Push failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function renderChecklistDetails(user, checklist, items = []) {
  const completed = items.filter(i => i.is_done).length;
  const pct = items.length > 0 ? Math.round(completed / items.length * 100) : 0;
  const remaining = items.length - completed;
  const pctColor = pct === 100 ? 'progress-success' : pct >= 50 ? 'progress-primary' : 'progress-warning';

  const itemRows = items.map((it, idx) => `<div class="flex items-center gap-3 px-4 py-3 border-b border-base-200 last:border-0 hover:bg-base-50 transition-colors group" id="item-${esc(it.id)}">
    <label class="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
      <input type="checkbox" class="checkbox checkbox-sm flex-shrink-0" ${it.is_done ? 'checked' : ''} onchange="ckToggle('${esc(it.id)}',this.checked,this)"/>
      <span class="text-sm flex-1 leading-relaxed${it.is_done ? ' line-through text-base-content/40' : ''}" id="label-${esc(it.id)}">${esc(it.name || it.title || '')}</span>
    </label>
    <button class="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" data-action="ckDel" data-args='["${esc(it.id)}"]' title="Delete item">&#x2715;</button>
  </div>`).join('');

  const emptyState = `<div class="flex flex-col items-center py-12 text-base-content/40">
    <span class="text-4xl mb-3">☑️</span>
    <p class="text-sm font-medium">No items yet</p>
    <p class="text-xs mt-1">Add your first item below</p>
  </div>`;

  const doneState = pct === 100 && items.length > 0 ? `<div class="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg mb-4 text-success text-sm font-medium">
    <span>✓</span> All ${items.length} items complete!
  </div>` : '';

  const bc = [{ href: '/', label: 'Dashboard' }, { href: '/checklist', label: 'Checklists' }, { label: checklist.name || 'Checklist' }];
  const content = `
    <div class="flex justify-between items-start mb-4 flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold">${esc(checklist.name || 'Checklist')}</h1>
        <p class="text-sm text-base-content/50 mt-1" data-ck-label>${completed} of ${items.length} items complete${remaining > 0 ? ` &middot; ${remaining} remaining` : ''}</p>
      </div>
      <div class="flex gap-2">
        ${remaining > 0 && items.length > 0 ? `<button class="btn btn-ghost btn-sm border border-base-300" data-action="ckCompleteAll">Complete All</button>` : ''}
      </div>
    </div>
    <div class="flex items-center gap-3 mb-6">
      <progress class="progress ${pctColor} flex-1" value="${completed}" max="${items.length || 1}"></progress>
      <span class="text-sm font-semibold text-base-content/60 w-10 text-right" data-ck-pct>${pct}%</span>
    </div>
    ${doneState}
    <div class="card-clean">
      <div id="ck-items">
        ${itemRows || emptyState}
      </div>
      <div class="flex gap-2 p-4 border-t border-base-200">
        <input id="ck-new" class="input input-solid flex-1" placeholder="Add a new item..." onkeydown="if(event.key==='Enter')ckAdd()"/>
        <button class="btn btn-primary btn-sm" data-action="ckAdd">Add</button>
      </div>
    </div>`;

  const script = `${TOAST}
var CK_TOTAL=${items.length},CK_DONE=${completed};
function ckUp(){var p=CK_TOTAL>0?Math.round(CK_DONE/CK_TOTAL*100):0;var pg=document.querySelector('.progress');if(pg){pg.value=CK_DONE;pg.max=CK_TOTAL||1}var lb=document.querySelector('[data-ck-label]');if(lb)lb.textContent=CK_DONE+' of '+CK_TOTAL+' items complete'+(CK_TOTAL-CK_DONE>0?' \xb7 '+(CK_TOTAL-CK_DONE)+' remaining':'');var pe=document.querySelector('[data-ck-pct]');if(pe)pe.textContent=p+'%'}
window.ckToggle=async function(id,done,el){try{await fetch('/api/checklist_item/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_done:done})});var lbl=document.getElementById('label-'+id);if(lbl){lbl.classList.toggle('line-through',done);lbl.classList.toggle('text-base-content/40',done)}CK_DONE+=done?1:-1;ckUp()}catch(e){showToast('Failed to update','error');if(el)el.checked=!done}};
window.ckDel=async function(id){if(!confirm('Delete this item?'))return;try{await fetch('/api/checklist_item/'+id,{method:'DELETE'});var el=document.getElementById('item-'+id);if(el){var wasDone=el.querySelector('input').checked;el.remove();CK_TOTAL--;if(wasDone)CK_DONE--;ckUp()}showToast('Item deleted','success')}catch(e){showToast('Error','error')}};
window.ckAdd=async function(){var inp=document.getElementById('ck-new');var n=inp.value.trim();if(!n)return;inp.disabled=true;try{var r=await fetch('/api/checklist_item',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checklist_id:'${esc(checklist.id)}',name:n})});var d=await r.json();var id=(d.data||d).id;var c=document.getElementById('ck-items');var ee=c.querySelector('.flex-col.items-center');if(ee)ee.remove();var div=document.createElement('div');div.id='item-'+id;div.className='flex items-center gap-3 px-4 py-3 border-b border-base-200 last:border-0 hover:bg-base-50 transition-colors group';div.innerHTML='<label class="flex items-center gap-3 flex-1 cursor-pointer min-w-0"><input type="checkbox" class="checkbox checkbox-sm flex-shrink-0" onchange="ckToggle(\\''+id+'\\',this.checked,this)"/><span class="text-sm flex-1 leading-relaxed" id="label-'+id+'">'+n.replace(/</g,'&lt;')+'</span></label><button class="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" data-action="ckDel" data-args='["'+id+'"]'>&#x2715;</button>';c.appendChild(div);inp.value='';inp.disabled=false;inp.focus();CK_TOTAL++;ckUp()}catch(e){showToast('Error adding item','error');inp.disabled=false}};
window.ckCompleteAll=async function(){var cbs=document.querySelectorAll('#ck-items input[type=checkbox]:not(:checked)');for(var cb of cbs){var id=cb.closest('[id^=item-]')?.id?.replace('item-','');if(id){cb.checked=true;await ckToggle(id,true,cb)}}};`;
  return page(user, esc(checklist.name || 'Checklist'), bc, content, [script]);
}

export function renderChecklistsHome(user, checklists = []) {
  const rows = checklists.map(c => {
    const pct = c.total_items > 0 ? Math.round((c.completed_items || 0) / c.total_items * 100) : 0;
    return `<tr class="hover cursor-pointer" data-navigate="/checklist/${esc(c.id)}">
      <td class="font-medium text-sm">${esc(c.name || 'Untitled')}</td>
      <td class="text-sm">${esc(c.engagement_name || '-')}</td>
      <td><progress class="progress progress-primary w-32" value="${c.completed_items || 0}" max="${c.total_items || 1}"></progress></td>
      <td class="text-sm text-base-content/60">${pct}%</td>
    </tr>`;
  }).join('');
  const bc = [{ href: '/', label: 'Dashboard' }, { label: 'Checklists' }];
  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Checklists</h1></div>
    <div class="card-clean"><div class="card-clean-body" style="padding:0rem">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Engagement</th><th>Progress</th><th>%</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center py-8 text-base-content/40">No checklists</td></tr>'}</tbody>
      </table></div>
    </div></div>`;
  return page(user, 'Checklists | Moonlanding', bc, content);
}

export function renderChecklistsManagement(user, checklists = []) {
  const rows = checklists.map(c => `<tr>
    <td class="font-medium text-sm">${esc(c.name || 'Untitled')}</td>
    <td class="text-sm">${c.total_items || 0}</td>
    <td>${c.active ? '<span class="badge badge-success badge-flat-success text-xs">Active</span>' : '<span class="badge badge-flat-secondary text-xs">Inactive</span>'}</td>
    <td><div class="flex gap-1">
      <a href="/checklist/${esc(c.id)}" class="btn btn-ghost btn-xs">View</a>
      <button class="btn btn-ghost btn-xs" data-action="ckmToggle" data-args='["${esc(c.id)}",${c.active ? 'false' : 'true'}]'>${c.active ? 'Deactivate' : 'Activate'}</button>
      <button class="btn btn-error btn-xs btn-outline" data-action="ckmDel" data-args='["${esc(c.id)}"]'>Delete</button>
    </div></td>
  </tr>`).join('');
  const bc = [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'Manage Checklists' }];
  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Manage Checklists</h1></div>
    <div class="card-clean"><div class="card-clean-body" style="padding:0rem">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center py-8 text-base-content/40">No checklists</td></tr>'}</tbody>
      </table></div>
    </div></div>`;
  const script = `${TOAST}window.ckmToggle=async function(id,active){await fetch('/api/checklist/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:active})});location.reload()};window.ckmDel=async function(id){if(!confirm('Delete?'))return;await fetch('/api/checklist/'+id,{method:'DELETE'});location.reload()}`;
  return page(user, 'Manage Checklists | Moonlanding', bc, content, [script]);
}
