import { h } from '@/ui/webjsx.js'
import { STAGE_COLORS, TOAST_SCRIPT } from '@/ui/render-helpers.js'

const DIALOG_COLORS = ['#B0B0B0','#44BBA4','#FF4141','#7F7EFF','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#ef4444','#22c55e','#06b6d4','#f97316','#84cc16','#e11d48','#14b8a6','#6366f1']

export function colorPickerDialog(id = 'cpd', selected = '#B0B0B0', onSelect = '') {
  const swatches = DIALOG_COLORS.map(c =>
    `<div class="cpd-swatch${c === selected ? ' cpd-selected' : ''}" style="background:${c}" data-color="${c}" role="option" tabindex="0" aria-label="Color ${c}" aria-selected="${c === selected}" data-action="cpdSelect" data-args='["${id}","${c}",${onSelect ? "true" : "false"}]' onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();cpdSelect('${id}','${c}',${onSelect ? 'true' : 'false'})}"></div>`
  ).join('')
  return `<div id="${id}-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="${id}-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:360px">
      <div class="dialog-header"><span class="dialog-title" id="${id}-dialog-title">Choose Color</span><button class="dialog-close" data-dialog-close="${id}-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="color-picker-grid" role="listbox" aria-label="Color options">${swatches}</div>
        <div style="margin-top:0.75rem;display:flex;align-items:center;gap:0.75rem"><label class="text-sm text-gray-500" for="${id}-custom">Custom:</label><input type="color" id="${id}-custom" value="${selected}" onchange="cpdSelect('${id}',this.value,true)" aria-label="Custom color picker" style="width:40px;height:32px;border:none;cursor:pointer"/><span id="${id}-val" class="text-sm font-medium" aria-live="polite">${selected}</span></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="${id}-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="cpdConfirm" data-args='["${id}"]'>Select</button></div>
    </div></div>
  <script>window._cpd=window._cpd||{};window._cpd['${id}']='${selected}';
  window.cpdSelect=function(id,c){window._cpd[id]=c;document.getElementById(id+'-val').textContent=c;document.getElementById(id+'-custom').value=c;document.querySelectorAll('#'+id+'-dialog .cpd-swatch').forEach(function(el){el.classList.toggle('cpd-selected',el.dataset.color===c)})};
  window.cpdConfirm=function(id){var c=window._cpd[id];document.getElementById(id+'-dialog').style.display='none';if(window._cpdCallback)window._cpdCallback(c)};
  window.showColorPicker=function(id,current,cb){window._cpdCallback=cb;if(current)cpdSelect(id,current);document.getElementById(id+'-dialog').style.display='flex'};</script>`
}

export function dateChoiceDialog(id = 'dcd') {
  const presets = [
    { label: 'Today', days: 0 }, { label: 'Tomorrow', days: 1 }, { label: '+3 Days', days: 3 },
    { label: '+1 Week', days: 7 }, { label: '+2 Weeks', days: 14 }, { label: '+1 Month', days: 30 },
    { label: '+3 Months', days: 90 }, { label: 'End of Month', days: 'eom' }, { label: 'End of Quarter', days: 'eoq' },
  ]
  const presetBtns = presets.map(p => `<button class="date-preset-btn" data-action="dcdPreset" data-args='["${id}",${typeof p.days === 'number' ? p.days : '"' + p.days + '"'}]'>${p.label}</button>`).join('')
  return `<div id="${id}-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="${id}-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:380px">
      <div class="dialog-header"><span class="dialog-title" id="${id}-dialog-title">Choose Date</span><button class="dialog-close" data-dialog-close="${id}-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="${id}-input">Date</label><input type="date"  id="${id}-input" class="input input-bordered w-full"/></div>
        <div class="date-presets">${presetBtns}</div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="${id}-dialog">Cancel</button><button class="btn btn-error btn-outline btn-sm" data-action="dcdClear" data-args='["${id}"]'>Clear</button><button class="btn btn-primary btn-sm" data-action="dcdConfirm" data-args='["${id}"]'>Select</button></div>
    </div></div>
  <script>window.dcdPreset=function(id,days){var d=new Date();if(days==='eom'){d=new Date(d.getFullYear(),d.getMonth()+1,0)}else if(days==='eoq'){var q=Math.floor(d.getMonth()/3);d=new Date(d.getFullYear(),(q+1)*3,0)}else{d.setDate(d.getDate()+days)}document.getElementById(id+'-input').value=d.toISOString().split('T')[0]};
  window.dcdConfirm=function(id){var v=document.getElementById(id+'-input').value;document.getElementById(id+'-dialog').style.display='none';if(window._dcdCallback)window._dcdCallback(v||null)};
  window.dcdClear=function(id){document.getElementById(id+'-input').value='';document.getElementById(id+'-dialog').style.display='none';if(window._dcdCallback)window._dcdCallback(null)};
  window.showDateChoice=function(id,current,cb){window._dcdCallback=cb;if(current)document.getElementById(id+'-input').value=current;document.getElementById(id+'-dialog').style.display='flex'};</script>`
}

export function stageTransitionDialog(stages = null) {
  const stageKeys = stages || Object.keys(STAGE_COLORS)
  return `<div id="stage-trans-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="stage-trans-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="stage-trans-dialog-title">Transition Stage</span><button class="dialog-close" data-dialog-close="stage-trans-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div id="std-from" class="stage-trans-block stage-trans-current"></div>
        <div class="stage-trans-arrow"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></div>
        <div id="std-to" class="stage-trans-block stage-trans-next"></div>
        <div class="modal-form-group" style="margin-top:1rem"><label class="form-label" for="std-reason">Reason (optional)</label><textarea id="std-reason" class="textarea textarea-bordered w-full" rows="2" placeholder="Why is this stage being changed?"></textarea></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="stage-trans-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="stdConfirm">Confirm Transition</button></div>
    </div></div>
  <script>${TOAST_SCRIPT}
  window._stdData={};
  window.showStageTransition=function(entityId,entityType,fromStage,toStage,cb){window._stdData={entityId:entityId,entityType:entityType,from:fromStage,to:toStage,cb:cb};document.getElementById('stage-trans-dialog').style.display='flex';var sc=${JSON.stringify(Object.fromEntries(stageKeys.map(k => [k, STAGE_COLORS[k] || { bg: '#f3f4f6', text: '#4b5563', label: k }])))};var from=sc[fromStage]||{bg:'#f3f4f6',text:'#4b5563',label:fromStage};var to=sc[toStage]||{bg:'#f3f4f6',text:'#4b5563',label:toStage};document.getElementById('std-from').innerHTML='<div class="stage-trans-dot" style="background:'+from.text+'"></div><div><div class="text-xs text-gray-500">Current</div><div class="font-medium" style="color:'+from.text+'">'+from.label+'</div></div>';document.getElementById('std-to').innerHTML='<div class="stage-trans-dot" style="background:'+to.text+'"></div><div><div class="text-xs text-gray-500">Next</div><div class="font-medium" style="color:'+to.text+'">'+to.label+'</div></div>'};
  window.stdConfirm=async function(){var d=window._stdData;var reason=document.getElementById('std-reason').value;try{var res=await fetch('/api/'+d.entityType+'/'+d.entityId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:d.to,stage_reason:reason})});if(res.ok){showToast('Stage updated','success');document.getElementById('stage-trans-dialog').style.display='none';if(d.cb)d.cb();else setTimeout(function(){location.reload()},500)}else{showToast('Transition failed','error')}}catch(e){showToast('Error: '+e.message,'error')}};</script>`
}

export function teamAssignmentDialog(id = 'tad') {
  return `<div id="${id}-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="${id}-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="${id}-dialog-title">Assign Team Members</span><button class="dialog-close" data-dialog-close="${id}-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <input type="text" id="${id}-search" class="tad-search" placeholder="Search by name or email..." aria-label="Search team members" oninput="tadFilter('${id}')"/>
        <div id="${id}-list" class="tad-list"></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="${id}-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="tadConfirm" data-args='["${id}"]'>Assign</button></div>
    </div></div>
  <script>${TOAST_SCRIPT}
  window._tad=window._tad||{};
  window.showTeamAssignment=function(id,users,selected,cb){window._tad[id]={users:users,selected:new Set(selected||[]),cb:cb};document.getElementById(id+'-dialog').style.display='flex';tadRender(id)};
  function tadRender(id){var d=window._tad[id];var c=document.getElementById(id+'-list');c.innerHTML='';d.users.forEach(function(u){var row=document.createElement('div');row.className='tad-row';row.dataset.name=(u.name||'').toLowerCase();row.dataset.email=(u.email||'').toLowerCase();var checked=d.selected.has(u.id)?'checked':'';row.innerHTML='<input type="checkbox" '+checked+' onchange="tadToggle(\\''+id+'\\',\\''+u.id+'\\') " aria-label="Select '+(u.name||'Unknown').replace(/"/g,'&quot;')+'">'+'<div><div class="tad-name">'+(u.name||'Unknown')+'</div><div class="tad-email">'+(u.email||'')+'</div></div>';c.appendChild(row)})}
  window.tadFilter=function(id){var q=document.getElementById(id+'-search').value.toLowerCase();document.querySelectorAll('#'+id+'-list .tad-row').forEach(function(r){r.style.display=(r.dataset.name.includes(q)||r.dataset.email.includes(q))?'':'none'})};
  window.tadToggle=function(id,uid){var d=window._tad[id];if(d.selected.has(uid))d.selected.delete(uid);else d.selected.add(uid)};
  window.tadConfirm=function(id){var d=window._tad[id];document.getElementById(id+'-dialog').style.display='none';if(d.cb)d.cb(Array.from(d.selected))};</script>`
}

export function teamSelector(id = 'ts', teams = []) {
  const items = teams.map(t =>
    `<div class="tad-row" data-name="${(t.name || '').toLowerCase()}" data-action="tsSelect" data-args='["${id}","${t.id}","${(t.name || '').replace(/"/g, '&quot;')}"]'><div class="tad-name">${t.name || 'Unknown'}</div><div class="tad-email">${t.member_count || 0} members</div></div>`
  ).join('')
  return `<div class="ts-wrap" id="${id}-wrap">
    <div id="${id}-badges" class="ts-badges"></div>
    <input type="text" id="${id}-search" class="tad-search" placeholder="Search teams..." aria-label="Search teams" oninput="tsFilter('${id}')" onfocus="document.getElementById('${id}-dropdown').classList.add('ts-open')" />
    <div id="${id}-dropdown" class="ts-dropdown">${items}</div>
    <input type="hidden" id="${id}-value" name="team_id" value=""/>
  </div>
  <script>window._ts=window._ts||{};window._ts['${id}']=[];
  window.tsFilter=function(id){var q=document.getElementById(id+'-search').value.toLowerCase();document.querySelectorAll('#'+id+'-dropdown .tad-row').forEach(function(r){r.style.display=r.dataset.name.includes(q)?'':'none'})};
  window.tsSelect=function(id,tid,name){window._ts[id].push({id:tid,name:name});tsRender(id);document.getElementById(id+'-dropdown').classList.remove('ts-open');document.getElementById(id+'-search').value=''};
  function tsRender(id){var b=document.getElementById(id+'-badges');b.innerHTML='';window._ts[id].forEach(function(t,i){b.innerHTML+='<span class="ts-badge">'+t.name+' <span class="ts-badge-x" data-action="tsRemove" data-args=\\'["'+id+'",'+i+']\\' >&times;</span></span>'});document.getElementById(id+'-value').value=window._ts[id].map(function(t){return t.id}).join(',')}
  window.tsRemove=function(id,idx){window._ts[id].splice(idx,1);tsRender(id)};
  document.addEventListener('click',function(e){if(!document.getElementById('${id}-wrap').contains(e.target))document.getElementById('${id}-dropdown').classList.remove('ts-open')});</script>`
}
