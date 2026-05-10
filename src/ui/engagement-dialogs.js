import { statusLabel } from '@/ui/renderer.js';
import { createDialog } from '@/ui/dialog-factory.js';
import { esc } from '@/ui/render-helpers.js';

export function engagementFileSearchDialog(engagementId) {
  const body = `<div class="modal-form-group"><label for="efs-query" class="sr-only">Search files</label><input type="text" id="efs-query" class="input input-bordered w-full" placeholder="Search files..." aria-label="Search engagement files" oninput="efsSearch()"/></div><div id="efs-results" class="flex flex-col gap-2" style="max-height:400px;overflow:auto"></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="file-search-dialog">Close</button>`;
  return createDialog('file-search-dialog', 'Search Engagement Files', body, footer) + `
  <script>
  var efsTimer=null;
  window.efsSearch=function(){clearTimeout(efsTimer);efsTimer=setTimeout(function(){var q=document.getElementById('efs-query').value.trim();if(!q){document.getElementById('efs-results').innerHTML='';return}fetch('/api/file?engagement_id=${engagementId}&search='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){var files=d.data||d||[];var el=document.getElementById('efs-results');if(!files.length){el.innerHTML='<div class="text-gray-500 text-sm text-center py-4">No files found</div>';return}el.innerHTML=files.map(function(f){return'<div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" data-action="previewAttachment" data-args=\\'["/api/file/'+f.id+'/download","'+((f.name||'').replace(/"/g,'&quot;'))+'","'+((f.mime_type||'').replace(/"/g,'&quot;'))+'"]\\'>
<div><div class="text-sm font-medium">'+(f.name||'Unknown')+'</div><div class="text-xs text-gray-500">'+(f.size?Math.round(f.size/1024)+'KB':'')+'</div></div><span class="badge-status text-xs">'+(f.type||'file')+'</span></div>'}).join('')}).catch(function(){document.getElementById('efs-results').innerHTML='<div class="text-red-500 text-sm">Search error</div>'})},300)};
  </script>`;
}

export function postRfiJournalDialog(engagementId) {
  const body = `<div class="modal-form-group"><label for="prj-type">Entry Type</label><select id="prj-type" class="select select-bordered w-full"><option value="note">Note</option><option value="finding">Finding</option><option value="follow_up">Follow Up</option><option value="resolution">Resolution</option></select></div>
    <div class="modal-form-group"><label for="prj-title">Title</label><input id="prj-title" class="input input-bordered w-full" placeholder="Journal entry title"/></div>
    <div class="modal-form-group"><label for="prj-content">Content</label><textarea id="prj-content" class="textarea textarea-bordered w-full" rows="5" placeholder="Describe the entry..."></textarea></div>
    <div class="modal-form-group"><label for="prj-file">File Attachment</label><input type="file" id="prj-file" class="file-input file-input-bordered w-full file-input-sm"/></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="post-rfi-journal">Cancel</button><button class="btn btn-primary btn-sm" data-action="prjSave">Save Entry</button>`;
  return createDialog('post-rfi-journal', 'Post-RFI Journal Entry', body, footer) + `
  <script>
  window.openPostRfiJournal=function(){document.getElementById('post-rfi-journal').style.display='flex'};
  window.prjSave=async function(){var title=document.getElementById('prj-title').value.trim();var content=document.getElementById('prj-content').value.trim();if(!title||!content){showToast('Title and content required','error');return}var fd=new FormData();fd.append('engagement_id','${engagementId}');fd.append('type',document.getElementById('prj-type').value);fd.append('title',title);fd.append('content',content);var file=document.getElementById('prj-file').files[0];if(file)fd.append('file',file);try{var r=await fetch('/api/journal',{method:'POST',body:fd});if(r.ok){showToast('Journal entry saved','success');document.getElementById('post-rfi-journal').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function postRfiFileUpload(engagementId) {
  return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body"><h3 style="font-size:0.875rem;font-weight:600">Upload Post-RFI Files</h3><div class="mt-3"><input type="file" id="prfi-files" class="file-input file-input-bordered w-full" multiple/><div class="flex justify-end mt-2"><button class="btn btn-primary btn-sm" data-action="prfiUpload">Upload</button></div><div id="prfi-progress" class="mt-2"></div></div></div></div>
  <script>
  window.prfiUpload=async function(){var files=document.getElementById('prfi-files').files;if(!files.length){showToast('Select files','error');return}var prog=document.getElementById('prfi-progress');prog.innerHTML='Uploading '+files.length+' file(s)...';var ok=0;for(var i=0;i<files.length;i++){var fd=new FormData();fd.append('file',files[i]);fd.append('engagement_id','${engagementId}');fd.append('type','post_rfi');try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok)ok++;prog.innerHTML='Uploaded '+(i+1)+' of '+files.length}catch(e){}}prog.innerHTML=ok+' of '+files.length+' uploaded successfully';if(ok>0)showToast(ok+' files uploaded','success')};
  </script>`;
}

export function importReviewQueriesDialog(engagementId) {
  const body = `<div class="modal-form-group"><label for="irq-source">Source</label><select id="irq-source" class="select select-bordered w-full"><option value="csv">CSV File</option><option value="review">From Another Review</option><option value="template">From Template</option></select></div>
    <div id="irq-csv-upload"><div class="modal-form-group"><label for="irq-file">CSV File</label><input type="file" id="irq-file" class="file-input file-input-bordered w-full" accept=".csv,.xlsx"/></div></div>
    <div id="irq-review-select" style="display:none"><div class="modal-form-group"><label for="irq-review">Select Review</label><select id="irq-review" class="select select-bordered w-full"></select></div></div>
    <div id="irq-preview" class="text-sm text-gray-500 mt-2"></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="import-queries-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="irqImport">Import</button>`;
  return createDialog('import-queries-dialog', 'Import Review Queries', body, footer) + `
  <script>
  document.getElementById('irq-source').addEventListener('change',function(){var v=this.value;document.getElementById('irq-csv-upload').style.display=v==='csv'?'':'none';document.getElementById('irq-review-select').style.display=v==='review'?'':'none';if(v==='review'){fetch('/api/review?engagement_id=${engagementId}').then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('irq-review');while(sel.options.length>0)sel.remove(0);(d.data||d||[]).forEach(function(r){var o=document.createElement('option');o.value=r.id;o.textContent=r.name||r.title||r.id;sel.appendChild(o)})}).catch(function(){})}});
  window.irqImport=async function(){var source=document.getElementById('irq-source').value;if(source==='csv'){var file=document.getElementById('irq-file').files[0];if(!file){showToast('Select a file','error');return}var fd=new FormData();fd.append('file',file);fd.append('engagement_id','${engagementId}');try{var r=await fetch('/api/rfi_question/import',{method:'POST',body:fd});if(r.ok){var d=await r.json();showToast((d.count||'')+'queries imported','success');document.getElementById('import-queries-dialog').style.display='none';location.reload()}else showToast('Import failed','error')}catch(e){showToast('Error','error')}}else if(source==='review'){var rid=document.getElementById('irq-review').value;if(!rid){showToast('Select a review','error');return}try{var r=await fetch('/api/rfi_question/import-from-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({review_id:rid,engagement_id:'${engagementId}'})});if(r.ok){showToast('Queries imported','success');document.getElementById('import-queries-dialog').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}}};
  </script>`;
}

export function engagementNotificationSettings(engagementId) {
  const body = `<div class="flex flex-col gap-3">
    <label class="flex items-center gap-2"><input type="checkbox" class="checkbox eng-notif-cb" value="rfi_response" checked/><span class="text-sm">RFI Responses</span></label>
    <label class="flex items-center gap-2"><input type="checkbox" class="checkbox eng-notif-cb" value="rfi_overdue" checked/><span class="text-sm">Overdue RFI Items</span></label>
    <label class="flex items-center gap-2"><input type="checkbox" class="checkbox eng-notif-cb" value="review_comment" checked/><span class="text-sm">Review Comments</span></label>
    <label class="flex items-center gap-2"><input type="checkbox" class="checkbox eng-notif-cb" value="file_upload"/><span class="text-sm">File Uploads</span></label>
    <label class="flex items-center gap-2"><input type="checkbox" class="checkbox eng-notif-cb" value="stage_change" checked/><span class="text-sm">Stage Changes</span></label>
    <label class="flex items-center gap-2"><input type="checkbox" class="checkbox eng-notif-cb" value="team_message"/><span class="text-sm">Team Messages</span></label>
  </div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="eng-notif-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="ensNotifSave">Save</button>`;
  return createDialog('eng-notif-dialog', 'Notification Settings', body, footer) + `
  <script>
  window.openEngNotifSettings=function(){document.getElementById('eng-notif-dialog').style.display='flex';fetch('/api/engagement/${engagementId}').then(function(r){return r.json()}).then(function(d){var settings;try{settings=JSON.parse((d.data||d).notification_settings||'[]')}catch(e){settings=[]}document.querySelectorAll('.eng-notif-cb').forEach(function(cb){cb.checked=!settings.length||settings.includes(cb.value)})}).catch(function(){})};
  window.ensNotifSave=async function(){var vals=[].slice.call(document.querySelectorAll('.eng-notif-cb:checked')).map(function(c){return c.value});try{var r=await fetch('/api/engagement/${engagementId}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({notification_settings:JSON.stringify(vals)})});if(r.ok){showToast('Notification settings saved','success');document.getElementById('eng-notif-dialog').style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function notificationTriggerDialog() {
  const body = `<div class="modal-form-group"><label for="ntr-event">Event</label><select id="ntr-event" class="select select-bordered w-full"><option value="rfi_overdue">RFI Overdue</option><option value="deadline_approaching">Deadline Approaching</option><option value="stage_change">Stage Change</option><option value="assignment">New Assignment</option><option value="response_received">Response Received</option></select></div>
    <div class="modal-form-group"><label for="ntr-channel">Channel</label><select id="ntr-channel" class="select select-bordered w-full"><option value="email">Email</option><option value="in_app">In-App</option><option value="both">Both</option></select></div>
    <div class="modal-form-group"><label for="ntr-recipients">Recipients</label><select id="ntr-recipients" class="select select-bordered w-full"><option value="team">Engagement Team</option><option value="assigned">Assigned User Only</option><option value="managers">Managers Only</option><option value="all">All Stakeholders</option></select></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="notif-trigger-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="ntrSave">Create Trigger</button>`;
  return createDialog('notif-trigger-dialog', 'Create Notification Trigger', body, footer) + `
  <script>
  window.openNotifTrigger=function(){document.getElementById('notif-trigger-dialog').style.display='flex'};
  window.ntrSave=async function(){try{var r=await fetch('/api/notification_trigger',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:document.getElementById('ntr-event').value,channel:document.getElementById('ntr-channel').value,recipients:document.getElementById('ntr-recipients').value})});if(r.ok){showToast('Trigger created','success');document.getElementById('notif-trigger-dialog').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function retryHighlightDialog(reviewId) {
  const body = `<div class="modal-form-group"><label for="rhd-hid">Highlight ID</label><input id="rhd-hid" class="input input-bordered w-full" placeholder="highlight identifier"/></div><div class="modal-form-group"><label for="rhd-prompt">Override prompt (optional)</label><textarea id="rhd-prompt" class="textarea textarea-bordered w-full" rows="3" placeholder="Custom ML prompt"></textarea></div><div class="text-xs" style="color:var(--ds-muted)">Reruns ML extraction for the chosen highlight.</div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="retry-highlight-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rhdSubmit">Retry</button>`;
  return createDialog('retry-highlight-dialog', 'Retry Highlight', body, footer) + `
  <script>
  window.openRetryHighlight=function(hid){document.getElementById('retry-highlight-dialog').style.display='flex';if(hid)document.getElementById('rhd-hid').value=hid};
  window.rhdSubmit=async function(){var hid=document.getElementById('rhd-hid').value.trim();if(!hid){showToast('Highlight id required','error');return}try{var r=await fetch('/api/mwr/review/${reviewId}/highlights/'+encodeURIComponent(hid),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({retry:true,prompt:document.getElementById('rhd-prompt').value.trim()||undefined})});if(r.ok){showToast('Highlight rerun queued','success');document.getElementById('retry-highlight-dialog').style.display='none'}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function switchTemplateButton(reviewId) {
  return `<button class="btn btn-outline btn-sm" type="button" data-action="openSwitchTemplate" aria-label="Switch template">Switch template</button>
  <script>
  window.openSwitchTemplate=function(){if(typeof window.showTemplateChoice==='function'){window.showTemplateChoice(async function(t){try{var r=await fetch('/api/review/${reviewId}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({review_template_id:t.id})});if(r.ok){showToast('Template switched','success');setTimeout(function(){location.reload()},400)}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}})}else{showToast('Template chooser unavailable','error')}};
  </script>`;
}

export function teamChatChannelToggle(engagementId, chatEnabled) {
  return `<div class="flex items-center gap-3"><span class="text-sm" id="team-chat-label">Team Chat</span><div class="rvw-toggle ${chatEnabled ? 'rvw-toggle-on' : ''}" role="switch" tabindex="0" aria-checked="${chatEnabled}" aria-labelledby="team-chat-label" data-action="toggleTeamChat" data-self onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleTeamChat(this)}"><div class="rvw-toggle-track"><div class="rvw-toggle-knob"></div></div></div></div>
  <script>
  window.toggleTeamChat=async function(el){var on=el.classList.toggle('rvw-toggle-on');el.setAttribute('aria-checked',on);try{await fetch('/api/engagement/${engagementId}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_enabled:on})});showToast('Chat '+(on?'enabled':'disabled'),'success')}catch(e){el.classList.toggle('rvw-toggle-on');el.setAttribute('aria-checked',!on);showToast('Error','error')}};
  </script>`;
}
