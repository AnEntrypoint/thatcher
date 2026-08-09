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
      row.style.cssText='display:flex;flex-direction:column;gap:4px;margin:4px 0;padding:6px;border:1px solid var(--color-border,#eee);border-radius:4px';
      row.innerHTML='<div style="display:flex;gap:6px">'+
        '<input type="text" class="form-input field-key" placeholder="key" style="flex:1">'+
        '<select class="form-input field-type" style="flex:1">${typeOpts}</select>'+
        '<input type="text" class="form-input field-label" placeholder="label" style="flex:1">'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="checkbox" class="field-required">required</label>'+
        '<button type="button" class="btn-ghost-clean" data-action="removeFieldRow">x</button>'+
        '</div>'+
        '<details><summary style="font-size:12px;cursor:pointer">Cross-entity rule (optional)</summary>'+
        '<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">'+
        '<input type="text" class="form-input rule-ref-field" placeholder="ref field, e.g. project_id" style="flex:1;min-width:120px">'+
        '<input type="text" class="form-input rule-related-field" placeholder="related field, e.g. status" style="flex:1;min-width:120px">'+
        '<select class="form-input rule-operator" style="flex:1;min-width:100px">'+
        '<option value="">No rule</option><option value="equals">equals</option><option value="not_equals">not_equals</option>'+
        '<option value="gt">gt</option><option value="gte">gte</option><option value="lt">lt</option><option value="lte">lte</option>'+
        '</select>'+
        '<input type="text" class="form-input rule-value" placeholder="value (simple rule)" style="flex:1;min-width:100px">'+
        '<input type="text" class="form-input rule-aggregate-field" placeholder="aggregate field (sum, optional)" style="flex:1;min-width:140px">'+
        '<input type="text" class="form-input rule-limit-field" placeholder="limit field on related entity (optional)" style="flex:1;min-width:160px">'+
        '</div></details>';
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
        if(!key)return;
        var field={key:key,type:type,label:flabel||key,required:required};
        var ruleOperator=row.querySelector('.rule-operator').value;
        if(ruleOperator){
          var refField=row.querySelector('.rule-ref-field').value.trim();
          var relatedField=row.querySelector('.rule-related-field').value.trim();
          var aggregateField=row.querySelector('.rule-aggregate-field').value.trim();
          var limitField=row.querySelector('.rule-limit-field').value.trim();
          if(refField){
            if(aggregateField&&limitField){
              field.cross_entity_rule={ref_field:refField,aggregate:'sum',aggregate_field:aggregateField,operator:ruleOperator,limit_field:limitField};
            } else if(relatedField){
              field.cross_entity_rule={ref_field:refField,related_field:relatedField,operator:ruleOperator,value:row.querySelector('.rule-value').value};
            }
          }
        }
        fields.push(field);
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
