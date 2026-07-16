/*
 * Content-management settings pages: review templates (list + single-template
 * manage), checklists, and the generic entity/engagement "type list" pattern.
 * Ported unchanged from settings-renderer-advanced.js (templates, checklists,
 * entity-types, engagement-types) and settings-renderer-advanced2.js
 * (renderSettingsTemplateManage, the single-template detail/section-manage page).
 */
import { TOAST_SCRIPT, settingsPage, settingsBack, inlineTable, bc, esc } from '@/ui/settings/shared.js';

const editBtn = (href) => `<a href="${href}" data-stop-propagation="true" class="btn btn-ghost btn-xs">Edit</a>`;
const trClick = (url) => `class="hover cursor-pointer" data-navigate="${url}"`;
const hdr = (title, addHref, addLabel) => `${settingsBack()}<div class="flex justify-between items-center mb-6">
  <h1 class="text-2xl font-bold">${title}</h1>
  <a href="${addHref}" class="btn btn-primary btn-sm">${addLabel}</a>
</div>`;

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
    <td class="text-sm text-base-content/70">${esc(c.review_id||'-')}</td>
    <td>${editBtn('/checklist/'+c.id+'/edit')}</td>
  </tr>`).join('');
  return settingsPage(user, 'Checklists - Settings', bc('Checklists'), hdr('Checklists', '/checklist/new', '+ Add Checklist') + inlineTable(['Name', 'Type', 'Review', 'Actions'], rows, 'No checklists found'));
}

function renderTypeList(user, items, entityKey, title) {
  const rows = items.map(t => `<tr class="hover">
    <td class="font-medium text-sm">${esc(t.name || '-')}</td>
    <td class="text-xs text-base-content/70">${t.created_at ? new Date(t.created_at).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</td>
    <td><div class="flex gap-2">
      <button type="button" class="btn btn-ghost btn-xs type-edit-btn" data-id="${esc(t.id)}" data-name="${esc(t.name||'')}">Edit</button>
      <button type="button" class="btn btn-error btn-xs type-del-btn" data-id="${esc(t.id)}">Delete</button>
    </div></td>
  </tr>`).join('');
  const script = `${TOAST_SCRIPT}
var _eid='';
var _typeFormTrigger=null;
function openAdd(){_eid='';_typeFormTrigger=document.activeElement;document.getElementById('type-name').value='';document.getElementById('type-form').style.display='block';var n=document.getElementById('type-name');if(n)n.focus()}
function openEdit(id,name){_eid=id;_typeFormTrigger=document.activeElement;document.getElementById('type-name').value=name;document.getElementById('type-form').style.display='block';var n=document.getElementById('type-name');if(n)n.focus()}
function cancelForm(){document.getElementById('type-form').style.display='none';if(_typeFormTrigger&&typeof _typeFormTrigger.focus==='function')_typeFormTrigger.focus();_typeFormTrigger=null}
async function saveType(){const name=document.getElementById('type-name').value.trim();if(!name){showToast('Name required','error');return}const url=_eid?'/api/${entityKey}/'+_eid:'/api/${entityKey}';const method=_eid?'PUT':'POST';try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(r.ok){showToast(_eid?'Updated':'Created','success');setTimeout(()=>location.reload(),400)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function delType(id){if(!(await window.gmConfirm({title:'Please confirm',message:'Delete?',danger:true,confirmLabel:'OK'})))return;try{const r=await fetch('/api/${entityKey}/'+id,{method:'DELETE'});if(r.ok){showToast('Deleted','success');setTimeout(()=>location.reload(),400)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.type-edit-btn').forEach(b=>b.addEventListener('click',function(){openEdit(this.dataset.id,this.dataset.name)}));document.querySelectorAll('.type-del-btn').forEach(b=>b.addEventListener('click',function(){delType(this.dataset.id)}));document.querySelectorAll('.type-add-btn').forEach(b=>b.addEventListener('click',openAdd))});`;
  const formHtml = `<div id="type-form" class="card-clean mb-4" style="display:none"><div class="card-clean-body"><div class="flex flex-wrap gap-2 items-end"><div class="form-group" style="flex:1;min-width:0"><label class="label"><span class="label-text font-medium">Name</span></label><input id="type-name" type="text" class="input input-solid w-full" placeholder="Name"/></div><button data-action="saveType" class="btn btn-primary btn-sm">Save</button><button data-action="cancelForm" class="btn btn-ghost btn-sm">Cancel</button></div></div></div>`;
  const content = `${settingsBack()}<div class="flex justify-between items-center mb-4"><h1 class="text-2xl font-bold">${title}</h1><button class="btn btn-primary btn-sm type-add-btn">Add</button></div>${formHtml}<div class="card-clean"><div class="card-clean-body" style="padding:0">${inlineTable(['Name','Created','Actions'],rows,'No items found.')}</div></div>`;
  return settingsPage(user, `${title} - Settings`, bc(title), content, [script]);
}

export function renderSettingsEntityTypes(user, items = []) {
  return renderTypeList(user, items, 'entity_type', 'Entity Types');
}

export function renderSettingsEngagementTypes(user, items = []) {
  return renderTypeList(user, items, 'engagement_type', 'Engagement Types');
}

export function renderSettingsTemplateManage(user, template = {}, sections = []) {
  const sectionRows = sections.map((s, i) => `<tr data-id="${esc(s.id)}">
    <td><span class="inline-block w-5 h-5 rounded" style="background:${s.color || '#B0B0B0'}"></span></td>
    <td class="text-sm font-medium">${esc(s.name || '-')}</td>
    <td class="text-sm text-base-content/50">${s.order ?? i}</td>
    <td><div class="flex gap-1">
      <button data-action="editTplSection" data-args='["${esc(s.id)}","${esc((s.name||'').replace(/"/g,'&quot;'))}","${esc(s.color||'#B0B0B0')}"]' class="btn btn-ghost btn-xs">Edit</button>
      <button data-action="deleteTplSection" data-args='["${esc(s.id)}"]' class="btn btn-error btn-xs btn-outline">Delete</button>
    </div></td>
  </tr>`).join('');
  const tplBc = [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { href: '/admin/settings/templates', label: 'Templates' }, { label: template.name || 'Template' }];
  const content = `${settingsBack()}<div class="mb-6">
    <h1 class="text-2xl font-bold">${esc(template.name || 'Template')}</h1>
    <p class="text-sm text-base-content/50 mt-1">Manage template sections and configuration</p>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="card-clean"><div class="card-clean-body">
      <h2 class="card-title text-base mb-4">Template Info</h2>
      <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Name</span></label><input type="text" id="tpl-name" class="input input-solid max-w-full" value="${esc(template.name || '')}"/></div>
      <div class="form-group mb-3"><label class="label"><span class="label-text font-semibold">Type</span></label><select id="tpl-type" class="select select-solid max-w-full"><option value="standard" ${template.type==='standard'?'selected':''}>Standard</option><option value="checklist" ${template.type==='checklist'?'selected':''}>Checklist</option><option value="audit" ${template.type==='audit'?'selected':''}>Audit</option></select></div>
      <div class="form-group mb-4"><label class="label cursor-pointer justify-start gap-3"><input type="checkbox" id="tpl-active" class="checkbox checkbox-primary" ${template.is_active?'checked':''}/><span class="label-text">Active</span></label></div>
      <button data-action="saveTplInfo" class="btn btn-primary btn-sm">Save Template Info</button>
    </div></div>
    <div class="card-clean"><div class="card-clean-body">
      <div class="flex justify-between items-center mb-4">
        <h2 class="card-title text-base">Sections</h2>
        <button data-action="addTplSection" class="btn btn-primary btn-sm">+ Add Section</button>
      </div>
      ${inlineTable(['Color', 'Name', 'Order', 'Actions'], sectionRows, 'No sections defined')}
    </div></div>
  </div>
  <div id="tpl-section-form" class="hidden card-clean" style="margin-top:1rem"><div class="card-clean-body">
    <div class="flex flex-wrap gap-4 items-end">
      <div class="form-group flex-1 min-w-40"><label class="label"><span class="label-text font-semibold">Name</span></label><input type="text" id="tpl-sec-name" class="input input-solid max-w-full" placeholder="Section name"/></div>
      <div class="form-group"><label class="label"><span class="label-text font-semibold">Color</span></label><input type="color" id="tpl-sec-color" value="#B0B0B0" class="input input-solid" style="height:42px;width:60px;padding:4px"/></div>
      <div class="flex gap-2"><button data-action="saveTplSection" class="btn btn-primary btn-sm">Save</button><button data-action="cancelTplSection" class="btn btn-ghost btn-sm">Cancel</button></div>
    </div>
    <input type="hidden" id="tpl-sec-id" value=""/>
  </div></div>`;
  const script = `${TOAST_SCRIPT}
  var tplId='${esc(template.id || '')}';
  window.saveTplInfo=async function(){var body={name:document.getElementById('tpl-name').value,type:document.getElementById('tpl-type').value,is_active:document.getElementById('tpl-active').checked?1:0};try{var res=await fetch('/api/review_template/'+tplId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(res.ok){showToast('Template updated','success')}else{showToast('Update failed','error')}}catch(e){showToast('Error','error')}};
  window.addTplSection=function(){document.getElementById('tpl-section-form').classList.remove('hidden');document.getElementById('tpl-sec-id').value='';document.getElementById('tpl-sec-name').value=''};
  window.editTplSection=function(id,name,color){document.getElementById('tpl-section-form').classList.remove('hidden');document.getElementById('tpl-sec-id').value=id;document.getElementById('tpl-sec-name').value=name;document.getElementById('tpl-sec-color').value=color};
  window.cancelTplSection=function(){document.getElementById('tpl-section-form').classList.add('hidden')};
  window.saveTplSection=async function(){var id=document.getElementById('tpl-sec-id').value;var body={name:document.getElementById('tpl-sec-name').value,color:document.getElementById('tpl-sec-color').value,review_template_id:tplId};if(!body.name){showToast('Name required','error');return}var url=id?'/api/review_template_section/'+id:'/api/review_template_section';var method=id?'PUT':'POST';try{var res=await fetch(url,{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(res.ok){showToast(id?'Updated':'Created','success');setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};
  window.deleteTplSection=async function(id){if(!(await window.gmConfirm({title:'Delete Section',message:'Delete this section? This cannot be undone.',confirmLabel:'Delete',danger:true})))return;try{var res=await fetch('/api/review_template_section/'+id,{method:'DELETE'});if(res.ok){showToast('Deleted','success');setTimeout(function(){location.reload()},500)}else{showToast('Delete failed','error')}}catch(e){showToast('Error','error')}};`;
  return settingsPage(user, `Manage Template - ${esc(template.name || 'Template')}`, tplBc, content, [script]);
}
