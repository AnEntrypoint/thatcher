import { TOAST_SCRIPT, settingsPage, settingsBack, inlineTable } from '@/ui/settings-renderer.js';
import { esc } from '@/ui/render-helpers.js';

const bc = (label) => [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label }];
const togRow = tg => `<div class="flex justify-between items-center py-3 border-b border-base-200"><div><div class="text-sm font-semibold">${tg.label}</div><div class="text-xs text-base-content/50">${tg.desc}</div></div><input type="checkbox" name="${tg.id}" ${tg.checked ? 'checked' : ''} class="checkbox checkbox-primary"/></div>`;

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
  const flagChips = (flags, type) => flags.map(f => `<span class="pill pill-neutral" style="display:inline-flex;align-items:center;gap:4px">${esc(f)}<button type="button" onclick="removeFlag('${type}','${esc(f.replace(/'/g,"\\'"))}')" style="background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;color:inherit">&times;</button></span>`).join('');
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
      <div class="flex gap-2"><input type="text" id="new-review-flag" class="input input-solid" placeholder="New flag label..." style="flex:1"/><button type="button" onclick="addFlag('review')" class="btn btn-primary btn-sm">Add</button></div>
    </div></div>
    <div class="card-clean"><div class="card-clean-body"><h2 class="card-title text-base mb-3">Tender Flags</h2>
      <div id="tender-flags-list" class="flex flex-wrap gap-2 mb-3">${flagChips(tenderFlags, 'tender')}</div>
      <div class="flex gap-2"><input type="text" id="new-tender-flag" class="input input-solid" placeholder="New flag label..." style="flex:1"/><button type="button" onclick="addFlag('tender')" class="btn btn-primary btn-sm">Add</button></div>
    </div></div>
  </div>
  <button type="submit" class="btn btn-primary">Save File Review Settings</button></form>`;
  const script = `${TOAST_SCRIPT}
var _rvFlags=${JSON.stringify(reviewFlags)};
var _tdFlags=${JSON.stringify(tenderFlags)};
function renderFlags(type){const list=type==='review'?_rvFlags:_tdFlags;const el=document.getElementById(type+'-flags-list');if(!el)return;el.innerHTML=list.map(f=>'<span class="pill pill-neutral" style="display:inline-flex;align-items:center;gap:4px">'+f+'<button type="button" onclick="removeFlag(\\''+type+'\\',\\''+f.replace(/'/g,"\\'")+'\\')" style="background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;color:inherit">&times;</button></span>').join('')}
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
    <td class="text-sm">${p.granted_at ? new Date(p.granted_at * 1000).toLocaleDateString() : '-'}</td>
    <td><button class="btn btn-error btn-xs btn-outline" onclick="revokePermission('${esc(p.id)}')">Revoke</button></td>
  </tr>`).join('');
  const content = `${settingsBack()}<div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">MWR Permissions</h1>
    <button class="btn btn-primary btn-sm" onclick="document.getElementById('grant-perm-dialog').style.display='flex'">+ Grant Permission</button>
  </div>
  ${inlineTable(['Entity Type','Entity ID','User ID','Permission','Granted','Actions'], rows, 'No permissions configured')}
  <div id="grant-perm-dialog" class="dialog-overlay" style="display:none" role="dialog" aria-modal="true">
    <div class="dialog-panel" style="max-width:460px">
      <div class="dialog-header"><span class="dialog-title">Grant Permission</span><button class="dialog-close" onclick="document.getElementById('grant-perm-dialog').style.display='none'">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label>Entity Type</label><input id="gp-entity-type" class="form-input" placeholder="review"/></div>
        <div class="modal-form-group"><label>Entity ID</label><input id="gp-entity-id" class="form-input" placeholder="entity id"/></div>
        <div class="modal-form-group"><label>User ID</label><input id="gp-user-id" class="form-input" placeholder="user id"/></div>
        <div class="modal-form-group"><label>Permission Type</label><select id="gp-perm-type" class="form-input"><option value="view">view</option><option value="edit">edit</option><option value="admin">admin</option></select></div>
        <div id="gp-result" style="display:none;margin-top:8px"></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('grant-perm-dialog').style.display='none'">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="grantPermission()">Grant</button>
      </div>
    </div>
  </div>`;
  const script = `${TOAST_SCRIPT}async function grantPermission(){var body={entity_type:document.getElementById('gp-entity-type').value.trim(),entity_id:document.getElementById('gp-entity-id').value.trim(),user_id:document.getElementById('gp-user-id').value.trim(),permission_type:document.getElementById('gp-perm-type').value};var res=document.getElementById('gp-result');if(!body.entity_type||!body.entity_id||!body.user_id){res.style.display='block';res.innerHTML='<div style="color:var(--color-danger);font-size:13px">All fields required.</div>';return}try{var r=await fetch('/api/mwr/permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var d=await r.json();if(r.ok&&d.success){showToast('Permission granted','success');document.getElementById('grant-perm-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{res.style.display='block';res.innerHTML='<div style="color:var(--color-danger);font-size:13px">'+(d.error||'Failed')+'</div>'}}catch(e){showToast('Error: '+e.message,'error')}}async function revokePermission(id){if(!confirm('Revoke this permission?'))return;try{var r=await fetch('/api/permission/'+id,{method:'DELETE'});if(r.ok){showToast('Revoked','success');setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}`;
  return settingsPage(user, 'MWR Permissions', bc('MWR Permissions'), content, [script]);
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
  window.deleteTplSection=async function(id){if(!confirm('Delete this section?'))return;try{var res=await fetch('/api/review_template_section/'+id,{method:'DELETE'});if(res.ok){showToast('Deleted','success');setTimeout(function(){location.reload()},500)}else{showToast('Delete failed','error')}}catch(e){showToast('Error','error')}};`;
  return settingsPage(user, `Manage Template - ${esc(template.name || 'Template')}`, tplBc, content, [script]);
}
