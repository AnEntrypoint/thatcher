import { page } from '@/ui/layout.js';
import { esc, fmtVal, TABLE_SCRIPT, emptyRow } from '@/ui/render-helpers.js';
import { getDefaultSort, getAvailableFilters, getPageSize, getEntityLabel } from '@/config/spec-helpers.js';

const EMBEDDED_TYPES = new Set(['json', 'embedded']);

export function getColumns(spec) {
  const fields = spec?.fields || {};
  const override = spec?.list?.columns;
  if (Array.isArray(override) && override.length) {
    return override
      .filter(key => fields[key])
      .map(key => [key, fields[key]]);
  }
  return Object.entries(fields).filter(([, f]) =>
    !f.hidden && !EMBEDDED_TYPES.has(f.type)
  );
}

function isEditable(field) {
  return field && field.readonly !== true;
}

function gridRow(entityName, item, columns) {
  const cells = columns.map(([key, field]) => {
    const value = item[key];
    const rendered = fmtVal(value, key, item);
    const editableAttrs = isEditable(field)
      ? ` data-editable="${esc(key)}" data-entity="${esc(entityName)}" data-record-id="${esc(item.id)}"`
      : '';
    return `<td data-col="${esc(key)}"${editableAttrs}>${rendered}</td>`;
  }).join('');
  const checkboxCell = `<td style="width:32px"><input type="checkbox" class="bulk-row-select" data-row-id="${esc(item.id)}" onclick="event.stopPropagation()"></td>`;
  return `<tr data-row data-navigate="/${esc(entityName)}/${esc(item.id)}" style="cursor:pointer">${checkboxCell}${cells}</tr>`;
}

const GRID_EDIT_SCRIPT = `(function(){
  function commitCell(td){
    var input=td.querySelector('input,select');
    if(!input)return;
    var value=input.value;
    var field=td.dataset.editable, entity=td.dataset.entity, id=td.dataset.recordId;
    var original=td.dataset.originalHtml;
    fetch('/api/'+entity+'/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({[field]:value})})
      .then(function(r){if(!r.ok)throw new Error('Save failed');return r.json()})
      .then(function(){location.reload()})
      .catch(function(err){td.innerHTML=original;if(window.showToast)showToast(err.message,'error')});
  }
  function cancelCell(td){
    var original=td.dataset.originalHtml;
    if(original!==undefined)td.innerHTML=original;
  }
  document.addEventListener('dblclick',function(e){
    var td=e.target.closest('[data-editable]');
    if(!td||td.querySelector('input,select'))return;
    e.stopPropagation();
    var field=td.dataset.editable;
    var current=(td.textContent||'').trim();
    td.dataset.originalHtml=td.innerHTML;
    var input=document.createElement('input');
    input.type='text';
    input.value=current;
    input.className='grid-cell-input';
    td.innerHTML='';
    td.appendChild(input);
    input.focus();
    input.select();
    input.addEventListener('blur',function(){commitCell(td)});
    input.addEventListener('keydown',function(ke){
      if(ke.key==='Enter'){ke.preventDefault();input.blur()}
      else if(ke.key==='Escape'){ke.preventDefault();cancelCell(td)}
    });
  });
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-editable]')&&e.target.closest('[data-editable]').querySelector('input,select')){
      e.stopPropagation();
    }
  },true);
})();`;

const BULK_OPS_SCRIPT = `(function(){
  function selectedIds(){
    return Array.prototype.slice.call(document.querySelectorAll('.bulk-row-select:checked')).map(function(cb){return cb.getAttribute('data-row-id')});
  }
  function updateToolbar(){
    var ids=selectedIds();
    var toolbar=document.getElementById('bulk-toolbar');
    var label=document.getElementById('bulk-count-label');
    if(ids.length>0){toolbar.style.display='flex';label.textContent=ids.length+' selected'}
    else{toolbar.style.display='none'}
  }
  document.addEventListener('change',function(e){
    if(e.target.classList&&e.target.classList.contains('bulk-row-select')){updateToolbar()}
    if(e.target.id==='bulk-select-all'){
      var checked=e.target.checked;
      document.querySelectorAll('.bulk-row-select').forEach(function(cb){cb.checked=checked});
      updateToolbar();
    }
  });
  function postBulk(entity,ids,action,onDone){
    var status=document.getElementById('bulk-status');
    status.textContent='Processing...';
    fetch('/api/'+entity+'/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:ids,action:action})})
      .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
      .then(function(res){
        if(res.ok){
          var failed=res.d.failed||0;
          status.textContent=res.d.succeeded+' succeeded, '+failed+' failed';
          if(failed===0){setTimeout(function(){location.reload()},800)}
        }else{status.textContent='Error: '+(res.d.error||'bulk operation failed')}
        if(onDone)onDone();
      })
      .catch(function(err){status.textContent='Error: '+err.message});
  }
  window.bulkDelete=function(entity){
    var ids=selectedIds();
    if(!ids.length)return;
    if(!window.confirm('Delete '+ids.length+' items?'))return;
    postBulk(entity,ids,{type:'delete'});
  };
  window.bulkSetField=function(entity){
    var ids=selectedIds();
    if(!ids.length)return;
    var field=document.getElementById('bulk-set-field').value;
    var value=document.getElementById('bulk-set-value').value;
    if(!field)return;
    postBulk(entity,ids,{type:'set_field',field:field,value:value});
  };
  window.bulkTransition=function(entity,workflow){
    var ids=selectedIds();
    if(!ids.length)return;
    var toState=document.getElementById('bulk-transition-target').value;
    if(!toState)return;
    postBulk(entity,ids,{type:'transition',workflow:workflow,toState:toState});
  };
})();`;

export function renderGridView(user, entityName, spec, records, options = {}) {
  const label = getEntityLabel(spec, true) || entityName;
  const columns = getColumns(spec);
  const defaultSort = getDefaultSort(spec);
  const filters = getAvailableFilters(spec);
  const pageSize = getPageSize(spec);

  const headerCells = columns.map(([key, field]) => {
    const colLabel = esc(field?.label || key);
    const isDefaultSort = key === defaultSort.field;
    return `<th data-sort="${esc(key)}" aria-label="Sort by ${colLabel}"${isDefaultSort ? ` class="sort-${esc(defaultSort.dir)}"` : ''}>${colLabel}</th>`;
  }).join('');

  const filterControls = filters.map(f => {
    const fieldKey = typeof f === 'string' ? f : f.field;
    const fieldSpec = spec.fields?.[fieldKey];
    const filterLabel = esc(fieldSpec?.label || fieldKey);
    const opts = (fieldSpec?.options || f.options || []).map(o => {
      const value = typeof o === 'string' ? o : o.value;
      const optLabel = typeof o === 'string' ? o : (o.label || o.value);
      return `<option value="${esc(value)}">${esc(optLabel)}</option>`;
    }).join('');
    return `<div class="table-filter"><select data-filter="${esc(fieldKey)}" id="filter-${esc(fieldKey)}" aria-label="Filter by ${filterLabel}"><option value="">All ${filterLabel}</option>${opts}</select></div>`;
  }).join('');

  const rows = records.map(item => gridRow(entityName, item, columns)).join('') ||
    emptyRow(columns.length || 1, `No ${esc(label.toLowerCase())} found`);

  const editableFieldOpts = columns.filter(([, f]) => isEditable(f)).map(([key, f]) =>
    `<option value="${esc(key)}">${esc(f.label || key)}</option>`
  ).join('');

  const workflowStageOpts = spec.workflowDef?.stages
    ? spec.workflowDef.stages.map(s => `<option value="${esc(s.name)}">${esc(s.label || s.name)}</option>`).join('')
    : '';
  const transitionButton = spec.workflow && workflowStageOpts
    ? `<select id="bulk-transition-target"><option value="">Transition to...</option>${workflowStageOpts}</select>
       <button type="button" class="btn-ghost-clean" data-action="bulkTransition" data-args='["${esc(entityName)}","${esc(spec.workflow)}"]'>Apply</button>`
    : '';

  const bulkToolbar = `<div id="bulk-toolbar" style="display:none;align-items:center;gap:8px;padding:8px;background:var(--color-bg-secondary,#f5f5f5);border-radius:4px;margin-bottom:8px;flex-wrap:wrap">
    <span id="bulk-count-label" style="font-size:13px;font-weight:600"></span>
    <button type="button" class="btn-danger-clean" data-action="bulkDelete" data-args='["${esc(entityName)}"]'>Delete Selected</button>
    <select id="bulk-set-field"><option value="">Set field...</option>${editableFieldOpts}</select>
    <input type="text" id="bulk-set-value" placeholder="value" style="width:120px">
    <button type="button" class="btn-ghost-clean" data-action="bulkSetField" data-args='["${esc(entityName)}"]'>Apply</button>
    ${transitionButton}
    <span id="bulk-status" style="font-size:13px"></span>
  </div>`;

  const content = `<div class="page-header">
        <div><h1 class="page-title">${esc(label)}</h1><p class="page-subtitle">${records.length} total ${esc(label.toLowerCase())}</p></div>
      </div>
      ${bulkToolbar}
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="table-search"><input id="search-input" type="text" placeholder="Search ${esc(label.toLowerCase())}..."></div>
          ${filterControls}
          <span class="table-count" id="row-count">${records.length} items</span>
        </div>
        <table class="data-table" role="grid" data-page-size="${esc(pageSize)}">
          <thead><tr><th style="width:32px"><input type="checkbox" id="bulk-select-all"></th>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  return page(user, `${label} | Thatcher`, null, content, [TABLE_SCRIPT, GRID_EDIT_SCRIPT, BULK_OPS_SCRIPT]);
}
