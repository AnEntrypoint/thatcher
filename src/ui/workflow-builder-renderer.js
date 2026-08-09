import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';

export function renderWorkflowList(user, workflowNames) {
  const rows = workflowNames.map(name =>
    `<tr data-row data-navigate="/admin/workflows/${esc(name)}" style="cursor:pointer"><td>${esc(name)}</td></tr>`
  ).join('') || '<tr><td>No workflows configured</td></tr>';
  const content = `<div class="page-header"><h1 class="page-title">Workflows</h1></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return page(user, 'Workflows | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { label: 'Workflows' }], content);
}

function stageRow(stage, allStageNames) {
  const forwardOpts = allStageNames.filter(n => n !== stage.name).map(n =>
    `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:10px"><input type="checkbox" name="forward_${esc(stage.name)}" value="${esc(n)}"${(stage.forward || []).includes(n) ? ' checked' : ''}>${esc(n)}</label>`
  ).join('');
  return `<div class="card-clean" style="margin-bottom:12px" data-stage-card="${esc(stage.name)}">
    <div class="card-clean-body">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
        <input type="text" name="name_${esc(stage.name)}" value="${esc(stage.name)}" placeholder="stage name" style="width:140px" readonly>
        <input type="text" name="label_${esc(stage.name)}" value="${esc(stage.label || '')}" placeholder="Label" style="flex:1">
        <input type="text" name="role_${esc(stage.name)}" value="${esc((stage.requires_role || []).join(','))}" placeholder="requires_role (comma-separated)" style="width:200px">
        <button type="button" class="btn-ghost-clean" data-action="removeStage" data-args='["${esc(stage.name)}"]'>Remove</button>
      </div>
      <div style="font-size:12px;color:var(--color-text-muted,#666)">Forward transitions:</div>
      <div>${forwardOpts || '<span style="font-size:12px;color:var(--color-text-muted,#666)">(no other stages)</span>'}</div>
    </div>
  </div>`;
}

export function renderWorkflowEditor(user, workflowName, workflowDef) {
  const stages = workflowDef?.stages || [];
  const stageNames = stages.map(s => s.name);
  const stageCards = stages.map(s => stageRow(s, stageNames)).join('');

  const content = `<div class="page-header"><h1 class="page-title">Workflow: ${esc(workflowName)}</h1></div>
    <form id="workflow-form">
      <div id="stage-list">${stageCards}</div>
      <div style="margin:16px 0;display:flex;gap:8px">
        <input type="text" id="new-stage-name" placeholder="new stage name" style="width:200px">
        <button type="button" class="btn-ghost-clean" data-action="addStage">Add Stage</button>
      </div>
      <button type="button" class="btn-primary-clean" data-action="saveWorkflow" data-args='["${esc(workflowName)}"]'>Save Workflow</button>
      <span id="save-status" style="margin-left:12px;font-size:13px"></span>
    </form>`;

  const script = `(function(){
    function collectStages(){
      var cards=document.querySelectorAll('[data-stage-card]');
      var stages=[];
      cards.forEach(function(card,idx){
        var origName=card.getAttribute('data-stage-card');
        var nameInput=card.querySelector('input[name^="name_"]');
        var labelInput=card.querySelector('input[name^="label_"]');
        var roleInput=card.querySelector('input[name^="role_"]');
        var checked=Array.prototype.slice.call(card.querySelectorAll('input[type="checkbox"]:checked')).map(function(cb){return cb.value});
        var roles=(roleInput.value||'').split(',').map(function(s){return s.trim()}).filter(Boolean);
        stages.push({name:origName,label:labelInput.value||origName,order:idx,forward:checked,requires_role:roles});
      });
      return stages;
    }
    window.addStage=function(){
      var input=document.getElementById('new-stage-name');
      var name=(input.value||'').trim();
      if(!name)return;
      if(document.querySelector('[data-stage-card="'+name+'"]')){alert('Stage already exists');return}
      var div=document.createElement('div');
      div.className='card-clean';
      div.style.marginBottom='12px';
      div.setAttribute('data-stage-card',name);
      var body=document.createElement('div');
      body.className='card-clean-body';
      var row=document.createElement('div');
      row.style.cssText='display:flex;gap:12px;align-items:center;margin-bottom:8px';
      var nameInput=document.createElement('input');
      nameInput.type='text';nameInput.name='name_'+name;nameInput.value=name;nameInput.readOnly=true;nameInput.style.width='140px';
      var labelInput=document.createElement('input');
      labelInput.type='text';labelInput.name='label_'+name;labelInput.placeholder='Label';labelInput.style.flex='1';
      var roleInput=document.createElement('input');
      roleInput.type='text';roleInput.name='role_'+name;roleInput.placeholder='requires_role (comma-separated)';roleInput.style.width='200px';
      var removeBtn=document.createElement('button');
      removeBtn.type='button';removeBtn.className='btn-ghost-clean';removeBtn.textContent='Remove';
      removeBtn.addEventListener('click',function(){window.removeStage(name)});
      row.appendChild(nameInput);row.appendChild(labelInput);row.appendChild(roleInput);row.appendChild(removeBtn);
      var hint=document.createElement('div');
      hint.style.cssText='font-size:12px;color:var(--color-text-muted,#666)';
      hint.textContent='Forward transitions: (save and reload to link)';
      body.appendChild(row);body.appendChild(hint);
      div.appendChild(body);
      document.getElementById('stage-list').appendChild(div);
      input.value='';
    };
    window.removeStage=function(name){
      var card=document.querySelector('[data-stage-card="'+name+'"]');
      if(card)card.remove();
    };
    window.saveWorkflow=function(workflowName){
      var stages=collectStages();
      var status=document.getElementById('save-status');
      status.textContent='Saving...';
      fetch('/api/workflow/'+workflowName+'/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stages:stages})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){status.textContent='Saved';status.style.color='var(--color-success,#22c55e)';setTimeout(function(){location.reload()},500)}else{status.textContent='Error: '+(res.d.error||'save failed');status.style.color='var(--color-danger,#ef4444)'}})
        .catch(function(err){status.textContent='Error: '+err.message;status.style.color='var(--color-danger,#ef4444)'});
    };
  })();`;

  return page(user, `Workflow: ${workflowName} | Thatcher`, [{ href: '/admin/settings', label: 'Settings' }, { href: '/admin/workflows', label: 'Workflows' }, { label: workflowName }], content, [script]);
}
