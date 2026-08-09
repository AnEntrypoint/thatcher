import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';

export function renderTemplateList(user, entityNames, templatesByEntity) {
  const sections = entityNames.map(entityName => {
    const templates = templatesByEntity[entityName] || [];
    const rows = templates.map(t =>
      `<tr><td>${esc(t.name)}</td><td><button type="button" class="btn-ghost-clean" data-action="deleteTemplate" data-args='["${esc(t.id)}"]'>Delete</button></td></tr>`
    ).join('') || '<tr><td colspan="2">No templates</td></tr>';
    return `<div class="card-clean" style="margin-bottom:16px"><div class="card-clean-body">
      <h3 style="margin-bottom:8px">${esc(entityName)}</h3>
      <table class="data-table"><thead><tr><th>Name</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:8px;display:flex;gap:8px">
        <input type="text" id="new-tpl-name-${esc(entityName)}" placeholder="Template name" style="flex:1">
        <button type="button" class="btn-primary-clean" data-action="createTemplate" data-args='["${esc(entityName)}"]'>Add (blank)</button>
      </div>
    </div></div>`;
  }).join('');

  const content = `<div class="page-header"><h1 class="page-title">Record Templates</h1></div>
    <p style="font-size:13px;color:var(--color-text-muted,#666);margin-bottom:16px">Templates created here start blank; edit field_values via the entity_template record to set starter values.</p>
    ${sections}
    <span id="tpl-status" style="font-size:13px"></span>`;

  const script = `(function(){
    window.createTemplate=function(entity){
      var input=document.getElementById('new-tpl-name-'+entity);
      var name=(input.value||'').trim();
      var status=document.getElementById('tpl-status');
      if(!name){status.textContent='Name required';return}
      status.textContent='Creating...';
      fetch('/api/entity_template/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:entity,name:name,field_values:{}})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'create failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
    window.deleteTemplate=function(id){
      var status=document.getElementById('tpl-status');
      status.textContent='Deleting...';
      fetch('/api/entity_template/'+id+'/delete',{method:'POST'})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'delete failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
  })();`;

  return page(user, 'Record Templates | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { label: 'Templates' }], content, [script]);
}
