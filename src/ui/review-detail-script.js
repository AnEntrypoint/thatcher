import { esc } from '@/ui/render-helpers.js';
import { TOAST_SCRIPT } from '@/ui/render-helpers.js';
import { reviewHighlightActionsScript } from '@/ui/review-highlight-actions-script.js';

export function reviewDetailScript(reviewId) {
  const id = esc(reviewId || '');
  return `${TOAST_SCRIPT}
function switchTab(tab){
  document.querySelectorAll('.rv-panel').forEach(function(p){p.style.display='none'});
  var panel=document.getElementById('rvpanel-'+tab);if(panel)panel.style.display='';
  document.querySelectorAll('[id^="rvtab-"]').forEach(function(b){b.classList.remove('active')});
  var btn=document.getElementById('rvtab-'+tab);if(btn)btn.classList.add('active');
  if(tab==='history')loadHistory('${id}');
}
async function resolveHighlight(id){if(!confirm('Mark this highlight as resolved?'))return;try{var r=await fetch('/api/mwr/review/${id}/highlights/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolved:true,status:'resolved'})});if(r.ok){showToast('Resolved','success');setTimeout(function(){location.reload()},500)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function bulkResolve(reviewId){if(!confirm('Resolve all highlights?'))return;try{var r=await fetch('/api/mwr/review/'+reviewId+'/highlights/bulk-resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolve_all:true})});if(r.ok){showToast('All resolved','success');setTimeout(function(){location.reload()},500)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function exportPdf(reviewId){showToast('Generating PDF...','info');try{var r=await fetch('/api/mwr/review/'+reviewId+'/export-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});if(r.ok){var b=await r.blob();var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='review-'+reviewId+'.pdf';a.click();showToast('PDF downloaded','success')}else showToast('Export failed','error')}catch(e){showToast('Error','error')}}
async function addCollaborator(reviewId){var email=document.getElementById('collab-email').value.trim();var role=document.getElementById('collab-role').value;if(!email){showToast('Email required','error');return}try{var r=await fetch('/api/mwr/review/'+reviewId+'/collaborators',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,role:role})});if(r.ok){showToast('Collaborator added','success');document.getElementById('collab-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function removeCollaborator(collabId){if(!confirm('Remove this collaborator?'))return;try{var r=await fetch('/api/mwr/review/${id}/collaborators/'+collabId,{method:'DELETE'});if(r.ok){showToast('Removed','success');setTimeout(function(){location.reload()},500)}else showToast('Failed','error')}catch(e){showToast('Error','error')}}
async function openChecklistPicker(reviewId){
  var dlg=document.getElementById('checklist-picker-dialog');if(!dlg)return;
  dlg.style.display='flex';
  var sel=document.getElementById('checklist-picker-template');sel.innerHTML='<option>Loading...</option>';
  try{
    var r=await fetch('/api/mwr/checklist-template',{credentials:'include'});var data=await r.json();
    if(!data.success||!data.templates||!data.templates.length){sel.innerHTML='<option value="">No templates available</option>';return}
    sel.innerHTML=data.templates.map(function(t){return '<option value="'+t.id+'">'+t.name.replace(/</g,'&lt;')+' ('+t.item_count+' items)</option>'}).join('');
  }catch(e){sel.innerHTML='<option value="">Failed to load templates</option>'}
}
async function saveChecklistFromTemplate(reviewId){
  var sel=document.getElementById('checklist-picker-template');var nameInput=document.getElementById('checklist-picker-name');
  var tplId=sel&&sel.value;if(!tplId){showToast('Pick a template','error');return}
  var body={template_id:tplId};var name=(nameInput&&nameInput.value||'').trim();if(name)body.name=name;
  var btn=document.getElementById('checklist-picker-save');if(btn)btn.disabled=true;
  try{
    var r=await fetch('/api/mwr/review/'+reviewId+'/checklists',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
    var data=await r.json();
    if(r.ok&&data.success){showToast('Checklist attached','success');document.getElementById('checklist-picker-dialog').style.display='none';setTimeout(function(){location.reload()},500)}
    else showToast('Failed: '+(data.error||'unknown'),'error');
  }catch(e){showToast('Network error','error')}
  finally{if(btn)btn.disabled=false}
}
function openAddTender(){
  var dlg=document.getElementById('tender-dialog');if(!dlg)return;
  ['tender-id','tender-deadline','tender-announcement','tender-contact-person','tender-contact-number','tender-contact-email','tender-price','tender-winning-price'].forEach(function(f){document.getElementById(f).value='';});
  document.getElementById('tender-dialog-title').textContent='Add Tender';
  document.getElementById('tender-status').value='open';
  dlg.style.display='flex';
}
function openEditTender(tenderId,status,deadline,announcement,contactPerson,contactNumber,contactEmail,price){
  var dlg=document.getElementById('tender-dialog');if(!dlg)return;
  document.getElementById('tender-id').value=tenderId;
  document.getElementById('tender-dialog-title').textContent='Edit Tender';
  document.getElementById('tender-status').value=status||'open';
  document.getElementById('tender-deadline').value=deadline||'';
  document.getElementById('tender-announcement').value=announcement||'';
  document.getElementById('tender-contact-person').value=contactPerson||'';
  document.getElementById('tender-contact-number').value=contactNumber||'';
  document.getElementById('tender-contact-email').value=contactEmail||'';
  document.getElementById('tender-price').value=price||'';
  dlg.style.display='flex';
}
async function saveTender(reviewId){
  var tenderId=document.getElementById('tender-id').value.trim();
  var deadline=document.getElementById('tender-deadline').value;
  if(!deadline){showToast('Deadline required','error');return}
  var body={status:document.getElementById('tender-status').value,deadline:deadline,announcement_date:document.getElementById('tender-announcement').value||null,contact_person:document.getElementById('tender-contact-person').value||null,contact_number:document.getElementById('tender-contact-number').value||null,contact_email:document.getElementById('tender-contact-email').value||null,price:document.getElementById('tender-price').value?Number(document.getElementById('tender-price').value):null,winning_price:document.getElementById('tender-winning-price').value?Number(document.getElementById('tender-winning-price').value):null};
  var btn=document.getElementById('tender-save-btn');if(btn)btn.disabled=true;
  try{
    var url=tenderId?'/api/mwr/review/'+reviewId+'/tender/'+tenderId:'/api/mwr/review/'+reviewId+'/tender';
    var r=await fetch(url,{method:tenderId?'PATCH':'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
    var data=await r.json();
    if(r.ok&&data.success){showToast(tenderId?'Tender updated':'Tender added','success');document.getElementById('tender-dialog').style.display='none';setTimeout(function(){location.reload()},500)}
    else showToast('Failed: '+(data.error||'unknown'),'error');
  }catch(e){showToast('Network error','error')}
  finally{if(btn)btn.disabled=false}
}
async function deleteTender(tenderId){if(!confirm('Delete this tender?'))return;try{var r=await fetch('/api/mwr/review/${id}/tender/'+tenderId,{method:'DELETE',credentials:'include'});var data=await r.json();if(r.ok&&data.success){showToast('Tender deleted','success');setTimeout(function(){location.reload()},500)}else showToast('Failed: '+(data.error||'unknown'),'error');}catch(e){showToast('Error','error')}}
function openAddLink(){document.getElementById('link-dialog').style.display='flex';document.getElementById('link-label').value='';document.getElementById('link-url').value='';}
async function saveLink(reviewId){var url=document.getElementById('link-url').value.trim();var label=document.getElementById('link-label').value.trim();if(!url){showToast('URL required','error');return}try{var r=await fetch('/api/mwr/review/'+reviewId+'/links',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({url:url,label:label||url,type:'url'})});var data=await r.json();if(r.ok&&data.success){showToast('Link added','success');document.getElementById('link-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else showToast('Failed: '+(data.error||'unknown'),'error');}catch(e){showToast('Network error','error')}}
async function removeLink(reviewId,idx){if(!confirm('Remove this link?'))return;try{var r=await fetch('/api/mwr/review/'+reviewId+'/links/'+idx,{method:'DELETE',credentials:'include'});var data=await r.json();if(r.ok&&data.success){showToast('Link removed','success');setTimeout(function(){location.reload()},500)}else showToast('Failed: '+(data.error||'unknown'),'error');}catch(e){showToast('Error','error')}}
async function loadHistory(reviewId){
  var list=document.getElementById('history-list');
  if(!list)return;
  list.innerHTML='<div style="font-size:13px;color:var(--color-text-muted);padding:24px 0;text-align:center">Loading...</div>';
  try{
    var r=await fetch('/api/audit/logs?entity_type=review&entity_id='+reviewId,{credentials:'include'});
    var data=await r.json();
    var logs=(data.logs||data.data||[]);
    if(!logs.length){list.innerHTML='<div style="font-size:13px;color:var(--color-text-muted);padding:24px 0;text-align:center">No history found</div>';return}
    list.innerHTML=logs.map(function(log){var ts=log.timestamp?new Date(log.timestamp).toLocaleString():'-';var op=log.operation||log.action||'-';var uid=log.user_id?'User '+log.user_id:'System';var details='';if(log.details&&typeof log.details==='object'){var keys=Object.keys(log.details).slice(0,3);details=keys.map(function(k){return k+': '+String(log.details[k]).slice(0,40)}).join(', ');}return '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--color-border,#e5e7eb)"><div style="width:8px;height:8px;border-radius:50%;background:var(--color-primary,#2563eb);margin-top:5px;flex-shrink:0"></div><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:8px"><span style="font-size:13px;font-weight:500;color:var(--color-text)">'+op.replace(/_/g,' ')+'</span><span style="font-size:12px;color:var(--color-text-muted);white-space:nowrap">'+ts+'</span></div><div style="font-size:12px;color:var(--color-text-muted);margin-top:2px">'+uid+(details?' &mdash; '+details:'')+'</div></div></div>';}).join('');
  }catch(e){list.innerHTML='<div style="font-size:13px;color:var(--color-danger,#dc2626);padding:24px 0;text-align:center">Failed to load history</div>'}
}
${reviewHighlightActionsScript(reviewId)}`;
}
