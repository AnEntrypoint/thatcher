export function fridayGlobalsCrossApp() {
  return `<script>
  window.__FRIDAY_GLOBALS__=window.__FRIDAY_GLOBALS__||{};
  window.__FRIDAY_GLOBALS__.domain='friday';
  window.__FRIDAY_GLOBALS__.apiBase='/api';
  window.__FRIDAY_GLOBALS__.crossApp=true;
  window.__FRIDAY_GLOBALS__.getAuth=function(){return window.__AUTH__||null};
  </script>`;
}

export function fridayTeamDialog() {
  return `<div id="friday-team-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="friday-team-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="friday-team-dialog-title">Assign Team</span><button class="dialog-close" data-dialog-close="friday-team-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div id="ftd-teams" class="flex flex-col gap-2"></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="friday-team-dialog">Close</button></div>
    </div></div>
  <script>
  window._ftdCallback=null;
  window.showFridayTeamDialog=function(currentTeamId,cb){window._ftdCallback=cb;document.getElementById('friday-team-dialog').style.display='flex';fetch('/api/team').then(function(r){return r.json()}).then(function(d){var teams=d.data||d||[];var el=document.getElementById('ftd-teams');el.innerHTML=teams.map(function(t){var sel=t.id===currentTeamId?' style="background:#dbeafe"':'';return'<div class="p-2 rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center"'+sel+' data-action="ftdSelect" data-args='["'+t.id+'"]'><span class="text-sm font-medium">'+(t.name||t.id)+'</span><span class="text-xs text-gray-500">'+(t.member_count||0)+' members</span></div>'}).join('')||'<div class="text-gray-500 text-sm text-center py-4">No teams</div>'}).catch(function(){})};
  window.ftdSelect=function(teamId){document.getElementById('friday-team-dialog').style.display='none';if(window._ftdCallback)window._ftdCallback(teamId)};
  </script>`;
}

export function fridayDueDateDialog() {
  return `<div id="friday-due-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="friday-due-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:380px">
      <div class="dialog-header"><span class="dialog-title" id="friday-due-dialog-title">Set Due Date</span><button class="dialog-close" data-dialog-close="friday-due-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="fdd-date">Due Date</label><input type="date"  id="fdd-date" class="input input-bordered w-full"/></div>
        <div class="date-presets">
          <button class="date-preset-btn" data-action="fddPreset" data-args='[7]'>+1 Week</button>
          <button class="date-preset-btn" data-action="fddPreset" data-args='[14]'>+2 Weeks</button>
          <button class="date-preset-btn" data-action="fddPreset" data-args='[30]'>+1 Month</button>
          <button class="date-preset-btn" data-action="fddPreset" data-args='[90]'>+3 Months</button>
        </div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="friday-due-dialog">Cancel</button><button class="btn btn-error btn-outline btn-sm" data-action="fddClear">Clear</button><button class="btn btn-primary btn-sm" data-action="fddConfirm">Set</button></div>
    </div></div>
  <script>
  window._fddCallback=null;
  window.showFridayDueDate=function(current,cb){window._fddCallback=cb;document.getElementById('friday-due-dialog').style.display='flex';if(current){var d=typeof current==='number'?new Date(current*1000):new Date(current);document.getElementById('fdd-date').value=d.toISOString().split('T')[0]}};
  window.fddPreset=function(days){var d=new Date();d.setDate(d.getDate()+days);document.getElementById('fdd-date').value=d.toISOString().split('T')[0]};
  window.fddConfirm=function(){var v=document.getElementById('fdd-date').value;document.getElementById('friday-due-dialog').style.display='none';if(window._fddCallback)window._fddCallback(v?Math.floor(new Date(v).getTime()/1000):null)};
  window.fddClear=function(){document.getElementById('fdd-date').value='';document.getElementById('friday-due-dialog').style.display='none';if(window._fddCallback)window._fddCallback(null)};
  </script>`;
}

export function emailReceiveDialog() {
  return `<div id="email-receive-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="email-receive-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:640px">
      <div class="dialog-header"><span class="dialog-title" id="email-receive-dialog-title">Received Emails</span><button class="dialog-close" data-dialog-close="email-receive-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div id="erd-list" class="flex flex-col gap-2" style="max-height:400px;overflow:auto"><div class="text-gray-500 text-center py-4">Loading...</div></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="email-receive-dialog">Close</button><button class="btn btn-outline btn-sm" data-action="erdRefresh">Refresh</button></div>
    </div></div>
  <script>
  window.openEmailReceive=function(){document.getElementById('email-receive-dialog').style.display='flex';erdRefresh()};
  window.erdRefresh=function(){fetch('/api/email?direction=inbound&limit=20').then(function(r){return r.json()}).then(function(d){var emails=d.data||d||[];var el=document.getElementById('erd-list');if(!emails.length){el.innerHTML='<div class="text-gray-500 text-center py-4">No emails received</div>';return}el.innerHTML=emails.map(function(e){return'<div class="p-2 border-b hover:bg-gray-50"><div class="flex justify-between"><span class="text-sm font-medium">'+(e.subject||'No subject')+'</span><span class="text-xs text-gray-500">'+(e.received_at?new Date(e.received_at*1000).toLocaleString():'')+'</span></div><div class="text-xs text-gray-500">From: '+(e.from_email||'-')+'</div></div>'}).join('')}).catch(function(){document.getElementById('erd-list').innerHTML='<div class="text-red-500 text-center py-4">Error loading</div>'})};
  </script>`;
}

export function feeSplitDialog(engagementId) {
  return `<div id="fee-split-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="fee-split-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:560px">
      <div class="dialog-header"><span class="dialog-title" id="fee-split-dialog-title">Fee Split</span><button class="dialog-close" data-dialog-close="fee-split-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div id="fsd-splits" class="flex flex-col gap-2"></div>
        <div class="inline-form" style="margin-top:1rem">
          <div class="inline-form-row">
            <div class="inline-form-field" style="flex:1"><label for="fsd-user">User</label><select id="fsd-user" class="select select-bordered select-sm w-full"></select></div>
            <div class="inline-form-field" style="width:80px"><label for="fsd-pct">%</label><input type="number"  id="fsd-pct" class="input input-bordered input-sm" min="0" max="100" value="0"/></div>
            <div class="inline-form-field"><label>&nbsp;</label><button class="btn btn-primary btn-sm" data-action="fsdAdd">Add</button></div>
          </div>
        </div>
        <div id="fsd-total" class="text-sm font-medium mt-2"></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="fee-split-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="fsdSave">Save</button></div>
    </div></div>
  <script>
  var fsdSplits=[];
  window.openFeeSplit=function(){document.getElementById('fee-split-dialog').style.display='flex';fetch('/api/user?role=partner').then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('fsd-user');while(sel.options.length)sel.remove(0);(d.data||d||[]).forEach(function(u){var o=document.createElement('option');o.value=u.id;o.textContent=u.name||u.email;sel.appendChild(o)})}).catch(function(){});fetch('/api/engagement/${engagementId}').then(function(r){return r.json()}).then(function(d){var eng=d.data||d;try{fsdSplits=JSON.parse(eng.fee_splits||'[]')}catch(e){fsdSplits=[]}fsdRender()}).catch(function(){})};
  function fsdRender(){var el=document.getElementById('fsd-splits');el.innerHTML=fsdSplits.map(function(s,i){return'<div class="flex items-center justify-between p-2 border-b"><span class="text-sm">'+(s.name||s.user_id)+'</span><span class="font-medium">'+s.percentage+'%</span><button class="btn btn-xs btn-error btn-outline" data-action="fsdRemove" data-args='["+i+"]'>Remove</button></div>'}).join('');var total=fsdSplits.reduce(function(a,s){return a+Number(s.percentage)},0);document.getElementById('fsd-total').textContent='Total: '+total+'%';document.getElementById('fsd-total').style.color=total===100?'#22c55e':total>100?'#ef4444':'#f59e0b'}
  window.fsdAdd=function(){var uid=document.getElementById('fsd-user').value;var pct=Number(document.getElementById('fsd-pct').value);if(!uid||!pct)return;var name=document.getElementById('fsd-user').selectedOptions[0]?.textContent||uid;fsdSplits.push({user_id:uid,name:name,percentage:pct});fsdRender()};
  window.fsdRemove=function(idx){fsdSplits.splice(idx,1);fsdRender()};
  window.fsdSave=async function(){try{var r=await fetch('/api/engagement/${engagementId}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({fee_splits:JSON.stringify(fsdSplits)})});if(r.ok){showToast('Fee split saved','success');document.getElementById('fee-split-dialog').style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function buildDeploymentLogsPage(user) {
  return function renderBuildLogs(user, logs) {
    const rows = (logs || []).map(function(l) {
      const sts = l.status === 'success' ? '<span style="color:#22c55e">Success</span>' : l.status === 'failed' ? '<span style="color:#ef4444">Failed</span>' : '<span style="color:#f59e0b">' + (l.status || 'pending') + '</span>';
      return '<tr><td class="text-sm">' + (l.version || '-') + '</td><td>' + sts + '</td><td class="text-xs text-gray-500">' + (l.created_at ? new Date(l.created_at * 1000).toLocaleString() : '-') + '</td><td class="text-xs">' + (l.duration ? l.duration + 's' : '-') + '</td><td class="text-xs text-gray-500">' + (l.message || '-') + '</td></tr>';
    }).join('');
    return '<div class="mb-6"><h1 class="text-2xl font-bold">Build & Deployment Logs</h1></div><div class="card-clean"><div class="card-clean-body"><table class="data-table"><thead><tr><th>Version</th><th>Status</th><th>Time</th><th>Duration</th><th>Message</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="text-center py-4 text-gray-500">No build logs</td></tr>') + '</tbody></table></div></div>';
  };
}
