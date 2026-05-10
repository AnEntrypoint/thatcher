import { page } from '@/ui/layout.js';
import { canEdit, isPartner, isManager, isClientUser } from '@/ui/permissions-ui.js';
import { esc, statusBadge, TOAST_SCRIPT } from '@/ui/render-helpers.js';
import { SPACING } from '@/ui/spacing-system.js';

const TOAST = TOAST_SCRIPT;

function questionRow(q, i, sections = [], clientId = '', showRespond = false, showView = false) {
  const section = sections.find(s => s.id === q.section_id || s.id === q.rfi_section_id);
  const sLabel = section ? `<span class="badge badge-flat-primary text-xs">${esc(section.name)}</span>` : '';
  const hasResp = q.responses > 0 || q.response_count > 0;
  const respBadge = hasResp ? `<span class="badge badge-success badge-flat-success text-xs">Responded</span>` : '';
  const assignedLabel = q.assigned_to ? `<span class="badge badge-flat-secondary text-xs">Assigned</span>` : '';
  const assignBtn = clientId ? `<button data-action="openAssignQuestion" data-args='["${esc(q.id)}"]' class="btn btn-ghost btn-xs">Assign</button>` : '';
  const respondBtn = showRespond ? `<button data-action="openRespondQuestion" data-args='["${esc(q.id)}","${esc(q.question_text||q.question||q.title||'')}"]' class="btn btn-primary btn-xs">Respond</button>` : '';
  const viewBtn = showView && hasResp ? `<button data-action="viewResponses" data-args='["${esc(q.id)}","${esc(q.question_text||q.question||q.title||'')}"]' class="btn btn-ghost btn-xs">Responses</button>` : '';
  const editDelBtns = !showRespond ? `<button data-action="openEditQuestion" data-args='["${esc(q.id)}"]' class="btn btn-ghost btn-xs">Edit</button>${assignBtn}<button data-action="deleteQuestion" data-args='["${esc(q.id)}"]' class="btn btn-error btn-xs">Del</button>` : '';
  return `<tr class="hover">
    <td class="text-center text-sm text-base-content/40 w-8">${i+1}</td>
    <td class="text-sm max-w-sm">${esc(q.question_text||q.question||q.title||'Question')}</td>
    <td>${sLabel}</td>
    <td class="text-sm text-base-content/50">${q.deadline?new Date(typeof q.deadline==='number'?q.deadline*1000:q.deadline).toLocaleDateString():'-'}</td>
    <td>${respBadge}${assignedLabel}</td>
    <td><div class="flex gap-2">${respondBtn}${viewBtn}${editDelBtns}</div></td>
  </tr>`;
}

function editQuestionDialog(rfiId, sections) {
  const sectionOpts = sections.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  return `<div id="q-dialog" data-rfi-id="${esc(rfiId)}" class="modal" style="display:none" data-dialog-close-overlay="true"><div class="modal-overlay" data-dialog-close="q-dialog"></div><div class="modal-content rounded-box max-w-lg p-6"><h3 class="text-lg font-semibold mb-4" id="q-dialog-title">Edit Question</h3><div class="form-group mb-3"><label class="label"><span class="label-text font-medium">Question Text</span></label><textarea id="q-text" rows="4" class="textarea textarea-solid max-w-full"></textarea></div><div class="form-group mb-3"><label class="label"><span class="label-text font-medium">Section</span></label><select id="q-section" class="select select-solid max-w-full"><option value="">No section</option>${sectionOpts}</select></div><div class="grid grid-cols-2 gap-3 mb-4"><div class="form-group"><label class="label"><span class="label-text font-medium">Deadline</span></label><input type="date" id="q-deadline" class="input input-solid max-w-full"/></div><div class="form-group"><label class="label"><span class="label-text font-medium">Category</span></label><input type="text" id="q-category" placeholder="Category" class="input input-solid max-w-full"/></div></div><input type="hidden" id="q-edit-id"/><div class="modal-action"><button data-action="saveQuestion" data-args='["${esc(rfiId)}"]' class="btn btn-primary">Save</button><button data-dialog-close="q-dialog" class="btn btn-ghost">Cancel</button></div></div></div>`;
}

function assignQuestionDialog(rfiId) {
  return `<div id="assign-q-dialog" data-rfi-id="${esc(rfiId)}" class="modal" style="display:none" data-dialog-close-overlay="true"><div class="modal-overlay" data-dialog-close="assign-q-dialog"></div><div class="modal-content rounded-box max-w-sm p-6"><h3 class="text-lg font-semibold mb-4">Assign to Client User</h3><div class="form-group mb-4"><label class="label"><span class="label-text font-medium">Client User</span></label><select id="assign-q-user" class="select select-solid max-w-full"><option value="">Loading...</option></select></div><input type="hidden" id="assign-q-id"/><div class="modal-action"><button onclick="saveAssignQuestion()" class="btn btn-primary">Assign</button><button data-dialog-close="assign-q-dialog" class="btn btn-ghost">Cancel</button></div></div></div>`;
}

function addSectionDialog(rfiId) {
  return `<div id="sec-dialog" class="modal" style="display:none" data-dialog-close-overlay="true"><div class="modal-overlay" data-dialog-close="sec-dialog"></div><div class="modal-content rounded-box max-w-sm p-6"><h3 class="text-lg font-semibold mb-4">Add Section</h3><div class="form-group mb-4"><label class="label"><span class="label-text font-medium">Section Name</span></label><input type="text" id="sec-name" class="input input-solid max-w-full"/></div><div class="modal-action"><button data-action="saveSection" data-args='["${esc(rfiId)}"]' class="btn btn-primary">Add</button><button data-dialog-close="sec-dialog" class="btn btn-ghost">Cancel</button></div></div></div>`;
}

export function renderRfiDetail(user, rfi = {}, questions = [], sections = [], engagement = null) {
  const canEditRfi = canEdit(user, 'rfi');
  const isClient = isClientUser(user);
  const canViewResponses = isPartner(user) || isManager(user);
  const clientId = engagement?.client_id || '';
  const qRows = questions.map((q, i) => questionRow(q, i, sections, canEditRfi ? clientId : '', isClient, canViewResponses)).join('') ||
    `<tr><td colspan="6" class="text-center py-8 text-base-content/40 text-sm">No questions yet. Add one using the button above.</td></tr>`;

  const sectionTabs = sections.length ? `<div class="tabs tabs-boxed bg-base-200 flex-wrap gap-1">
    <button data-action="filterBySection" data-args='[""]' id="stab-all" class="tab-btn active">All</button>
    ${sections.map(s => `<button data-action="filterBySection" data-args='["${esc(s.id)}"]' id="stab-${esc(s.id)}" class="tab-btn">${esc(s.name)}</button>`).join('')}
  </div>` : '';

  const engLink = engagement
    ? `<a href="/engagement/${esc(engagement.id)}" class="text-primary text-sm">&#8592; ${esc(engagement.name||'Engagement')}</a>`
    : `<a href="/rfi" class="text-primary text-sm">&#8592; RFI List</a>`;

  const reportBtn = `<a href="/rfi/${esc(rfi.id)}/report" target="_blank" class="btn btn-ghost btn-sm">Report</a>`;
  const headerBtns = `<div class="flex gap-2 flex-wrap">${reportBtn}${canEditRfi ? `
      <button data-action="openAddQuestion" class="btn btn-primary btn-sm">+ Question</button>
      <button data-action="openDialog" data-params='{"dialogId":"sec-dialog"}' class="btn btn-ghost btn-sm">+ Section</button>
      <button data-action="sendReminder" data-args='["${esc(rfi.id)}"]' class="btn btn-ghost btn-sm">Send Reminder</button>
      <a href="/rfi/${esc(rfi.id)}/edit" class="btn btn-outline-primary btn-sm">Edit RFI</a>
    ` : ''}</div>`;

  const infoItems = [
    ['Engagement', engagement?.name ? esc(engagement.name) : '<span class="text-base-content/30">—</span>'],
    ['Status', statusBadge(rfi.status)],
    ['Deadline', rfi.deadline?new Date(typeof rfi.deadline==='number'?rfi.deadline*1000:rfi.deadline).toLocaleDateString():'-'],
    ['Questions', questions.length],
    ['Sections', sections.length],
    ['Mandatory', rfi.mandatory!==false?'Yes':'No'],
  ];

  const infoGrid = `<div class="rfi-info-grid">` +
    infoItems.map(([l,v]) => `<div><div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-muted);margin-bottom:${SPACING.xs}">${l}</div><div style="font-size:0.875rem;color:var(--color-text)">${v}</div></div>`).join('') +
    `</div>`;

  const content = `
    <nav class="breadcrumb-clean">${engLink}</nav>
    <div class="page-header">
      <div>
        <h1 class="page-title">${esc(rfi.display_name||rfi.name||rfi.title||(engagement?'RFI \u2013 '+(engagement.name||''):'RFI'))}</h1>
         ${rfi.description ? `<p style="margin-top:${SPACING.xs};font-size:0.875rem;color:var(--color-text-muted)">${esc(rfi.description)}</p>` : ''}
      </div>
      ${headerBtns}
    </div>
    <div class="card-clean mb-4">
      <div class="card-clean-body">${infoGrid}</div>
    </div>
    <div class="card-clean">
      <div class="card-clean-body">
         <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md};flex-wrap:wrap;gap:${SPACING.sm}">
           <h2 style="font-size:0.875rem;font-weight:600;color:var(--color-text)">Questions (${questions.length})</h2>
           <div style="display:flex;gap:${SPACING.sm};align-items:center;flex-wrap:wrap">
            ${sectionTabs}
            <input type="text" placeholder="Search..." oninput="filterQuestions(this.value)" class="input input-solid" style="max-width:160px;font-size:0.875rem"/>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table" id="q-table">
            <thead><tr><th>#</th><th>Question</th><th>Section</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="q-tbody">${qRows}</tbody>
          </table>
        </div>
      </div>
    </div>
    ${editQuestionDialog(rfi.id, sections)}
    ${addSectionDialog(rfi.id)}
    ${clientId ? assignQuestionDialog(rfi.id) : ''}
    ${canViewResponses ? `<div id="view-resp-dialog" class="modal" style="display:none" data-dialog-close-overlay="true"><div class="modal-overlay" data-dialog-close="view-resp-dialog"></div><div class="modal-content rounded-box max-w-lg p-6"><h3 class="text-lg font-semibold mb-1">Responses</h3><p id="view-resp-qtext" class="text-sm text-base-content/60 mb-3"></p><div id="view-resp-list" style="max-height:240px;overflow-y:auto"></div><div class="modal-action"><button data-dialog-close="view-resp-dialog" class="btn btn-ghost">Close</button></div></div></div>` : ''}
    ${isClient ? `<div id="respond-q-dialog" class="modal" style="display:none" data-dialog-close-overlay="true"><div class="modal-overlay" data-dialog-close="respond-q-dialog"></div><div class="modal-content rounded-box max-w-lg p-6"><h3 class="text-lg font-semibold mb-1">Respond to Question</h3><p id="respond-q-text" class="text-sm text-base-content/60 mb-4"></p><div class="form-group mb-3"><label class="label"><span class="label-text font-medium">Your Response</span></label><textarea id="respond-q-answer" rows="5" class="textarea textarea-solid max-w-full" placeholder="Enter your response..."></textarea></div><div class="form-group mb-4"><label class="label"><span class="label-text font-medium">Attach File (optional)</span></label><input type="file" id="respond-q-file" class="input input-solid max-w-full"/></div><input type="hidden" id="respond-q-id"/><div class="modal-action"><button onclick="submitResponse()" class="btn btn-primary">Submit</button><button data-dialog-close="respond-q-dialog" class="btn btn-ghost">Cancel</button></div></div></div>` : ''}
  `;

  const script = `${TOAST}
var activeSection='';
function filterBySection(sid){
  activeSection=sid;
  document.querySelectorAll('[id^="stab-"]').forEach(b=>b.classList.toggle('active',b.id==='stab-'+(sid||'all')));
  filterRows()
}
function filterRows(){var q=(document.querySelector('#q-table input')?.value||'').toLowerCase();document.querySelectorAll('#q-tbody tr').forEach(function(r){var text=(r.textContent||'').toLowerCase();var secSpan=r.querySelector('td:nth-child(3) span');var rowSec=secSpan?secSpan.textContent:'';var showSec=!activeSection||rowSec===document.getElementById('stab-'+activeSection)?.textContent;r.style.display=(!q||text.includes(q))&&showSec?'':'none'})}
function filterQuestions(q){filterRows()}
function openAddQuestion(){document.getElementById('q-dialog').style.display='flex';document.getElementById('q-dialog-title').textContent='Add Question';document.getElementById('q-edit-id').value='';document.getElementById('q-text').value='';document.getElementById('q-section').value='';document.getElementById('q-deadline').value='';document.getElementById('q-category').value=''}
async function openEditQuestion(id){document.getElementById('q-dialog').style.display='flex';document.getElementById('q-dialog-title').textContent='Edit Question';document.getElementById('q-edit-id').value=id;try{var rfiId=document.getElementById('q-dialog').dataset.rfiId;var r=await fetch('/api/rfi/'+rfiId+'/questions/'+id);var d=await r.json();var q=d.data||d;document.getElementById('q-text').value=q.question_text||q.question||q.title||'';document.getElementById('q-section').value=q.section_id||q.rfi_section_id||'';document.getElementById('q-deadline').value=q.deadline?(new Date(typeof q.deadline==='number'?q.deadline*1000:q.deadline)).toISOString().split('T')[0]:'';document.getElementById('q-category').value=q.category||''}catch(e){showToast('Error loading','error')}}
async function saveQuestion(rfiId){var id=document.getElementById('q-edit-id').value;var questionText=document.getElementById('q-text').value.trim();if(!questionText){showToast('Question text required','error');return}var data={question:questionText,category:document.getElementById('q-category').value.trim()||null,section_id:document.getElementById('q-section').value||null};var dl=document.getElementById('q-deadline').value;if(dl)data.due_date=Math.floor(new Date(dl).getTime()/1000);var btn=event?.target;if(btn){btn.disabled=true;btn.textContent='Saving...'}try{var url=id?'/api/rfi/'+rfiId+'/questions/'+id:'/api/rfi/'+rfiId+'/questions';var r=await fetch(url,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});var result=await r.json();if(r.ok){showToast(id?'Question updated':'Question added','success');document.getElementById('q-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast(result.message||result.error||'Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}finally{if(btn){btn.disabled=false;btn.textContent='Save'}}}
async function deleteQuestion(id){if(!confirm('Delete this question?'))return;var rfiId=document.getElementById('q-dialog').dataset.rfiId;try{var r=await fetch('/api/rfi/'+rfiId+'/questions/'+id,{method:'DELETE'});if(r.ok){showToast('Question deleted','success');setTimeout(function(){location.reload()},500)}else showToast('Delete failed','error')}catch(e){showToast('Error','error')}}
async function saveSection(rfiId){var name=document.getElementById('sec-name').value.trim();if(!name){showToast('Name required','error');return}try{var r=await fetch('/api/rfi_section',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,rfi_id:rfiId})});if(r.ok){showToast('Section added','success');setTimeout(function(){location.reload()},500)}else showToast('Failed','error')}catch(e){showToast('Error','error')}document.getElementById('sec-dialog').style.display='none'}
async function sendReminder(rfiId){try{var r=await fetch('/api/friday/rfi/reminder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rfi_id:rfiId})});if(r.ok)showToast('Reminder sent','success');else showToast('Failed','error')}catch(e){showToast('Error','error')}}`;

  const assignScript = clientId ? `
var _assignClientId=${JSON.stringify(clientId)};
window.openAssignQuestion=async function(qId){
  var dlg=document.getElementById('assign-q-dialog');
  dlg.style.display='flex';
  document.getElementById('assign-q-id').value=qId;
  var sel=document.getElementById('assign-q-user');
  sel.innerHTML='<option value="">Loading...</option>';
  try{
    var r=await fetch('/api/users?client_id='+_assignClientId+'&pageSize=100',{credentials:'include'});
    var d=await r.json();
    var users=(d.data||d||[]).filter(function(u){return !u.deleted_at});
    sel.innerHTML='<option value="">Select client user...</option>'+users.map(function(u){return'<option value="'+u.id+'">'+(u.name||u.email)+'</option>'}).join('');
  }catch(e){sel.innerHTML='<option value="">Error loading users</option>'}
};
window.saveAssignQuestion=async function(){
  var qId=document.getElementById('assign-q-id').value;
  var userId=document.getElementById('assign-q-user').value;
  if(!userId){showToast('Select a user','error');return}
  var rfiId=document.getElementById('assign-q-dialog').dataset.rfiId;
  try{
    var r=await fetch('/api/rfi/'+rfiId+'/questions/'+qId,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({assigned_to:userId})});
    if(r.ok){showToast('Question assigned','success');document.getElementById('assign-q-dialog').style.display='none';setTimeout(function(){location.reload()},500)}
    else showToast('Failed to assign','error')
  }catch(e){showToast('Error: '+e.message,'error')}
};` : '';

  const viewRespScript = canViewResponses ? `
var _rfiIdForView=${JSON.stringify(rfi.id)};
window.viewResponses=async function(qId,qText){document.getElementById('view-resp-qtext').textContent=qText||'';document.getElementById('view-resp-list').innerHTML='<div class="text-sm text-base-content/40">Loading...</div>';document.getElementById('view-resp-dialog').style.display='flex';try{var r=await fetch('/api/rfi/'+_rfiIdForView+'/questions/'+qId+'/responses',{credentials:'include'});var d=await r.json();var items=d.data||d||[];document.getElementById('view-resp-list').innerHTML=items.length?items.map(function(resp){return'<div style="border:1px solid var(--color-border);border-radius:6px;padding:8px;margin-bottom:6px"><div class="text-sm">'+resp.response+'</div><div class="text-xs text-base-content/40 mt-1">'+new Date(typeof resp.created_at==="number"?resp.created_at*1000:resp.created_at).toLocaleString()+'</div></div>'}).join(''):'<div class="text-sm text-base-content/40">No responses yet</div>'}catch(e){document.getElementById('view-resp-list').innerHTML='<div class="text-sm text-error">Error loading</div>'}};` : '';

  const respondScript = isClient ? `
var _respondRfiId=${JSON.stringify(rfi.id)};
window.openRespondQuestion=function(qId,qText){
  document.getElementById('respond-q-id').value=qId;
  document.getElementById('respond-q-text').textContent=qText||'';
  document.getElementById('respond-q-answer').value='';
  document.getElementById('respond-q-file').value='';
  document.getElementById('respond-q-dialog').style.display='flex';
};
window.submitResponse=async function(){
  var qId=document.getElementById('respond-q-id').value;
  var answer=document.getElementById('respond-q-answer').value.trim();
  if(!answer){showToast('Response required','error');return}
  var fileInput=document.getElementById('respond-q-file');
  var file=fileInput.files&&fileInput.files[0];
  var btn=event&&event.target;
  if(btn){btn.disabled=true;btn.textContent='Submitting...'}
  try{
    var body;var headers={};
    if(file){body=new FormData();body.append('response_text',answer);body.append('file',file)}
    else{body=JSON.stringify({response_text:answer});headers['Content-Type']='application/json'}
    var r=await fetch('/api/rfi/'+_respondRfiId+'/questions/'+qId+'/responses',{method:'POST',headers,body,credentials:'include'});
    if(r.ok){showToast('Response submitted','success');document.getElementById('respond-q-dialog').style.display='none';setTimeout(function(){location.reload()},500)}
    else{var d=await r.json();showToast(d.error||'Failed','error')}
  }catch(e){showToast('Error: '+e.message,'error')}
  finally{if(btn){btn.disabled=false;btn.textContent='Submit'}}
};` : '';

  return page(user, `${esc(rfi.name||'RFI')} | Moonlanding`, null, content, [script, assignScript, viewRespScript, respondScript]);
}
