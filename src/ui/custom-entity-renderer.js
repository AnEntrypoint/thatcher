import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';

const FIELD_TYPES = ['text', 'textarea', 'email', 'number', 'currency', 'date', 'enum', 'bool', 'multiselect', 'ref', 'multiref', 'file', 'json'];

export function renderCustomEntityList(user, defs) {
  const rows = defs.map(d => {
    const fieldsArr = typeof d.fields === 'string' ? JSON.parse(d.fields || '[]') : (d.fields || []);
    const fieldSummary = fieldsArr.map(f => `${f.key}:${f.type}`).join(', ');
    return `<tr>
      <td>${esc(d.name)}</td>
      <td>${esc(d.label)}</td>
      <td style="font-size:12px">${esc(fieldSummary)}</td>
      <td><a href="/${esc(d.name.toLowerCase().replace(/[^a-z0-9]+/g,'_'))}" class="btn-ghost-clean">View</a>
        <button type="button" class="btn-ghost-clean" data-action="deleteCustomEntity" data-args='["${esc(d.id)}"]'>Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="4">No custom entities</td></tr>';

  const typeOpts = FIELD_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  const content = `<div class="page-header"><h1 class="page-title">Custom Entities</h1></div>
    <p style="font-size:13px;color:var(--color-text-muted,#666);margin-bottom:16px">Define a brand-new entity at runtime -- once created, it gets the full generic list/detail/form/board/report views and API every built-in entity has, with zero code.</p>
    <div class="card-clean" style="margin-bottom:16px"><div class="card-clean-body">
      <table class="data-table"><thead><tr><th>Name</th><th>Label</th><th>Fields</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div></div>
    <div class="card-clean"><div class="card-clean-body">
      <h3 style="margin-bottom:8px">New Custom Entity</h3>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:560px">
        <input type="text" id="new-entity-name" placeholder="Internal name, e.g. equipment" class="form-input">
        <input type="text" id="new-entity-label" placeholder="Label, e.g. Equipment" class="form-input">
        <input type="text" id="new-entity-label-plural" placeholder="Plural label, e.g. Equipment Items" class="form-input">
        <div id="field-rows"></div>
        <button type="button" class="btn-ghost-clean" data-action="addFieldRow">+ Add Field</button>
        <button type="button" class="btn-primary-clean" data-action="createCustomEntity">Create Entity</button>
      </div>
    </div></div>
    <span id="custom-entity-status" style="font-size:13px"></span>`;

  const script = `(function(){
    var fieldRowCount=0;
    function addFieldRow(){
      var container=document.getElementById('field-rows');
      var idx=fieldRowCount++;
      var row=document.createElement('div');
      row.className='field-row';
      row.style.cssText='display:flex;gap:6px;margin:4px 0';
      row.innerHTML='<input type="text" class="form-input field-key" placeholder="key" style="flex:1">'+
        '<select class="form-input field-type" style="flex:1">${typeOpts}</select>'+
        '<input type="text" class="form-input field-label" placeholder="label" style="flex:1">'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="checkbox" class="field-required">required</label>'+
        '<button type="button" class="btn-ghost-clean" data-action="removeFieldRow">x</button>';
      container.appendChild(row);
    }
    window.addFieldRow=addFieldRow;
    window.removeFieldRow=function(btn){ if(btn&&btn.closest)btn.closest('.field-row').remove() };
    addFieldRow();

    window.createCustomEntity=function(){
      var status=document.getElementById('custom-entity-status');
      var name=(document.getElementById('new-entity-name').value||'').trim();
      var label=(document.getElementById('new-entity-label').value||'').trim();
      var labelPlural=(document.getElementById('new-entity-label-plural').value||'').trim();
      if(!name){status.textContent='Name required';return}
      if(!label){status.textContent='Label required';return}
      var fields=[];
      document.querySelectorAll('.field-row').forEach(function(row){
        var key=row.querySelector('.field-key').value.trim();
        var type=row.querySelector('.field-type').value;
        var flabel=row.querySelector('.field-label').value.trim();
        var required=row.querySelector('.field-required').checked;
        if(key)fields.push({key:key,type:type,label:flabel||key,required:required});
      });
      if(!fields.length){status.textContent='At least one field required';return}
      status.textContent='Creating...';
      fetch('/api/custom_entity_def/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,label:label,label_plural:labelPlural,fields:fields})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'create failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
    window.deleteCustomEntity=function(id){
      var status=document.getElementById('custom-entity-status');
      status.textContent='Deleting...';
      fetch('/api/custom_entity_def/'+id+'/delete',{method:'POST'})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'delete failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
  })();`;

  return page(user, 'Custom Entities | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { label: 'Custom Entities' }], content, [script]);
}
