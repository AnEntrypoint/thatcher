import { page } from '@/ui/layout.js';
import { esc, statusPill, TABLE_SCRIPT } from '@/ui/render-helpers.js';
import { getStateField, getStageLabels } from '@/lib/workflow-engine.js';

function cardTitleField(spec) {
  if (spec.list?.titleField) return spec.list.titleField;
  const candidates = ['name', 'title', 'label'];
  for (const c of candidates) if (spec.fields?.[c]) return c;
  const first = Object.keys(spec.fields || {}).find(k => spec.fields[k]?.type === 'text');
  return first || 'id';
}

function boardCard(entityName, record, titleField) {
  const title = esc(record[titleField] ?? record.id);
  const status = record.status !== undefined ? statusPill(record.status) : '';
  return `<div class="board-card" draggable="true" data-id="${esc(record.id)}" data-navigate="/${esc(entityName)}/${esc(record.id)}">
    <div class="board-card-title">${title}</div>
    ${status ? `<div class="board-card-meta">${status}</div>` : ''}
  </div>`;
}

function boardColumn(entityName, stageKey, stageLabel, records, titleField) {
  const cards = records.map(r => boardCard(entityName, r, titleField)).join('') ||
    `<div class="board-column-empty">No items</div>`;
  return `<div class="board-column" data-stage="${esc(stageKey)}">
    <div class="board-column-header"><span>${esc(stageLabel)}</span><span class="board-column-count">${records.length}</span></div>
    <div class="board-column-body" data-drop-zone="${esc(stageKey)}">${cards}</div>
  </div>`;
}

const BOARD_SCRIPT = `(function(){
  document.addEventListener('dragstart',e=>{const c=e.target.closest('.board-card');if(!c)return;e.dataTransfer.setData('text/plain',c.dataset.id);c.classList.add('dragging')});
  document.addEventListener('dragend',e=>{const c=e.target.closest('.board-card');if(c)c.classList.remove('dragging')});
  document.addEventListener('dragover',e=>{const z=e.target.closest('[data-drop-zone]');if(z)e.preventDefault()});
  document.addEventListener('drop',async e=>{
    const zone=e.target.closest('[data-drop-zone]');if(!zone)return;e.preventDefault();
    const id=e.dataTransfer.getData('text/plain');if(!id)return;
    const toStage=zone.dataset.dropZone;
    const board=document.getElementById('board-root');
    const entity=board.dataset.entity, workflow=board.dataset.workflow;
    try{
      const r=await fetch('/api/'+entity+'/'+id+'/transition',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workflow,toState:toStage})});
      if(r.ok)location.reload();else{const d=await r.json().catch(()=>({}));showToast(d.error||'Transition failed','error')}
    }catch(err){showToast(err.message,'error')}
  });
})();`;

export function renderBoardView(user, entityName, spec, records, options = {}) {
  const workflowName = options.workflow || spec.workflow;
  if (!workflowName) {
    return page(user, `${spec.labelPlural || spec.label} | Board`, null,
      `<div class="board-empty-state">This entity has no workflow configured; board view requires a <code>workflow</code> key on the entity spec.</div>`);
  }
  const stateField = getStateField(workflowName);
  const stageLabels = getStageLabels(workflowName);
  const titleField = cardTitleField(spec);

  const grouped = {};
  for (const key of Object.keys(stageLabels)) grouped[key] = [];
  for (const r of records) {
    const stage = r[stateField];
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(r);
  }

  const columns = Object.entries(stageLabels)
    .map(([key, label]) => boardColumn(entityName, key, label, grouped[key] || [], titleField))
    .join('');

  const content = `<div class="page-header">
      <div><h1 class="page-title">${esc(spec.labelPlural || spec.label)}</h1><p class="page-subtitle">${records.length} items</p></div>
    </div>
    <div id="board-root" class="board-view" data-entity="${esc(entityName)}" data-workflow="${esc(workflowName)}">${columns}</div>`;

  return page(user, `${spec.labelPlural || spec.label} | Board`, null, content, [TABLE_SCRIPT, BOARD_SCRIPT]);
}
