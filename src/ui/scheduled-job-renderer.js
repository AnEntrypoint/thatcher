import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';

function fmtTs(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

export function renderScheduledJobList(user, jobs, entityNames) {
  const rows = jobs.map(j => {
    const statusPill = j.enabled ? `<span class="pill pill-success">Enabled</span>` : `<span class="pill pill-neutral">Disabled</span>`;
    const toggleLabel = j.enabled ? 'Disable' : 'Enable';
    return `<tr>
      <td>${esc(j.name)}</td>
      <td>${esc(j.entity)}</td>
      <td>${esc(String(j.interval_minutes))} min</td>
      <td>${statusPill}</td>
      <td>${esc(fmtTs(j.last_run_at))}</td>
      <td>${esc(fmtTs(j.next_run_at))}</td>
      <td style="display:flex;gap:8px">
        <button type="button" class="btn-ghost-clean" data-action="toggleJob" data-args='["${esc(j.id)}", ${j.enabled ? 'false' : 'true'}]'>${toggleLabel}</button>
        <button type="button" class="btn-ghost-clean" data-action="deleteJob" data-args='["${esc(j.id)}"]'>Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7">No scheduled jobs</td></tr>';

  const entityOpts = entityNames.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');

  const content = `<div class="page-header"><h1 class="page-title">Scheduled Jobs</h1></div>
    <div class="card-clean" style="margin-bottom:16px"><div class="card-clean-body">
      <table class="data-table"><thead><tr><th>Name</th><th>Entity</th><th>Interval</th><th>Status</th><th>Last Run</th><th>Next Run</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div></div>
    <div class="card-clean"><div class="card-clean-body">
      <h3 style="margin-bottom:8px">New Scheduled Job</h3>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:480px">
        <input type="text" id="new-job-name" placeholder="Job name" class="form-input">
        <select id="new-job-entity" class="form-input"><option value="">Select entity...</option>${entityOpts}</select>
        <select id="new-job-action-type" class="form-input">
          <option value="delete">Delete matching records</option>
          <option value="set_field">Set field on matching records</option>
        </select>
        <input type="text" id="new-job-field" placeholder="Field name (for set_field)" class="form-input">
        <input type="text" id="new-job-value" placeholder="Value (for set_field)" class="form-input">
        <input type="text" id="new-job-filter" placeholder='Filter JSON, e.g. {"status":"pending"}' class="form-input">
        <input type="number" id="new-job-interval" placeholder="Interval (minutes)" class="form-input" min="1">
        <button type="button" class="btn-primary-clean" data-action="createJob">Create Job</button>
      </div>
    </div></div>
    <span id="job-status" style="font-size:13px"></span>`;

  const script = `(function(){
    window.createJob=function(){
      var status=document.getElementById('job-status');
      var name=(document.getElementById('new-job-name').value||'').trim();
      var entity=document.getElementById('new-job-entity').value;
      var actionType=document.getElementById('new-job-action-type').value;
      var field=(document.getElementById('new-job-field').value||'').trim();
      var value=document.getElementById('new-job-value').value;
      var filterRaw=(document.getElementById('new-job-filter').value||'').trim();
      var interval=Number(document.getElementById('new-job-interval').value);
      if(!name){status.textContent='Name required';return}
      if(!entity){status.textContent='Entity required';return}
      if(!interval||interval<=0){status.textContent='Interval must be a positive number';return}
      var filter={};
      if(filterRaw){try{filter=JSON.parse(filterRaw)}catch(e){status.textContent='Filter must be valid JSON';return}}
      var action=actionType==='set_field'?{type:'set_field',field:field,value:value}:{type:'delete'};
      status.textContent='Creating...';
      fetch('/api/scheduled_job/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,entity:entity,action:action,filter:filter,interval_minutes:interval})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'create failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
    window.toggleJob=function(id,enabled){
      var status=document.getElementById('job-status');
      status.textContent='Updating...';
      fetch('/api/scheduled_job/'+id+'/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:enabled})})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'update failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
    window.deleteJob=function(id){
      var status=document.getElementById('job-status');
      status.textContent='Deleting...';
      fetch('/api/scheduled_job/'+id+'/delete',{method:'POST'})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
        .then(function(res){if(res.ok){location.reload()}else{status.textContent='Error: '+(res.d.error||'delete failed')}})
        .catch(function(err){status.textContent='Error: '+err.message});
    };
  })();`;

  return page(user, 'Scheduled Jobs | Thatcher', [{ href: '/admin/settings', label: 'Settings' }, { label: 'Scheduled Jobs' }], content, [script]);
}
