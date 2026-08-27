import { createDialog } from '@/ui/dialog-factory.js';
import { esc } from '@/ui/render-helpers.js';

export function reviewCreateDialog() {
  const body = `<div class="modal-form-group"><label for="rcd-name">Name</label><input id="rcd-name" class="input input-bordered w-full" placeholder="Review name"/></div>
    <div class="modal-form-group"><label for="rcd-engagement">Engagement</label><select id="rcd-engagement" class="select select-bordered w-full"><option value="">Loading engagements...</option></select></div>
    <div class="modal-form-group"><label for="rcd-type">Type</label><select id="rcd-type" class="select select-bordered w-full"><option value="standard">Standard</option><option value="tender">Tender</option><option value="compliance">Compliance</option></select></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-create-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rcdSave">Create</button>`;
  return createDialog('review-create-dialog', 'New Review', body, footer) + `
  <script>
  (function(){var loaded=false;
  window.__loadRcdEngagements=function(){if(loaded)return;loaded=true;fetch('/api/engagement',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('rcd-engagement');var items=d.data||d||[];sel.innerHTML=items.length?items.map(function(e){return '<option value="'+e.id+'">'+(e.name||e.id)+'</option>'}).join(''):'<option value="">No engagements found</option>'}).catch(function(){var sel=document.getElementById('rcd-engagement');if(sel)sel.innerHTML='<option value="">Failed to load</option>'})};
  document.addEventListener('click',function(e){if(e.target&&e.target.dataset&&e.target.dataset.action==='openDialog'&&e.target.dataset.args==='["review-create-dialog"]')window.__loadRcdEngagements()});
  window.rcdSave=async function(){var name=document.getElementById('rcd-name').value.trim();var engagementId=document.getElementById('rcd-engagement').value;var type=document.getElementById('rcd-type').value;if(!name){showToast('Name required','error');return}try{var r=await fetch('/api/review',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,engagement_id:engagementId||null,review_type:type})});if(r.ok){var d=await r.json();showToast('Review created','success');document.getElementById('review-create-dialog').style.display='none';window.location='/review/'+(d.data?d.data.id:d.id)}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  })();
  </script>`;
}

export function reviewTemplateChoiceDialog() {
  const body = `<div id="rtcd-list" style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto">Loading templates...</div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-template-choice-dialog">Cancel</button>`;
  return createDialog('review-template-choice-dialog', 'Choose Template', body, footer) + `
  <script>
  window.__rtcdCallback=null;
  window.showTemplateChoice=function(cb){window.__rtcdCallback=cb;var dlg=document.getElementById('review-template-choice-dialog');dlg.style.display='flex';var list=document.getElementById('rtcd-list');list.textContent='Loading templates...';fetch('/api/review_template',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){var items=d.data||d||[];if(!items.length){list.textContent='No templates available';return}list.innerHTML='';items.forEach(function(t){var btn=document.createElement('button');btn.type='button';btn.className='btn-ghost-clean';btn.style.textAlign='left';btn.textContent=t.name||t.id;btn.addEventListener('click',function(){dlg.style.display='none';if(window.__rtcdCallback)window.__rtcdCallback(t)});list.appendChild(btn)})}).catch(function(){list.textContent='Failed to load templates'})};
  </script>`;
}

export function reviewContextMenu() {
  return `<div id="review-ctx-menu" class="review-ctx-menu" style="display:none;position:fixed;z-index:1000;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);box-shadow:var(--shadow-md);min-width:160px;padding:4px" role="menu">
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxAction" data-args='["open"]'>Open</button>
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxAction" data-args='["pdf"]'>Open PDF</button>
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxAction" data-args='["highlights"]'>Highlights</button>
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxAction" data-args='["edit"]'>Edit</button>
    <div style="height:1px;background:var(--color-border);margin:4px 0"></div>
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxOpenFlags">Flags...</button>
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxOpenTags">Tags...</button>
    <button type="button" class="review-ctx-item" role="menuitem" data-action="ctxOpenDeadline">Set deadline...</button>
  </div>
  <style>
  .review-ctx-item{display:block;width:100%;text-align:left;padding:6px 10px;background:transparent;border:0;font-size:13px;color:var(--color-text);cursor:pointer;border-radius:4px}
  .review-ctx-item:hover{background:var(--color-bg)}
  </style>
  <script>
  window.ctxOpenFlags=function(){var el=document.getElementById('review-ctx-menu');var id=el&&el.dataset.reviewId;if(!id)return;var dlg=document.getElementById('review-flags-dialog');if(dlg){dlg.dataset.reviewId=id;dlg.style.display='flex'}};
  window.ctxOpenTags=function(){var el=document.getElementById('review-ctx-menu');var id=el&&el.dataset.reviewId;if(!id)return;var dlg=document.getElementById('review-tags-dialog');if(dlg){dlg.dataset.reviewId=id;dlg.style.display='flex'}};
  window.ctxOpenDeadline=function(){var el=document.getElementById('review-ctx-menu');var id=el&&el.dataset.reviewId;if(!id)return;var dlg=document.getElementById('review-deadline-dialog');if(dlg){dlg.dataset.reviewId=id;dlg.style.display='flex'}};
  </script>
  ${reviewFlagsDialog()}${reviewTagsDialog()}${reviewDeadlineDialog()}`;
}

export function reviewFlagsDialog() {
  const flags = ['flagged', 'needs_review', 'urgent', 'blocked'];
  const body = `<div style="display:flex;flex-direction:column;gap:8px">${flags.map(f => `<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="rfd-flag" value="${f}"/> ${f.replace(/_/g, ' ')}</label>`).join('')}</div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-flags-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rfdSave">Save</button>`;
  return createDialog('review-flags-dialog', 'Review Flags', body, footer) + `
  <script>
  window.rfdSave=async function(){var dlg=document.getElementById('review-flags-dialog');var id=dlg.dataset.reviewId;if(!id)return;var flags=[].slice.call(document.querySelectorAll('.rfd-flag:checked')).map(function(c){return c.value});try{var r=await fetch('/api/review/'+id,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({flags:JSON.stringify(flags)})});if(r.ok){showToast('Flags updated','success');dlg.style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function reviewTagsDialog() {
  const body = `<div class="modal-form-group"><label for="rtd-tags">Tags (comma-separated)</label><input id="rtd-tags" class="input input-bordered w-full" placeholder="e.g. priority, fy2026"/></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-tags-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rtdSave">Save</button>`;
  return createDialog('review-tags-dialog', 'Review Tags', body, footer) + `
  <script>
  window.rtdSave=async function(){var dlg=document.getElementById('review-tags-dialog');var id=dlg.dataset.reviewId;if(!id)return;var tags=document.getElementById('rtd-tags').value.split(',').map(function(t){return t.trim()}).filter(Boolean);try{var r=await fetch('/api/review/'+id,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({tags:JSON.stringify(tags)})});if(r.ok){showToast('Tags updated','success');dlg.style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function reviewValueDialog() {
  const body = `<div class="modal-form-group"><label for="rvd-value">Estimated value</label><input id="rvd-value" type="number" step="0.01" class="input input-bordered w-full" placeholder="0.00"/></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-value-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rvdSave">Save</button>`;
  return createDialog('review-value-dialog', 'Review Value', body, footer) + `
  <script>
  window.rvdSave=async function(){var dlg=document.getElementById('review-value-dialog');var id=dlg.dataset.reviewId;if(!id)return;var value=parseFloat(document.getElementById('rvd-value').value)||0;try{var r=await fetch('/api/review/'+id,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({estimated_value:value})});if(r.ok){showToast('Value updated','success');dlg.style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function reviewDeadlineDialog() {
  const body = `<div class="modal-form-group"><label for="rdd-date">Deadline</label><input id="rdd-date" type="date" class="input input-bordered w-full"/></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-deadline-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rddSave">Save</button>`;
  return createDialog('review-deadline-dialog', 'Set Deadline', body, footer) + `
  <script>
  window.rddSave=async function(){var dlg=document.getElementById('review-deadline-dialog');var id=dlg.dataset.reviewId;if(!id)return;var dateVal=document.getElementById('rdd-date').value;if(!dateVal){showToast('Pick a date','error');return}var ts=Math.floor(new Date(dateVal).getTime()/1000);try{var r=await fetch('/api/review/'+id,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({deadline:ts})});if(r.ok){showToast('Deadline updated','success');dlg.style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function reviewNotificationDialog(reviewId) {
  const body = `<div class="modal-form-group"><label for="rnd-message">Message</label><textarea id="rnd-message" class="textarea textarea-bordered w-full" rows="4" placeholder="Enter your message..."></textarea></div>`;
  const footer = `<button class="btn btn-ghost btn-sm" data-dialog-close="review-notification-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="rndSend">Send</button>`;
  return createDialog('review-notification-dialog', 'Send Notification', body, footer) + `
  <script>
  window.rndSend=async function(){var msg=document.getElementById('rnd-message').value.trim();if(!msg){showToast('Enter a message','error');return}try{var r=await fetch('/api/mwr/review/${esc(reviewId)}/notify',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});if(r.ok){showToast('Notification sent','success');document.getElementById('review-notification-dialog').style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}
