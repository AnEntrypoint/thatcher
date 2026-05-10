import { statusLabel } from '@/ui/renderer.js';

export function rfiSectionCrudPanel(engagementId, sections = []) {
  const rows = sections.map((s, i) => `<div class="rfi-section-row" draggable="true" data-id="${s.id}" data-idx="${i}" ondragstart="rfiDragStart(event)" ondragover="rfiDragOver(event)" ondrop="rfiDrop(event)"><span class="rfi-section-handle">&#9776;</span><span class="rfi-section-name">${s.name || 'Untitled'}</span><span class="badge-status">${s.question_count || 0} Q</span><div class="flex gap-1"><button class="btn btn-xs btn-ghost" data-action="rfiEditSection" data-args='["${s.id}","${(s.name || '').replace(/"/g, '&quot;')}"]'>Edit</button><button class="btn btn-xs btn-ghost btn-error" data-action="rfiDeleteSection" data-args='["${s.id}"]'>Del</button></div></div>`).join('');
  return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body"><div class="flex justify-between items-center mb-3"><h3 style="font-size:0.875rem;font-weight:600">RFI Sections</h3><button class="btn btn-primary btn-sm" data-action="rfiAddSection">Add Section</button></div><div id="rfi-sections-list">${rows || '<div class="text-gray-500 text-sm text-center py-3">No sections yet</div>'}</div></div></div>
  <script>
  var rfiEngId='${engagementId}';var dragSrc=null;
  window.rfiDragStart=function(e){dragSrc=e.target.closest('.rfi-section-row');e.dataTransfer.effectAllowed='move'};
  window.rfiDragOver=function(e){e.preventDefault();e.dataTransfer.dropEffect='move'};
  window.rfiDrop=function(e){e.preventDefault();var tgt=e.target.closest('.rfi-section-row');if(!tgt||!dragSrc||tgt===dragSrc)return;var list=tgt.parentNode;var all=[].slice.call(list.children);var srcIdx=all.indexOf(dragSrc);var tgtIdx=all.indexOf(tgt);if(srcIdx<tgtIdx)list.insertBefore(dragSrc,tgt.nextSibling);else list.insertBefore(dragSrc,tgt);var order=[].slice.call(list.children).map(function(el,i){return{id:el.dataset.id,sort_order:i}});fetch('/api/rfi_section/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engagement_id:rfiEngId,order:order})}).then(function(){showToast('Reordered','success')}).catch(function(){showToast('Reorder failed','error')})};
  window.rfiAddSection=function(){var name=prompt('Section name:');if(!name)return;fetch('/api/rfi_section',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,engagement_id:rfiEngId,sort_order:99})}).then(function(r){if(r.ok){showToast('Section added','success');location.reload()}else showToast('Failed','error')}).catch(function(){showToast('Error','error')})};
  window.rfiEditSection=function(id,name){var n=prompt('Section name:',name);if(!n||n===name)return;fetch('/api/rfi_section/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})}).then(function(r){if(r.ok){showToast('Updated','success');location.reload()}else showToast('Failed','error')}).catch(function(){showToast('Error','error')})};
  window.rfiDeleteSection=function(id){if(!confirm('Delete this section?'))return;fetch('/api/rfi_section/'+id,{method:'DELETE'}).then(function(r){if(r.ok){showToast('Deleted','success');location.reload()}else showToast('Failed','error')}).catch(function(){showToast('Error','error')})};
  </script>`;
}
export function rfiQuestionEditDialog(questionId) {
  return `<div id="rfi-q-edit" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-q-edit-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:640px">
      <div class="dialog-header"><span class="dialog-title" id="rfi-q-edit-title">Edit Question</span><button class="dialog-close" data-dialog-close="rfi-q-edit" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rqe-text">Question Text</label><textarea id="rqe-text" class="textarea textarea-bordered w-full" rows="4"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="modal-form-group"><label for="rqe-cat">Category</label><input id="rqe-cat" class="input input-bordered w-full" placeholder="Category"/></div>
          <div class="modal-form-group"><label for="rqe-deadline">Deadline</label><input type="date"  id="rqe-deadline" class="input input-bordered w-full"/></div>
        </div>
        <div class="modal-form-group"><label for="rqe-assign">Assigned To</label><select id="rqe-assign" class="select select-bordered w-full"><option value="">Unassigned</option></select></div>
        <div class="modal-form-group"><label class="flex items-center gap-2"><input type="checkbox" id="rqe-required" class="checkbox" checked/><span class="text-sm">Required</span></label></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-q-edit">Cancel</button><button class="btn btn-primary btn-sm" data-action="rqeSave">Save</button></div>
    </div></div>
  <script>
  var rqeId=null;
  window.openQuestionEdit=function(id){rqeId=id;document.getElementById('rfi-q-edit').style.display='flex';fetch('/api/rfi_question/'+id).then(function(r){return r.json()}).then(function(d){var q=d.data||d;document.getElementById('rqe-text').value=q.question_text||q.question||'';document.getElementById('rqe-cat').value=q.category||'';document.getElementById('rqe-deadline').value=q.deadline?new Date(q.deadline*1000).toISOString().split('T')[0]:'';document.getElementById('rqe-required').checked=q.required!==false}).catch(function(){})};
  window.rqeSave=async function(){if(!rqeId)return;var d={question_text:document.getElementById('rqe-text').value,category:document.getElementById('rqe-cat').value,required:document.getElementById('rqe-required').checked};var dl=document.getElementById('rqe-deadline').value;if(dl)d.deadline=Math.floor(new Date(dl).getTime()/1000);var assign=document.getElementById('rqe-assign').value;if(assign)d.assigned_to=assign;try{var r=await fetch('/api/rfi_question/'+rqeId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});if(r.ok){showToast('Question updated','success');document.getElementById('rfi-q-edit').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function rfiClientUserAssignment(rfiId) {
  return `<div id="rfi-assign-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-assign-dialog-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-assign-dialog-title">Assign Client User</span><button class="dialog-close" data-dialog-close="rfi-assign-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="modal-form-group"><label for="rca-question">Question</label><select id="rca-question" class="select select-bordered w-full"></select></div><div class="modal-form-group"><label for="rca-user">Client User</label><select id="rca-user" class="select select-bordered w-full"></select></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-assign-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rcaAssign">Assign</button></div>
    </div></div>
  <script>
  window.openRfiAssign=function(){document.getElementById('rfi-assign-dialog').style.display='flex';Promise.all([fetch('/api/rfi_question?rfi_id=${rfiId}').then(function(r){return r.json()}),fetch('/api/user?role=client_user').then(function(r){return r.json()})]).then(function(r){var qs=(r[0].data||r[0]||[]);var us=(r[1].data||r[1]||[]);var qsel=document.getElementById('rca-question');while(qsel.options.length>0)qsel.remove(0);qs.forEach(function(q){var o=document.createElement('option');o.value=q.id;o.textContent=q.question_text||q.question||q.id;qsel.appendChild(o)});var usel=document.getElementById('rca-user');while(usel.options.length>0)usel.remove(0);us.forEach(function(u){var o=document.createElement('option');o.value=u.id;o.textContent=u.name||u.email||u.id;usel.appendChild(o)})}).catch(function(){})};
  window.rcaAssign=async function(){var qid=document.getElementById('rca-question').value;var uid=document.getElementById('rca-user').value;if(!qid||!uid){showToast('Select both','error');return}try{var r=await fetch('/api/rfi_question/'+qid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({assigned_to:uid})});if(r.ok){showToast('Assigned','success');document.getElementById('rfi-assign-dialog').style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function rfiBulkAssignDialog(rfiId) {
  return `<div id="rfi-bulk-assign" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-bulk-assign-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-bulk-assign-title">Bulk Assign Client Users</span><button class="dialog-close" data-dialog-close="rfi-bulk-assign" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="modal-form-group"><label for="rba-user">Client User</label><select id="rba-user" class="select select-bordered w-full"></select></div><div class="modal-form-group"><label class="flex items-center gap-2"><input type="checkbox" id="rba-unassigned" class="checkbox" checked/><span class="text-sm">Unassigned questions only</span></label></div><div id="rba-preview" class="text-sm text-gray-500 mt-2"></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-bulk-assign">Cancel</button><button class="btn btn-primary btn-sm" data-action="rbaBulk">Assign All</button></div>
    </div></div>
  <script>
  window.openBulkAssign=function(){document.getElementById('rfi-bulk-assign').style.display='flex';fetch('/api/user?role=client_user').then(function(r){return r.json()}).then(function(d){var us=d.data||d||[];var sel=document.getElementById('rba-user');while(sel.options.length>0)sel.remove(0);us.forEach(function(u){var o=document.createElement('option');o.value=u.id;o.textContent=u.name||u.email;sel.appendChild(o)})}).catch(function(){});fetch('/api/rfi_question?rfi_id=${rfiId}').then(function(r){return r.json()}).then(function(d){var qs=d.data||d||[];var unassigned=qs.filter(function(q){return!q.assigned_to}).length;document.getElementById('rba-preview').textContent=unassigned+' unassigned of '+qs.length+' total questions'}).catch(function(){})};
  window.rbaBulk=async function(){var uid=document.getElementById('rba-user').value;if(!uid){showToast('Select a user','error');return}var onlyUnassigned=document.getElementById('rba-unassigned').checked;try{var r=await fetch('/api/rfi_question/bulk-assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rfi_id:'${rfiId}',assigned_to:uid,unassigned_only:onlyUnassigned})});if(r.ok){var d=await r.json();showToast((d.count||'All')+' questions assigned','success');document.getElementById('rfi-bulk-assign').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function rfiBulkDeadlineDialog(rfiId) {
  return `<div id="rfi-bulk-deadline" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-bulk-deadline-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-bulk-deadline-title">Set Bulk Deadline</span><button class="dialog-close" data-dialog-close="rfi-bulk-deadline" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="modal-form-group"><label for="rbd-date">Deadline Date</label><input type="date"  id="rbd-date" class="input input-bordered w-full"/></div><div class="modal-form-group"><label class="flex items-center gap-2"><input type="checkbox" id="rbd-all" class="checkbox" checked/><span class="text-sm">Apply to all questions (including those with existing deadlines)</span></label></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-bulk-deadline">Cancel</button><button class="btn btn-primary btn-sm" data-action="rbdSet">Set Deadline</button></div>
    </div></div>
  <script>
  window.openBulkDeadline=function(){document.getElementById('rfi-bulk-deadline').style.display='flex'};
  window.rbdSet=async function(){var date=document.getElementById('rbd-date').value;if(!date){showToast('Select a date','error');return}var ts=Math.floor(new Date(date).getTime()/1000);try{var r=await fetch('/api/rfi_question/bulk-deadline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rfi_id:'${rfiId}',deadline:ts,override_existing:document.getElementById('rbd-all').checked})});if(r.ok){showToast('Deadlines set','success');document.getElementById('rfi-bulk-deadline').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function rfiAttachmentPreview() {
  return `<div id="rfi-attach-preview" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-attach-preview-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:800px;max-height:90vh">
      <div class="dialog-header"><span class="dialog-title" id="rfi-attach-preview-title">Attachment</span><button class="dialog-close" data-dialog-close="rfi-attach-preview" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body" style="overflow:auto;max-height:70vh"><div id="rap-content" class="text-center"><div class="text-gray-500">Loading...</div></div></div>
      <div class="dialog-footer"><a id="rap-download" href="#" download class="btn btn-primary btn-sm">Download</a><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-attach-preview">Close</button></div>
    </div></div>
  <script>
  window.previewAttachment=function(url,name,type){document.getElementById('rfi-attach-preview').style.display='flex';document.getElementById('rfi-attach-preview-title').textContent=name||'Attachment';document.getElementById('rap-download').href=url;var c=document.getElementById('rap-content');if(type&&type.startsWith('image/')){c.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:60vh" alt="'+name+'"/>'}else if(type==='application/pdf'){c.innerHTML='<iframe src="'+url+'" style="width:100%;height:60vh;border:none"></iframe>'}else{c.innerHTML='<div class="text-gray-500 py-8"><div style="font-size:3rem">&#128196;</div><div class="mt-2">'+name+'</div><div class="text-xs mt-1">Preview not available for this file type</div></div>'}};
  window.lazyLoadAttachments=function(){var items=document.querySelectorAll('[data-lazy-src]');if(!items.length)return;var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var el=e.target;var src=el.dataset.lazySrc;if(el.tagName==='IMG'){el.src=src}else{el.style.backgroundImage='url('+src+')'}el.removeAttribute('data-lazy-src');obs.unobserve(el)}})},{rootMargin:'200px'});items.forEach(function(el){obs.observe(el)})};
  document.addEventListener('DOMContentLoaded',function(){lazyLoadAttachments()});
  </script>`;
}
export function rfiReportGeneration(rfiId, rfiName) {
  return `<div id="rfi-report-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-report-dialog-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-report-dialog-title">Generate RFI Report</span><button class="dialog-close" data-dialog-close="rfi-report-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rrg-type">Report Type</label><select id="rrg-type" class="select select-bordered w-full"><option value="summary">Summary Report</option><option value="detailed">Detailed Report (with responses)</option><option value="status">Status Report</option><option value="overdue">Overdue Items Report</option></select></div>
        <div class="modal-form-group"><label for="rrg-format">Format</label><select id="rrg-format" class="select select-bordered w-full"><option value="pdf">PDF</option><option value="xlsx">Excel</option><option value="csv">CSV</option></select></div>
        <div class="modal-form-group"><label class="flex items-center gap-2"><input type="checkbox" id="rrg-attachments" class="checkbox"/><span class="text-sm">Include attachments</span></label></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-report-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rrgGenerate">Generate</button></div>
    </div></div>
  <script>
  window.openRfiReport=function(){document.getElementById('rfi-report-dialog').style.display='flex'};
  window.rrgGenerate=async function(){var type=document.getElementById('rrg-type').value;var format=document.getElementById('rrg-format').value;var attach=document.getElementById('rrg-attachments').checked;showToast('Generating report...','info');try{var r=await fetch('/api/rfi/${rfiId}/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,format:format,include_attachments:attach})});if(r.ok){var blob=await r.blob();var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='${(rfiName || 'rfi').replace(/'/g, '')}-'+type+'.'+format;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('Report downloaded','success')}else{showToast('Report generation failed','error')}}catch(e){showToast('Error generating report','error')}document.getElementById('rfi-report-dialog').style.display='none'};
  </script>`;
}
export function rfiEmailRemindersDialog(rfiId) {
  return `<div id="rfi-reminders-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-reminders-dialog-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-reminders-dialog-title">Email Reminders</span><button class="dialog-close" data-dialog-close="rfi-reminders-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label class="flex items-center gap-2"><input type="checkbox" id="rre-auto" class="checkbox" checked/><span class="text-sm">Auto-send reminders for overdue items</span></label></div>
        <div class="modal-form-group"><label for="rre-freq">Reminder Frequency</label><select id="rre-freq" class="select select-bordered w-full"><option value="daily">Daily</option><option value="weekly" selected>Weekly</option><option value="biweekly">Bi-weekly</option></select></div>
        <div class="modal-form-group"><label>Include in reminder</label><div class="flex flex-col gap-2"><label class="flex items-center gap-2"><input type="checkbox" class="checkbox rre-inc" value="overdue" checked/><span class="text-sm">Overdue questions</span></label><label class="flex items-center gap-2"><input type="checkbox" class="checkbox rre-inc" value="upcoming" checked/><span class="text-sm">Upcoming deadlines (3 days)</span></label><label class="flex items-center gap-2"><input type="checkbox" class="checkbox rre-inc" value="unanswered"/><span class="text-sm">All unanswered questions</span></label></div></div>
        <button class="btn btn-outline btn-sm mt-2" data-action="rreSendNow">Send Reminder Now</button>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-reminders-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rreSave">Save Settings</button></div>
    </div></div>
  <script>
  window.openRfiReminders=function(){document.getElementById('rfi-reminders-dialog').style.display='flex'};
  window.rreSave=async function(){var inc=[].slice.call(document.querySelectorAll('.rre-inc:checked')).map(function(c){return c.value});try{var r=await fetch('/api/rfi/${rfiId}',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({reminder_auto:document.getElementById('rre-auto').checked,reminder_frequency:document.getElementById('rre-freq').value,reminder_includes:JSON.stringify(inc)})});if(r.ok){showToast('Reminder settings saved','success');document.getElementById('rfi-reminders-dialog').style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  window.rreSendNow=async function(){showToast('Sending reminders...','info');try{await fetch('/api/rfi/${rfiId}/remind',{method:'POST'});showToast('Reminders sent','success')}catch(e){showToast('Send failed','error')}};
  </script>`;
}
export function rfiTemplateSelectDropdown(templates = []) {
  const opts = templates.map(t => `<option value="${t.id}">${t.name} (${t.questionCount || 0} questions)</option>`).join('');
  return `<div class="modal-form-group"><label for="rfi-template-select">RFI Template</label><select id="rfi-template-select" class="select select-bordered w-full" onchange="rfiTemplateChanged(this.value)"><option value="">-- Select Template --</option>${opts}</select><div id="rfi-template-desc" class="text-xs text-gray-500 mt-1"></div></div>
  <script>window.rfiTemplateChanged=function(id){var desc=document.getElementById('rfi-template-desc');if(!id){desc.textContent='';return}fetch('/api/rfi-template/'+id).then(function(r){return r.json()}).then(function(d){desc.textContent=(d.description||'')}).catch(function(){desc.textContent=''})};</script>`;
}
export function rfiDataGridGrouping(questions = [], groupBy = 'section') {
  const groups = {};
  questions.forEach(q => {
    const key = groupBy === 'section' ? (q.section_name || 'Unsectioned') : (q.category || 'Uncategorized');
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });
  const groupRows = Object.entries(groups).map(([name, items]) => {
    const qRows = items.map(q => {
      const statusCls = q.status === 'answered' ? 'text-green-600' : q.status === 'overdue' ? 'text-red-600' : 'text-gray-600';
      return `<tr class="hover cursor-pointer" tabindex="0" role="link" data-action="openQuestionEdit" data-args='["${q.id}"]' onkeydown="if(event.key==='Enter')openQuestionEdit('${q.id}')"><td class="text-sm">${q.question_text || q.question || '-'}</td><td><span class="${statusCls}">${statusLabel(q.status || 'pending')}</span></td><td class="text-xs text-gray-500">${q.assigned_to_name || q.assigned_to || '-'}</td><td class="text-xs">${q.deadline ? new Date(q.deadline * 1000).toLocaleDateString() : '-'}</td></tr>`;
    }).join('');
    return `<tr class="dg-group-header" tabindex="0" onkeydown="if(event.key==='Enter')this.click()" data-action="toggleNextSibling" data-self><td colspan="4"><button class="dg-expand-btn">&#9654;</button><strong>${name}</strong><span class="badge-status ml-2">${items.length}</span></td></tr><tbody>${qRows}</tbody>`;
  }).join('');
  return `<div class="dg-wrapper"><table class="dg-table w-full"><thead><tr><th class="dg-sortable" data-action="rfiSortCol" data-args='[0]'>Question</th><th class="dg-sortable" data-action="rfiSortCol" data-args='[1]'>Status</th><th>Assigned</th><th class="dg-sortable" data-action="rfiSortCol" data-args='[3]'>Deadline</th></tr></thead>${groupRows}</table></div>`;
}
export function rfiHideCompletedToggle(rfiId) {
  return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="rfi-hide-completed" class="checkbox checkbox-sm" onchange="rfiToggleCompleted(this.checked)"/><span>Hide completed questions</span></label>
  <script>window.rfiToggleCompleted=function(hide){document.querySelectorAll('tr[data-status=answered],tr[data-status=completed]').forEach(function(r){r.style.display=hide?'none':''})};</script>`;
}
export function rfiUnreadBadges(counts = {}) {
  const badge = (key, label) => counts[key] ? `<span class="badge badge-sm badge-primary ml-1">${counts[key]}</span>` : '';
  return { messages: badge('messages', 'Messages'), questions: badge('questions', 'Questions'), responses: badge('responses', 'Responses') };
}
export function rfiItemDialog() {
  return `<div id="rfi-item-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-item-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:640px"><div class="dialog-header"><span class="dialog-title" id="rfi-item-dialog-title">RFI Item</span><button class="dialog-close" data-dialog-close="rfi-item-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rid-title">Title</label><input id="rid-title" class="input input-bordered w-full"/></div>
        <div class="modal-form-group"><label for="rid-desc">Description</label><textarea id="rid-desc" class="textarea textarea-bordered w-full" rows="3"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="modal-form-group"><label for="rid-priority">Priority</label><select id="rid-priority" class="select select-bordered w-full"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
          <div class="modal-form-group"><label for="rid-due">Due Date</label><input type="date"  id="rid-due" class="input input-bordered w-full"/></div>
        </div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-item-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="ridSave">Save</button></div>
    </div></div>
  <script>
  var ridId=null;var ridRfiId=null;
  window.openRfiItem=function(rfiId,itemId){ridRfiId=rfiId;ridId=itemId;document.getElementById('rfi-item-dialog').style.display='flex';if(itemId){fetch('/api/rfi_question/'+itemId).then(function(r){return r.json()}).then(function(d){var q=d.data||d;document.getElementById('rid-title').value=q.title||q.question_text||'';document.getElementById('rid-desc').value=q.description||'';document.getElementById('rid-priority').value=q.priority||'medium';document.getElementById('rid-due').value=q.deadline?new Date(q.deadline*1000).toISOString().split('T')[0]:''}).catch(function(){})}else{document.getElementById('rid-title').value='';document.getElementById('rid-desc').value='';document.getElementById('rid-priority').value='medium';document.getElementById('rid-due').value=''}};
  window.ridSave=async function(){var body={title:document.getElementById('rid-title').value,description:document.getElementById('rid-desc').value,priority:document.getElementById('rid-priority').value};var dl=document.getElementById('rid-due').value;if(dl)body.deadline=Math.floor(new Date(dl).getTime()/1000);var url=ridId?'/api/rfi_question/'+ridId:'/api/rfi_question';var method=ridId?'PUT':'POST';if(!ridId)body.rfi_id=ridRfiId;try{var r=await fetch(url,{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){showToast(ridId?'Updated':'Created','success');document.getElementById('rfi-item-dialog').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function rfiAttachDialog(rfiId) {
  return `<div id="rfi-attach-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-attach-dialog-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-attach-dialog-title">Attach File to RFI</span><button class="dialog-close" data-dialog-close="rfi-attach-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rad-file">File</label><input type="file"  id="rad-file" class="file-input file-input-bordered w-full"/></div>
        <div class="modal-form-group"><label for="rad-desc">Description</label><input id="rad-desc" class="input input-bordered w-full" placeholder="File description (optional)"/></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-attach-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="radUpload">Upload</button></div>
    </div></div>
  <script>
  window.openRfiAttach=function(){document.getElementById('rfi-attach-dialog').style.display='flex'};
  window.radUpload=async function(){var file=document.getElementById('rad-file').files[0];if(!file){showToast('Select a file','error');return}var fd=new FormData();fd.append('file',file);fd.append('rfi_id','${rfiId}');fd.append('description',document.getElementById('rad-desc').value);try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok){showToast('File attached','success');document.getElementById('rfi-attach-dialog').style.display='none';location.reload()}else showToast('Upload failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function rfiAttachQuestionDialog(questionId) {
  return `<div id="rfi-aq-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rfi-aq-dialog-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rfi-aq-dialog-title">Attach File to Question</span><button class="dialog-close" data-dialog-close="rfi-aq-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="modal-form-group"><label for="raq-file">File</label><input type="file"  id="raq-file" class="file-input file-input-bordered w-full"/></div><div class="modal-form-group"><label for="raq-note">Note</label><input id="raq-note" class="input input-bordered w-full" placeholder="Optional note"/></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rfi-aq-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="raqUpload">Upload</button></div>
    </div></div>
  <script>
  var raqQid=null;
  window.openQuestionAttach=function(qid){raqQid=qid||'${questionId}';document.getElementById('rfi-aq-dialog').style.display='flex'};
  window.raqUpload=async function(){var file=document.getElementById('raq-file').files[0];if(!file){showToast('Select a file','error');return}var fd=new FormData();fd.append('file',file);fd.append('question_id',raqQid);fd.append('note',document.getElementById('raq-note').value);try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok){showToast('Attached','success');document.getElementById('rfi-aq-dialog').style.display='none';location.reload()}else showToast('Upload failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export {
  engagementFileSearchDialog, postRfiJournalDialog, postRfiFileUpload,
  importReviewQueriesDialog, engagementNotificationSettings,
  notificationTriggerDialog, teamChatChannelToggle
} from '@/ui/engagement-dialogs.js';
