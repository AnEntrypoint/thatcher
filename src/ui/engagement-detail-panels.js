import { esc, STAGE_CONFIG } from '@/ui/render-helpers.js';

export function stagePipelineHtml(e) {
  const currentIdx = STAGE_CONFIG.findIndex(s => s.key === e.stage);
  const stages = STAGE_CONFIG.map((s, i) => {
    const isCurrent = i === currentIdx;
    const isPast = i < currentIdx;
    const bg = isCurrent ? s.color : isPast ? s.color : '#e9ecef';
    const textColor = isCurrent || isPast ? '#fff' : '#6c757d';
    const opacity = isPast ? '0.65' : '1';
    const borderRight = i < STAGE_CONFIG.length - 1 ? 'border-right:1px solid rgba(255,255,255,0.2)' : '';
    const ringStyle = isCurrent ? `outline:2px solid ${s.color};outline-offset:1px` : '';
    return `<div data-action="openStageTransition" data-args='["${esc(s.key)}"]' title="Click to transition to: ${s.label}"
      style="flex:1;min-width:0;padding:10px 6px;text-align:center;background:${bg};color:${textColor};opacity:${opacity};font-size:0.6875rem;font-weight:${isCurrent ? '700' : '500'};cursor:pointer;position:relative;${borderRight};transition:opacity 0.15s;overflow:hidden"
      aria-label="${s.label}${isCurrent ? ' (current)' : ''}">
      ${isCurrent ? `<div style="position:absolute;inset:0;background:rgba(255,255,255,0.12);pointer-events:none"></div>` : ''}
      <span style="position:relative;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.label}</span>
      ${isCurrent ? `<span style="position:relative;display:block;font-size:0.55rem;opacity:0.8;margin-top:1px">Current</span>` : ''}
    </div>`;
  }).join('');
  return `<div style="display:flex;flex-direction:row;width:100%;border-radius:8px;overflow:hidden;box-shadow:var(--shadow-sm);border:1px solid var(--color-border)">${stages}</div>`;
}

export function stageTransitionDialog(engId, currentStage) {
  const opts = STAGE_CONFIG.map(s =>
    `<option value="${s.key}" ${s.key === currentStage ? 'selected' : ''}>${s.label}</option>`
  ).join('');
  return `<div id="stage-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
    <div class="modal-overlay" data-dialog-close="stage-dialog"></div>
    <div class="modal-content rounded-box max-w-md p-6">
      <h3 class="text-lg font-semibold mb-4">Move Engagement Stage</h3>
      <div style="margin-bottom:12px"><label class="form-label">New Stage</label><select id="stage-select" class="form-input">${opts}</select></div>
      <div style="margin-bottom:16px"><label class="form-label">Reason (optional)</label><textarea id="stage-note" rows="3" placeholder="Reason for stage change..." class="form-input" style="min-height:80px;resize:vertical"></textarea></div>
      <div class="modal-action mt-4">
        <button data-action="confirmStageTransition" data-args='["${esc(engId)}"]' class="btn btn-primary">Confirm</button>
        <button data-dialog-close="stage-dialog" class="btn btn-ghost">Cancel</button>
      </div>
    </div>
  </div>`;
}

export function chatPanel(engId) {
  return `<div id="tab-chat" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <h2 class="card-title text-sm mb-4">Team Chat</h2>
    <div id="chat-msgs" class="min-h-48 max-h-96 overflow-y-auto border border-base-200 rounded-box p-3 mb-3 bg-base-50"><div class="text-center text-base-content/40 text-sm py-8">Loading messages...</div></div>
    <div class="flex gap-2"><input id="chat-input" type="text" placeholder="Type a message..." class="input input-solid flex-1" onkeydown="if(event.key==='Enter')sendChatMsg('${esc(engId)}')"/><button data-action="sendChatMsg" data-args='["${esc(engId)}"]' class="btn btn-primary">Send</button></div>
  </div></div></div>`;
}

export function checklistPanel(engId, user = {}) {
  const canPush = user && (user.role === 'partner' || user.role === 'manager' || user.role === 'admin');
  const pushBtn = canPush ? `<button data-action="openChecklistMwrDialog" data-args='["${esc(engId)}"]' class="btn btn-ghost btn-sm">Push to MWR</button>` : '';
  const pushDialog = canPush ? `<div id="checklist-mwr-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
    <div class="modal-overlay" data-dialog-close="checklist-mwr-dialog"></div>
    <div class="modal-content rounded-box max-w-lg p-6">
      <h3 class="text-lg font-semibold mb-4">Push Checklist to MWR Review</h3>
      <div class="form-group mb-3"><label class="form-label">Review Name</label><input id="cmwr-name" type="text" class="form-input" placeholder="Review name..."/></div>
      <div class="form-group mb-3"><label class="form-label text-sm font-semibold">Select Items to Include</label><div id="cmwr-items" class="max-h-64 overflow-y-auto border border-base-200 rounded p-2 mt-1"><div class="text-center text-base-content/40 text-sm py-4">Loading checklist...</div></div></div>
      <div class="modal-action"><button data-action="submitChecklistMwr" data-args='["${esc(engId)}"]' class="btn btn-primary btn-sm">Create MWR Review</button><button data-dialog-close="checklist-mwr-dialog" class="btn btn-ghost btn-sm">Cancel</button></div>
    </div>
  </div>` : '';
  return `<div id="tab-checklist" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <div class="flex justify-between items-center mb-4"><h2 style="font-size:0.875rem;font-weight:600">Checklists</h2><div class="flex gap-2">${pushBtn}<a href="/review?engagement_id=${esc(engId)}" class="btn btn-ghost btn-sm">Manage in Review</a></div></div>
    <div id="checklist-items"><div class="text-center text-base-content/40 text-sm py-8">Loading...</div></div>
  </div></div></div>${pushDialog}`;
}

export function activityPanel(engId) {
  return `<div id="tab-activity" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <h2 class="card-title text-sm mb-4">Activity Timeline</h2>
    <div id="activity-log" class="flex flex-col gap-3"><div class="text-center text-base-content/40 text-sm py-8">Loading activity...</div></div>
  </div></div></div>`;
}

export function letterPanel(engId) {
  return `<div id="tab-letter" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <div class="flex justify-between items-center mb-4">
      <h2 style="font-size:0.875rem;font-weight:600">Engagement Letter</h2>
      <div class="flex gap-2">
        <a href="/engagement/${esc(engId)}/letter" class="btn btn-ghost btn-sm">Manage Letter</a>
        <label class="btn btn-primary btn-sm" title="Upload signed engagement letter">Upload Signed <input type="file" style="display:none" accept=".pdf,.doc,.docx" onchange="uploadEngLetter(event,'${esc(engId)}')"/></label>
      </div>
    </div>
    <div id="eng-letter-status"><div class="text-center text-base-content/40 text-sm py-8">Loading letter status...</div></div>
  </div></div></div>`;
}

export function filesPanel(engId) {
  return `<div id="tab-files" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <div class="flex justify-between items-center mb-4"><h2 style="font-size:0.875rem;font-weight:600">Files</h2>
      <div class="flex gap-2">
        <label class="btn btn-ghost btn-sm" title="Upload post-RFI / draft AFS files">Upload AFS <input type="file" multiple style="display:none" onchange="uploadEngFiles(event,'${esc(engId)}','draft_afs')"/></label>
        <label class="btn btn-ghost btn-sm" title="Upload post-RFI journal entries">Upload Journal <input type="file" multiple style="display:none" onchange="uploadEngFiles(event,'${esc(engId)}','draft_journals')"/></label>
        <button data-action="openFileReuse" data-args='["${esc(engId)}"]' class="btn btn-ghost btn-sm" title="Reuse a file from another engagement">Reuse</button>
        <button data-action="downloadFilesZip" data-args='["${esc(engId)}"]' class="btn btn-primary btn-sm">Download ZIP</button>
      </div>
    </div>
    <div id="eng-files-list"><div class="text-center text-base-content/40 text-sm py-8">Loading files...</div></div>
  </div></div></div>
  <div id="eng-color-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
    <div class="modal-overlay" data-dialog-close="eng-color-dialog"></div>
    <div class="modal-content rounded-box max-w-sm p-6">
      <h3 class="text-lg font-semibold mb-4">Theme Color</h3>
      <div id="eng-color-swatches" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:12px"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <label style="font-size:13px">Custom:</label>
        <input id="eng-color-custom" type="color" value="#3b82f6" style="width:40px;height:32px;cursor:pointer"/>
        <input id="eng-color-hex" type="text" class="input" style="flex:1;font-family:monospace;font-size:13px" placeholder="#RRGGBB"/>
      </div>
      <div class="modal-action">
        <button data-action="saveEngColor" data-args='["${esc(engId)}"]' class="btn btn-primary">Save</button>
        <button data-dialog-close="eng-color-dialog" class="btn btn-ghost">Cancel</button>
      </div>
    </div>
  </div>
  <div id="file-reuse-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
    <div class="modal-overlay" data-dialog-close="file-reuse-dialog"></div>
    <div class="modal-content rounded-box max-w-2xl p-6">
      <h3 class="text-lg font-semibold mb-4">Reuse a file from another engagement</h3>
      <div id="file-reuse-list" style="max-height:360px;overflow-y:auto;margin-bottom:16px"><div class="text-center text-base-content/40 text-sm py-8">Loading...</div></div>
      <div class="modal-action">
        <button data-action="confirmFileReuse" data-args='["${esc(engId)}"]' class="btn btn-primary">Attach selected</button>
        <button data-dialog-close="file-reuse-dialog" class="btn btn-ghost">Cancel</button>
      </div>
    </div>
  </div>`;
}

export function engDetailScript(engId) {
  const id = esc(engId);
  return `var activeEngTab='details';var _chatPollId=null;var _chatLastTs=0;
function switchEngTab(tab){document.querySelectorAll('.eng-tab-panel').forEach(function(p){p.style.display='none'});var panel=document.getElementById('tab-'+tab);if(panel)panel.style.display='';document.querySelectorAll('[id^="engtab-"]').forEach(function(b){b.classList.remove('active')});var btn=document.getElementById('engtab-'+tab);if(btn)btn.classList.add('active');activeEngTab=tab;if(tab==='chat'){loadChat();startChatPoll()}else{stopChatPoll();if(tab==='checklist')loadChecklist();else if(tab==='activity')loadActivity();else if(tab==='files')loadFiles();else if(tab==='letter')loadLetter()}}
function startChatPoll(){stopChatPoll();_chatPollId=setInterval(function(){if(activeEngTab==='chat'&&document.visibilityState!=='hidden')pollChatDelta()},3000)}
function stopChatPoll(){if(_chatPollId){clearInterval(_chatPollId);_chatPollId=null}}
async function pollChatDelta(){try{if(!_chatRfiId)return;var r=await fetch('/api/message?rfi_id='+_chatRfiId);var d=await r.json();var msgs=d.data||d||[];if(!Array.isArray(msgs))return;var latest=msgs.length?Math.max.apply(null,msgs.map(function(m){return Number(m.created_at)||0})):0;if(latest>_chatLastTs){_chatLastTs=latest;renderChatMessages(msgs)}}catch(e){}}
function renderChatMessages(msgs){var el=document.getElementById('chat-msgs');if(!el)return;var prev=el.scrollTop;var nearBottom=el.scrollHeight-prev-el.clientHeight<60;var nowSec=Math.floor(Date.now()/1000);el.innerHTML=msgs.length?msgs.map(function(m,i){var tsRaw=m.created_at?Number(m.created_at):0;var tsUnix=tsRaw>1e12?Math.floor(tsRaw/1000):tsRaw;var ts=tsUnix?new Date(tsUnix*1000).toLocaleString():'';var who=m.created_by_display&&m.created_by_display.name||m.user_id||'User';var isLast=i===msgs.length-1;var ageDays=tsUnix?((nowSec-tsUnix)/86400):0;var staleDot=isLast&&ageDays>=8?'<span title="No reply for '+Math.round(ageDays)+' days" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-left:6px;vertical-align:middle"></span>':'';return'<div class="mb-3"><div class="text-xs text-base-content/40 mb-1">'+who+' &bull; '+ts+staleDot+'</div><div class="bg-base-100 border border-base-200 rounded-box p-2 text-sm">'+(m.content||'').replace(/</g,'&lt;')+'</div></div>'}).join(''):'<div class="text-center text-base-content/40 text-sm py-8">No messages yet</div>';if(nearBottom)el.scrollTop=el.scrollHeight}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&activeEngTab==='chat')pollChatDelta()});
window.addEventListener('beforeunload',stopChatPoll);
function openStageTransition(stage){document.getElementById('stage-dialog').style.display='flex';if(stage)document.getElementById('stage-select').value=stage}
async function confirmStageTransition(engId){var stage=document.getElementById('stage-select').value;var note=document.getElementById('stage-note').value;var btn=document.querySelector('#stage-dialog .btn-primary');if(btn){btn.disabled=true;btn.textContent='Moving...'}try{var r=await fetch('/api/friday/engagement/transition',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engagementId:engId,toStage:stage,reason:note})});var d=await r.json();if(r.ok||d.success){document.getElementById('stage-dialog').style.display='none';showToast('Stage updated','success');setTimeout(function(){location.reload()},800)}else{showToast(d.error||d.message||'Transition failed','error');if(btn){btn.disabled=false;btn.textContent='Confirm'}}}catch(e){showToast('Error: '+e.message,'error');if(btn){btn.disabled=false;btn.textContent='Confirm'}}}
var _chatRfiId=null;
async function loadChat(){var el=document.getElementById('chat-msgs');try{if(!_chatRfiId){var re=await fetch('/api/rfi?engagement_id=${id}&limit=1');var rd=await re.json();var rfis=rd.data?.items||rd.data||rd||[];_chatRfiId=rfis[0]?.id||null;}if(!_chatRfiId){el.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">No RFIs yet. Create an RFI to enable team chat.</div>';return}var r=await fetch('/api/message?rfi_id='+_chatRfiId);var d=await r.json();var msgs=d.data||d||[];if(!Array.isArray(msgs))msgs=[];_chatLastTs=msgs.length?Math.max.apply(null,msgs.map(function(m){return Number(m.created_at)||0})):0;renderChatMessages(msgs);el.scrollTop=el.scrollHeight}catch(err){el.innerHTML='<div class="text-base-content/40 text-center p-4">Could not load messages</div>'}}
async function sendChatMsg(engId){var inp=document.getElementById('chat-input');var txt=inp.value.trim();if(!txt)return;if(!_chatRfiId){showToast('No RFI found for chat','error');return}var btn=inp.nextElementSibling;if(btn)btn.disabled=true;try{var r=await fetch('/api/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rfi_id:_chatRfiId,content:txt})});if(r.ok){inp.value='';loadChat();showToast('Sent','success')}else{var d=await r.json();showToast(d.message||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}finally{if(btn)btn.disabled=false}}
async function loadChecklist(){var el=document.getElementById('checklist-items');try{var re=await fetch('/api/review?engagement_id=${id}&limit=1');var rd=await re.json();var reviews=rd.data?.items||rd.data||[];if(!reviews.length){el.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">No reviews yet. <a href="/review/new" class="text-primary">Create a review</a> to add checklists.</div>';return}var reviewId=reviews[0].id;var r=await fetch('/api/checklist?review_id='+reviewId);var d=await r.json();var checklists=d.data||d||[];if(!checklists.length){el.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">No checklists. <a href="/review/'+reviewId+'" class="text-primary">Open the review</a> to manage checklists.</div>';return}var items=[];for(var i=0;i<checklists.length;i++){var ci=checklists[i];if(ci.section_items){try{var arr=JSON.parse(ci.section_items);items=items.concat(arr.map(function(it){return{id:it.id||ci.id,name:ci.name+': '+(it.name||it.label||it),completed:it.is_done||it.completed||false}}))}catch(e){items.push({id:ci.id,name:ci.name,completed:false})}}}el.innerHTML=items.length?items.map(function(item){return'<div class="flex items-center gap-3 py-2 border-b border-base-200"><input type="checkbox" class="checkbox" data-id="'+item.id+'"'+(item.completed?' checked':'')+' onchange="toggleCheckItem(this.dataset.id,this.checked)"/><span class="text-sm'+(item.completed?' line-through text-base-content/40':'')+'">'+(item.name||'Item')+'</span></div>'}).join(''):'<div class="text-center text-base-content/40 text-sm py-8">No checklist items yet</div>'}catch(err){el.innerHTML='<div class="text-base-content/40 text-center p-4">Could not load checklists</div>'}}
async function toggleCheckItem(id,checked){try{await fetch('/api/checklist_item/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_done:checked})});showToast(checked?'Completed':'Unchecked','success')}catch(e){showToast('Error','error')}}
async function loadActivity(){var el=document.getElementById('activity-log');try{var r=await fetch('/api/audit/logs?entityType=engagement&entityId=${id}&limit=30');var d=await r.json();var items=d.data||d||[];if(!Array.isArray(items))items=[];el.innerHTML=items.length?items.map(function(a){var ts=a.timestamp||a.created_at;var date=ts?(typeof ts==='number'&&ts>1e9?new Date(ts*1000).toLocaleString():new Date(ts).toLocaleString()):'-';return'<div class="flex gap-3 items-start py-2 border-b border-base-100"><div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">'+(a.user_id||'S').charAt(0).toUpperCase()+'</div><div><div class="text-xs text-base-content/40">'+(a.user_id||'System')+' &bull; '+date+'</div><div class="text-sm mt-1">'+(a.action||a.operation||a.type||'Activity')+(a.details?' &mdash; <span class="text-xs text-base-content/40">'+JSON.stringify(a.details).substring(0,80)+'</span>':'')+'</div></div></div>'}).join(''):'<div class="text-center text-base-content/40 text-sm py-8">No activity recorded yet</div>'}catch(err){el.innerHTML='<div class="text-base-content/40 text-center p-4">Activity log unavailable</div>'}}
async function loadFiles(){var el=document.getElementById('eng-files-list');try{var re=await fetch('/api/rfi?engagement_id=${id}&limit=100');var rd=await re.json();var rfis=rd.data?.items||rd.data||[];if(!rfis.length){el.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">No RFIs yet. Files are attached to RFIs.</div>';return}var allFiles=[];for(var i=0;i<Math.min(rfis.length,5);i++){try{var fr=await fetch('/api/file?rfi_id='+rfis[i].id);var fd=await fr.json();var ff=fd.data||fd||[];if(Array.isArray(ff))allFiles=allFiles.concat(ff.map(function(f){return{...f,_rfi:rfis[i].title||rfis[i].name||'RFI'}}))}catch(e){}}el.innerHTML=allFiles.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>File</th><th>RFI</th><th>Size</th><th>Date</th></tr></thead><tbody>'+allFiles.map(function(f){var ts=f.created_at;var date=ts?(typeof ts==='number'&&ts>1e9?new Date(ts*1000).toLocaleDateString():new Date(ts).toLocaleDateString()):'-';return'<tr><td class="text-sm"><a href="/api/files/'+f.id+'" target="_blank" class="text-primary">'+(f.path?.split('/').pop()||f.id)+'</a></td><td class="text-xs text-base-content/50">'+(f._rfi||'-')+'</td><td class="text-sm">'+(f.size?Math.round(f.size/1024)+'KB':'-')+'</td><td class="text-sm">'+date+'</td></tr>'}).join('')+'</tbody></table></div>':'<div class="text-center text-base-content/40 text-sm py-8">No files uploaded yet</div>'}catch(err){el.innerHTML='<div class="text-base-content/40 text-center p-4">Could not load files</div>'}}
async function uploadEngFiles(event,engId,fileType){var files=event.target.files;if(!files.length)return;fileType=fileType||'draft_afs';showToast('Uploading '+files.length+' '+(fileType==='draft_journals'?'journal':'AFS')+' file(s)...','info');var ok=0;for(var i=0;i<files.length;i++){var fd=new FormData();fd.append('file',files[i]);fd.append('engagement_id',engId);fd.append('file_type',fileType);fd.append('file_name',files[i].name);try{var r=await fetch('/api/friday/upload/post-rfi',{method:'POST',credentials:'include',body:fd});if(r.ok)ok++}catch(err){}}showToast(ok+'/'+files.length+' '+(fileType==='draft_journals'?'journal':'AFS')+' file(s) uploaded','success');event.target.value='';if(ok>0)loadFiles()}
async function downloadFilesZip(engId){try{var r=await fetch('/api/friday/engagement/files-zip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engagement_id:engId})});if(r.ok){var b=await r.blob();var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='engagement-files.zip';a.click()}else showToast('No files to download','error')}catch(e){showToast('Error','error')}}
async function recreateEngagement(engId){if(!confirm('Clone this engagement for the next period? The new engagement will start at Info Gathering with progress reset.'))return;try{showToast('Creating next-period engagement...','info');var r=await fetch('/api/friday/engagement/recreate',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({engagement_id:engId})});var d=await r.json();if(r.ok&&d.status==='success'&&d.data&&d.data.engagement_id){showToast('Created '+d.data.year+' engagement','success');setTimeout(function(){location.href='/engagement/'+d.data.engagement_id},600)}else{showToast(d.message||d.error||'Recreate failed','error')}}catch(e){showToast('Error: '+e.message,'error')}}
var PALETTE=['#3b82f6','#06b6d4','#10b981','#84cc16','#eab308','#f97316','#ef4444','#ec4899','#a855f7','#6366f1','#242423','#64748b'];
function openColorPicker(engId,current){var dlg=document.getElementById('eng-color-dialog');var sw=document.getElementById('eng-color-swatches');var ci=document.getElementById('eng-color-custom');var hi=document.getElementById('eng-color-hex');sw.innerHTML=PALETTE.map(function(c){return'<button type="button" data-color="'+c+'" style="width:40px;height:40px;border-radius:8px;border:3px solid '+(c===current?'#111':'transparent')+';background:'+c+';cursor:pointer"></button>'}).join('');sw.onclick=function(ev){var b=ev.target.closest('button[data-color]');if(!b)return;var c=b.dataset.color;ci.value=c;hi.value=c;Array.from(sw.children).forEach(function(x){x.style.borderColor=(x.dataset.color===c?'#111':'transparent')})};ci.oninput=function(){hi.value=ci.value};hi.value=current||'#3b82f6';ci.value=current||'#3b82f6';dlg.style.display='flex'}
async function saveEngColor(engId){var hi=document.getElementById('eng-color-hex');var color=(hi.value||'').trim();if(!/^#[0-9a-fA-F]{6}$/.test(color)){showToast('Invalid hex color','error');return}try{var r=await fetch('/api/engagement/'+engId,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({color:color})});if(r.ok){showToast('Theme saved','success');document.getElementById('eng-color-dialog').style.display='none';setTimeout(function(){location.reload()},400)}else{var d=await r.json();showToast('Failed: '+(d.error||d.message||'unknown'),'error')}}catch(e){showToast('Error','error')}}
async function openFileReuse(engId){var dlg=document.getElementById('file-reuse-dialog');var list=document.getElementById('file-reuse-list');dlg.style.display='flex';list.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">Loading...</div>';try{var r=await fetch('/api/friday/file/search?exclude_engagement='+engId,{credentials:'include'});var d=await r.json();var files=(d.data&&d.data.files)||d.files||[];if(!files.length){list.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">No files available from other engagements.</div>';return}list.innerHTML='<table class="data-table"><thead><tr><th></th><th>File</th><th>Engagement</th><th>Size</th><th>Date</th></tr></thead><tbody>'+files.map(function(f){var ts=f.created_at?(typeof f.created_at==='number'&&f.created_at>1e9?new Date(f.created_at*1000).toLocaleDateString():new Date(f.created_at).toLocaleDateString()):'-';return'<tr><td><input type="checkbox" class="checkbox file-reuse-pick" data-file-id="'+(f.id||'')+'"/></td><td class="text-sm">'+((f.path||'').split('/').pop()||f.id||'-')+'</td><td class="text-xs text-base-content/60">'+(f.engagement_name||'-')+'</td><td class="text-sm">'+(f.size?Math.round(f.size/1024)+'KB':'-')+'</td><td class="text-sm">'+ts+'</td></tr>'}).join('')+'</tbody></table>'}catch(e){list.innerHTML='<div class="text-base-content/40 text-center p-4">Failed to load: '+e.message+'</div>'}}
async function confirmFileReuse(engId){var ids=Array.from(document.querySelectorAll('.file-reuse-pick:checked')).map(function(c){return c.dataset.fileId}).filter(Boolean);if(!ids.length){showToast('Select at least one file','error');return}var re=await fetch('/api/rfi?engagement_id='+engId+'&limit=1');var rd=await re.json();var rfis=rd.data?.items||rd.data||[];if(!rfis.length){showToast('Create an RFI first to attach reused files','error');return}var rfiId=rfis[0].id;var ok=0;for(var i=0;i<ids.length;i++){try{var r=await fetch('/api/friday/file/reuse',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({source_file_id:ids[i],target_rfi_id:rfiId})});if(r.ok)ok++}catch(e){}}showToast(ok+' file(s) attached','success');document.getElementById('file-reuse-dialog').style.display='none';if(ok>0)loadFiles()}
async function loadLetter(){var el=document.getElementById('eng-letter-status');try{var r=await fetch('/api/engagement/rate?engagement_id=${id}');var d=await r.json();var rating=d.rating||0;var stage=d.stage||'';var auditorStatus='-';var clientStatus='-';try{var re=await fetch('/api/engagement/${id}');var rd=await re.json();var eng=rd.data||rd||{};auditorStatus=eng.letter_auditor_status||'not_started';clientStatus=eng.letter_client_status||'not_started'}catch(e){}var stars=Array.from({length:5},function(_,i){return'<span style="color:'+(i<rating?'#f59e0b':'#d1d5db');}).join('');var stepsHtml=['generate','review','send','sign','complete'];var stepLabels={'generate':'Generate','review':'Internal Review','send':'Send to Client','sign':'Awaiting Signature','complete':'Complete'};var currentStep=clientStatus==='signed'||clientStatus==='completed'?'complete':clientStatus==='sent'||clientStatus==='pending'?'sign':auditorStatus==='approved'||auditorStatus==='sent'?'send':auditorStatus==='draft'||auditorStatus==='pending'?'review':'generate';el.innerHTML='<div class="mb-4"><div class="flex items-center gap-2 mb-2"><span class="text-sm font-medium">Workflow Status:</span><span class="badge badge-flat-primary text-xs">'+currentStep.replace(/_/g,' ')+'</span></div><div style="display:flex;gap:4px;margin-bottom:16px">'+stepsHtml.map(function(s,i){var done=stepsHtml.indexOf(currentStep)>i;var active=s===currentStep;var bg=active?'var(--color-primary)':done?'#10b981':'#e2e8f0';var color=active||done?'#fff':'#94a3b8';return'<div style="flex:1;padding:6px 4px;text-align:center;background:'+bg+';color:'+color+';font-size:0.6rem;font-weight:600;border-radius:4px">'+stepLabels[s]+'</div>'}).join('')+'</div><div class="flex gap-3"><div class="card-clean flex-1"><div class="card-clean-body"><div class="text-xs text-base-content/60 mb-1">Auditor</div><div class="text-sm font-medium">'+auditorStatus.replace(/_/g,' ')+'</div></div></div><div class="card-clean flex-1"><div class="card-clean-body"><div class="text-xs text-base-content/60 mb-1">Client</div><div class="text-sm font-medium">'+clientStatus.replace(/_/g,' ')+'</div></div></div>'+(rating?'<div class="card-clean flex-1"><div class="card-clean-body"><div class="text-xs text-base-content/60 mb-1">Client Rating</div><div>'+[1,2,3,4,5].map(function(i){return'<span style="color:'+(i<=rating?'#f59e0b':'#d1d5db');+'font-size:1.1rem">&#9733;</span>'}).join('')+'</div></div></div>':'')+'</div></div>'}catch(err){el.innerHTML='<div class="text-base-content/40 text-center p-4">Could not load letter status</div>'}}
async function uploadEngLetter(event,engId){var file=event.target.files[0];if(!file)return;showToast('Uploading engagement letter...','info');var fd=new FormData();fd.append('file',file);fd.append('engagement_id',engId);fd.append('file_type','engagement_letter');try{var r=await fetch('/api/friday/upload/engagement-letter',{method:'POST',credentials:'include',body:fd});if(r.ok){showToast('Letter uploaded','success');loadLetter()}else{var d=await r.json();showToast(d.error||d.message||'Upload failed','error')}}catch(e){showToast('Error: '+e.message,'error')}finally{event.target.value=''}}
var _cmwrItems=[];
async function openChecklistMwrDialog(engId){var dlg=document.getElementById('checklist-mwr-dialog');if(!dlg)return;dlg.style.display='flex';var itemsEl=document.getElementById('cmwr-items');var nameEl=document.getElementById('cmwr-name');_cmwrItems=[];try{var re=await fetch('/api/review?engagement_id='+engId+'&limit=1');var rd=await re.json();var reviews=rd.data?.items||rd.data||[];if(!reviews.length){itemsEl.innerHTML='<div class="text-sm text-base-content/40 py-2">No reviews/checklists found for this engagement.</div>';return}var reviewId=reviews[0].id;if(nameEl)nameEl.value=(reviews[0].name||'Review')+' - MWR';var r=await fetch('/api/checklist?review_id='+reviewId);var d=await r.json();var checklists=d.data||d||[];var allItems=[];checklists.forEach(function(c){if(c.section_items){try{var arr=JSON.parse(c.section_items);arr.forEach(function(it){allItems.push({id:it.id||c.id+'_'+allItems.length,text:(c.name?c.name+': ':'')+((it.name||it.label)||JSON.stringify(it)),checked:true})})}catch(e){allItems.push({id:c.id,text:c.name||'Item',checked:true})}}else{allItems.push({id:c.id,text:c.name||'Item',checked:true})}});_cmwrItems=allItems;itemsEl.innerHTML=allItems.length?allItems.map(function(it,i){return'<label class="flex items-center gap-2 py-1.5 border-b border-base-100 last:border-0"><input type="checkbox" class="checkbox checkbox-sm cmwr-pick" data-idx="'+i+'" checked/><span class="text-sm">'+it.text+'</span></label>'}).join(''):'<div class="text-sm text-base-content/40 py-2">No checklist items found.</div>'}catch(e){itemsEl.innerHTML='<div class="text-sm text-error py-2">Failed to load: '+e.message+'</div>'}}
async function submitChecklistMwr(engId){var nameEl=document.getElementById('cmwr-name');var name=(nameEl&&nameEl.value.trim())||'MWR Review';var picks=Array.from(document.querySelectorAll('.cmwr-pick:checked')).map(function(cb){return _cmwrItems[Number(cb.dataset.idx)]}).filter(Boolean);if(!picks.length){showToast('Select at least one item','error');return}var btn=document.querySelector('#checklist-mwr-dialog .btn-primary');if(btn){btn.disabled=true;btn.textContent='Creating...'}try{var cr=await fetch('/api/mwr/review',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({name:name,engagement_id:engId,status:'draft'})});if(!cr.ok){var cd=await cr.json();showToast(cd.message||'Failed to create review','error');return}var cv=await cr.json();var reviewId=(cv.data&&cv.data.id)||cv.id;if(reviewId){var ok=0;for(var i=0;i<picks.length;i++){try{var hr=await fetch('/api/mwr/review/'+reviewId+'/highlights',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({content:picks[i].text,type:'general',page:1,position_x:0,position_y:0,width:0,height:0})});if(hr.ok)ok++}catch(e){}}showToast('Review created with '+ok+' highlights','success');document.getElementById('checklist-mwr-dialog').style.display='none'}else{showToast('Review created (no ID returned)','success')}}catch(e){showToast('Error: '+e.message,'error')}finally{if(btn){btn.disabled=false;btn.textContent='Create MWR Review'}}}`;
}

export function reviewsPanel(engId) {
  const id = esc(engId);
  return `<div id="tab-reviews" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 class="text-sm font-semibold">Linked Reviews</h2>
      <a href="/review/new?engagement_id=${id}" class="btn btn-primary btn-sm">+ Review</a>
    </div>
    <div id="eng-reviews-list"><div class="text-center text-base-content/40 text-sm py-8">Loading reviews...</div></div>
  </div></div></div>
  <script>
  async function loadEngReviews(){var el=document.getElementById('eng-reviews-list');if(!el)return;try{var d=await window.fetchJson('/api/review?engagement_id=${id}');var reviews=d.data?.items||d.data||d||[];if(!Array.isArray(reviews))reviews=[];if(window.__debug&&window.__debug.engReviews)window.__debug.engReviews={count:reviews.length,loaded:Date.now()};if(!reviews.length){el.innerHTML='<div class="text-center text-base-content/40 text-sm py-8">No reviews linked to this engagement. <a href="/review/new?engagement_id=${id}" class="text-primary">Create one</a>.</div>';return}el.innerHTML='<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Highlights</th><th></th></tr></thead><tbody>'+reviews.map(function(rv){var st=rv.status||'draft';var sc=st==='active'||st==='open'?'badge-flat-success':st==='closed'||st==='completed'?'badge-flat-secondary':'badge-flat-warning';var hl=rv.highlights_count||rv.highlight_count||'—';return'<tr class="hover cursor-pointer" data-navigate="/review/'+rv.id+'"><td class="text-sm font-medium">'+(rv.name||rv.title||'Review')+'</td><td><span class="badge '+sc+' text-xs">'+st+'</span></td><td class="text-sm">'+hl+'</td><td><a href="/review/'+rv.id+'" class="btn btn-ghost btn-xs">Open</a></td></tr>'}).join('')+'</tbody></table></div>'}catch(e){el.innerHTML='<div class="text-base-content/40 text-center p-4">Could not load reviews</div>'}}
  if(typeof window.__debug==='undefined')window.__debug={};window.__debug.engReviews={count:0,loaded:null};
  document.addEventListener('DOMContentLoaded',function(){var orig=window.switchEngTab;window.switchEngTab=function(tab){if(orig)orig(tab);if(tab==='reviews')loadEngReviews()};});
  </script>`;
}

export function aiPanel(engId) {
  const id = esc(engId);
  return `<div id="tab-ai" class="eng-tab-panel" style="display:none"><div class="card-clean"><div class="card-clean-body">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 class="text-sm font-semibold">AI Insights</h2>
      <button class="btn btn-primary btn-sm" onclick="loadAiInsights('${id}')">Refresh</button>
    </div>
    <div id="ai-panel" style="min-height:120px"><div class="text-center text-base-content/40 text-sm py-8">Click Refresh to load AI insights.</div></div>
  </div></div></div>
  <script>
  async function loadAiInsights(engId){var el=document.getElementById('ai-panel');el.innerHTML='<div class="text-center text-sm py-8">Loading...</div>';try{var d=await window.fetchJson('/api/mwr/ml-ask?engagement_id='+engId);var items=d.suggestions||d.insights||[];if(!items.length){el.innerHTML='<div class="text-base-content/40 text-sm py-4 text-center">'+(d.message||'No AI insights available for this engagement yet.')+'</div>';return}el.innerHTML=items.map(function(s){return'<div class="card-clean mb-3"><div class="card-clean-body"><div class="text-sm">'+(typeof s==='string'?s:(s.content||s.text||JSON.stringify(s)))+'</div></div></div>'}).join('')}catch(e){console.error('[ai-panel]',e);el.innerHTML='<div class="text-base-content/40 text-sm py-4 text-center">'+(e.data&&e.data.message||'AI integration available when ANTHROPIC_API_KEY is set.')+'</div>'}}
  document.addEventListener('DOMContentLoaded',function(){var origSwitch=window.switchEngTab;window.switchEngTab=function(tab){if(origSwitch)origSwitch(tab);if(tab==='ai')loadAiInsights('${id}')};});
  </script>`;
}
