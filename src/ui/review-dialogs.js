const TOAST_SCRIPT_INLINE = `if(!window.showToast)window.showToast=(m,t='info')=>{let c=document.getElementById('toast-container');if(!c){c=document.createElement('div');c.id='toast-container';c.className='toast-container';document.body.appendChild(c)}const d=document.createElement('div');d.className='toast toast-'+t;d.textContent=m;c.appendChild(d);setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300)},3000)};`;

export function reviewCreateDialog() {
  return `<div id="review-create-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-create-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-create-dialog-title">Create Review</span><button class="dialog-close" data-dialog-close="review-create-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rcd-name">Review Name</label><input type="text" id="rcd-name" class="input input-bordered w-full" placeholder="Enter review name" required aria-required="true"/></div>
        <div class="modal-form-group"><label for="rcd-engagement">Engagement</label><select id="rcd-engagement" class="select select-bordered w-full"><option value="">Select engagement...</option></select></div>
        <div class="modal-form-group"><label for="rcd-template">Template</label><select id="rcd-template" class="select select-bordered w-full"><option value="">No template</option></select></div>
        <div class="modal-form-group"><label for="rcd-desc">Description</label><textarea id="rcd-desc" class="textarea textarea-bordered w-full" rows="3" placeholder="Optional description"></textarea></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" data-dialog-close="review-create-dialog">Cancel</button>
        <button class="btn btn-primary btn-sm" data-action="submitCreateReview">Create</button>
      </div>
    </div>
  </div>
  <script>${TOAST_SCRIPT_INLINE}
  (function(){
    fetch('/api/engagement').then(r=>r.json()).then(d=>{var s=document.getElementById('rcd-engagement');(d.data||d||[]).forEach(function(e){var o=document.createElement('option');o.value=e.id;o.textContent=e.name||e.title||e.id;s.appendChild(o)})}).catch(function(){});
    fetch('/api/review_template').then(r=>r.json()).then(d=>{var s=document.getElementById('rcd-template');(d.data||d||[]).forEach(function(t){var o=document.createElement('option');o.value=t.id;o.textContent=t.name||t.id;s.appendChild(o)})}).catch(function(){});
  })();
  window.submitCreateReview=async function(){var name=document.getElementById('rcd-name').value.trim();if(!name){showToast('Name is required','error');return}var body={name:name,engagement_id:document.getElementById('rcd-engagement').value||undefined,review_template_id:document.getElementById('rcd-template').value||undefined,description:document.getElementById('rcd-desc').value.trim()||undefined,status:'active'};try{var res=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var data=await res.json();if(res.ok){showToast('Review created','success');var id=(data.data||data).id;setTimeout(function(){window.location='/review/'+id},500)}else{showToast(data.error||data.message||'Create failed','error')}}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function reviewTemplateChoiceDialog() {
  return `<div id="review-template-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-template-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-template-dialog-title">Choose Template</span><button class="dialog-close" data-dialog-close="review-template-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div id="rtd-list" class="flex flex-col gap-2"><div class="text-gray-500 text-sm text-center py-4">Loading templates...</div></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" data-dialog-close="review-template-dialog">Cancel</button>
        <button class="btn btn-outline btn-sm" data-action="rtdCancel" data-dialog-close="review-template-dialog">No Template</button>
      </div>
    </div>
  </div>
  <script>
  window.showTemplateChoice=function(cb){window.rtdCallback=cb;document.getElementById('review-template-dialog').style.display='flex';fetch('/api/review_template').then(r=>r.json()).then(d=>{var list=document.getElementById('rtd-list');list.innerHTML='';(d.data||d||[]).forEach(function(t){var div=document.createElement('div');div.className='choice-option';div.style.cursor='pointer';div.innerHTML='<span class="choice-label">'+( t.name||t.id)+'</span>';div.onclick=function(){cb&&cb(t);document.getElementById('review-template-dialog').style.display='none'};list.appendChild(div)});if(!list.children.length)list.innerHTML='<div class="text-gray-500 text-sm text-center py-4">No templates available</div>'}).catch(function(){})};
  </script>`;
}

export function reviewContextMenu() {
  return `<div id="review-ctx-menu" class="review-ctx-menu" style="display:none" role="menu" aria-label="Review actions" onkeydown="if(event.key==='Escape'){this.style.display='none'}">
    <div class="ctx-item" role="menuitem" tabindex="0" data-action="ctxAction" data-args='["view"]' onkeydown="if(event.key==='Enter')ctxAction('view')">View</div>
    <div class="ctx-item" role="menuitem" tabindex="0" data-action="ctxAction" data-args='["edit"]' onkeydown="if(event.key==='Enter')ctxAction('edit')">Edit</div>
    <div class="ctx-item" role="menuitem" tabindex="0" data-action="ctxAction" data-args='["duplicate"]' onkeydown="if(event.key==='Enter')ctxAction('duplicate')">Duplicate</div>
    <div class="ctx-sep" role="separator"></div>
    <div class="ctx-item" role="menuitem" tabindex="0" data-action="ctxAction" data-args='["archive"]' onkeydown="if(event.key==='Enter')ctxAction('archive')">Archive</div>
    <div class="ctx-item" role="menuitem" tabindex="0" data-action="ctxAction" data-args='["export"]' onkeydown="if(event.key==='Enter')ctxAction('export')">Export PDF</div>
    <div class="ctx-sep" role="separator"></div>
    <div class="ctx-item ctx-danger" role="menuitem" tabindex="0" data-action="ctxAction" data-args='["delete"]' onkeydown="if(event.key==='Enter')ctxAction('delete')">Delete</div>
  </div>`;
}

export function reviewFlagsDialog() {
  return `<div id="review-flags-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-flags-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-flags-dialog-title">Review Flags</span><button class="dialog-close" data-dialog-close="review-flags-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div id="rfd-flags" class="flex flex-col gap-2"></div>
        <div class="inline-form" style="margin-top:1rem">
          <div class="inline-form-row">
            <div class="inline-form-field" style="flex:1"><label for="rfd-new">Add Flag</label><input type="text"  id="rfd-new" class="input input-bordered input-sm w-full" placeholder="Flag description"/></div>
            <div class="inline-form-field"><label>&nbsp;</label><button class="btn btn-primary btn-sm" data-action="addReviewFlag">Add</button></div>
          </div>
        </div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="review-flags-dialog">Close</button></div>
    </div>
  </div>
  <script>${TOAST_SCRIPT_INLINE}
  window.showFlagsDialog=function(reviewId,flags){window._rfdReviewId=reviewId;document.getElementById('review-flags-dialog').style.display='flex';var c=document.getElementById('rfd-flags');c.innerHTML='';(flags||[]).forEach(function(f,i){var d=document.createElement('div');d.className='flex items-center justify-between gap-2';d.style.padding='0.5rem 0';d.style.borderBottom='1px solid #f3f4f6';d.innerHTML='<span class="text-sm">'+f+'</span><button class="btn btn-xs btn-error btn-outline" data-action="removeReviewFlag" data-args='["+i+"]'>Remove</button>';c.appendChild(d)});if(!flags||!flags.length)c.innerHTML='<div class="text-gray-500 text-sm text-center py-2">No flags</div>'};
  window._rfdFlags=[];
  window.addReviewFlag=async function(){var inp=document.getElementById('rfd-new');var v=inp.value.trim();if(!v)return;try{var res=await fetch('/api/review/'+window._rfdReviewId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({flags:JSON.stringify([...(window._rfdFlags||[]),v])})});if(res.ok){showToast('Flag added','success');inp.value='';setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}};
  window.removeReviewFlag=async function(idx){var f=(window._rfdFlags||[]).filter(function(_,i){return i!==idx});try{var res=await fetch('/api/review/'+window._rfdReviewId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({flags:JSON.stringify(f)})});if(res.ok){showToast('Flag removed','success');setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error: '+e.message,'error')}};
  </script>`;
}

export function reviewTagsDialog() {
  return `<div id="review-tags-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-tags-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-tags-dialog-title">Review Tags</span><button class="dialog-close" data-dialog-close="review-tags-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div id="rtags-list" class="ts-badges"></div>
        <div class="inline-form" style="margin-top:0.75rem">
          <div class="inline-form-row">
            <div class="inline-form-field" style="flex:1"><label for="rtags-new">Add Tag</label><input type="text"  id="rtags-new" class="input input-bordered input-sm w-full" placeholder="Tag name"/></div>
            <div class="inline-form-field"><label>&nbsp;</label><button class="btn btn-primary btn-sm" data-action="addReviewTag">Add</button></div>
          </div>
        </div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="review-tags-dialog">Close</button></div>
    </div>
  </div>
  <script>${TOAST_SCRIPT_INLINE}
  window._rtagsId=null;window._rtagsList=[];
  window.showTagsDialog=function(reviewId,tags){window._rtagsId=reviewId;window._rtagsList=tags||[];document.getElementById('review-tags-dialog').style.display='flex';renderTags()};
  function renderTags(){var c=document.getElementById('rtags-list');c.innerHTML='';window._rtagsList.forEach(function(t,i){c.innerHTML+='<span class="ts-badge">'+t+' <span class="ts-badge-x" data-action="removeReviewTag" data-args='["+i+"]'>&times;</span></span>'});if(!window._rtagsList.length)c.innerHTML='<span class="text-xs text-gray-500">No tags</span>'}
  window.addReviewTag=async function(){var v=document.getElementById('rtags-new').value.trim();if(!v)return;window._rtagsList.push(v);try{await fetch('/api/review/'+window._rtagsId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({tags:JSON.stringify(window._rtagsList)})});showToast('Tag added','success');document.getElementById('rtags-new').value='';renderTags()}catch(e){showToast('Error','error')}};
  window.removeReviewTag=async function(idx){window._rtagsList.splice(idx,1);try{await fetch('/api/review/'+window._rtagsId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({tags:JSON.stringify(window._rtagsList)})});showToast('Tag removed','success');renderTags()}catch(e){showToast('Error','error')}};
  </script>`;
}

export function reviewValueDialog() {
  return `<div id="review-value-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-value-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-value-dialog-title">WIP Value</span><button class="dialog-close" data-dialog-close="review-value-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rvd-value">Current WIP Value</label><input type="number"  id="rvd-value" class="input input-bordered w-full" step="0.01" min="0" placeholder="0.00"/></div>
        <div class="modal-form-group"><label for="rvd-currency">Currency</label><select id="rvd-currency" class="select select-bordered w-full"><option value="ZAR">ZAR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div>
        <div class="modal-form-group"><label for="rvd-notes">Notes</label><textarea id="rvd-notes" class="textarea textarea-bordered w-full" rows="2" placeholder="Optional notes"></textarea></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" data-dialog-close="review-value-dialog">Cancel</button>
        <button class="btn btn-primary btn-sm" data-action="saveWipValue">Save</button>
      </div>
    </div>
  </div>
  <script>${TOAST_SCRIPT_INLINE}
  window._rvdId=null;
  window.showValueDialog=function(reviewId,val,currency){window._rvdId=reviewId;document.getElementById('review-value-dialog').style.display='flex';document.getElementById('rvd-value').value=val||'';if(currency)document.getElementById('rvd-currency').value=currency};
  window.saveWipValue=async function(){var v=document.getElementById('rvd-value').value;var c=document.getElementById('rvd-currency').value;var n=document.getElementById('rvd-notes').value;try{var res=await fetch('/api/review/'+window._rvdId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({wip_value:Number(v)||0,currency:c,wip_notes:n})});if(res.ok){showToast('WIP value saved','success');document.getElementById('review-value-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast('Save failed','error')}}catch(e){showToast('Error','error')}};
  </script>`;
}

export function reviewDeadlineDialog() {
  return `<div id="review-deadline-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-deadline-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-deadline-dialog-title">Set Deadline</span><button class="dialog-close" data-dialog-close="review-deadline-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="rdd-date">Deadline Date</label><input type="date"  id="rdd-date" class="input input-bordered w-full"/></div>
        <div class="date-presets">
          <button class="date-preset-btn" data-action="setDeadlinePreset" data-args='[7]'>+1 Week</button>
          <button class="date-preset-btn" data-action="setDeadlinePreset" data-args='[14]'>+2 Weeks</button>
          <button class="date-preset-btn" data-action="setDeadlinePreset" data-args='[30]'>+1 Month</button>
          <button class="date-preset-btn" data-action="setDeadlinePreset" data-args='[90]'>+3 Months</button>
        </div>
        <div class="modal-form-group" style="margin-top:1rem"><label for="rdd-reminder">Reminder</label><select id="rdd-reminder" class="select select-bordered w-full"><option value="">No reminder</option><option value="1">1 day before</option><option value="3">3 days before</option><option value="7">1 week before</option></select></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" data-dialog-close="review-deadline-dialog">Cancel</button>
        <button class="btn btn-error btn-outline btn-sm" data-action="clearDeadline">Clear</button>
        <button class="btn btn-primary btn-sm" data-action="saveDeadline">Save</button>
      </div>
    </div>
  </div>
  <script>${TOAST_SCRIPT_INLINE}
  window._rddId=null;
  window.showDeadlineDialog=function(reviewId,deadline){window._rddId=reviewId;document.getElementById('review-deadline-dialog').style.display='flex';if(deadline){var d=typeof deadline==='number'?new Date(deadline*1000):new Date(deadline);document.getElementById('rdd-date').value=d.toISOString().split('T')[0]}else{document.getElementById('rdd-date').value=''}};
  window.setDeadlinePreset=function(days){var d=new Date();d.setDate(d.getDate()+days);document.getElementById('rdd-date').value=d.toISOString().split('T')[0]};
  window.saveDeadline=async function(){var v=document.getElementById('rdd-date').value;if(!v){showToast('Select a date','error');return}var ts=Math.floor(new Date(v).getTime()/1000);try{var res=await fetch('/api/review/'+window._rddId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({deadline:ts})});if(res.ok){showToast('Deadline saved','success');document.getElementById('review-deadline-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};
  window.clearDeadline=async function(){try{var res=await fetch('/api/review/'+window._rddId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({deadline:null})});if(res.ok){showToast('Deadline cleared','success');document.getElementById('review-deadline-dialog').style.display='none';setTimeout(function(){location.reload()},500)}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};
  </script>`;
}

export function reviewNotificationDialog() {
  return `<div id="review-notif-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="review-notif-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="review-notif-dialog-title">Notification Settings</span><button class="dialog-close" data-dialog-close="review-notif-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="toggle-wrap"><div><div class="toggle-label">Highlight Updates</div><div class="toggle-desc">Notify when highlights are added or resolved</div></div><label class="toggle-switch"><input type="checkbox" id="rnd-highlights" checked aria-label="Highlight Updates"/><span class="toggle-slider"></span></label></div>
        <div class="toggle-wrap"><div><div class="toggle-label">Comment Notifications</div><div class="toggle-desc">Notify on new comments</div></div><label class="toggle-switch"><input type="checkbox" id="rnd-comments" checked aria-label="Comment Notifications"/><span class="toggle-slider"></span></label></div>
        <div class="toggle-wrap"><div><div class="toggle-label">Status Changes</div><div class="toggle-desc">Notify when review status changes</div></div><label class="toggle-switch"><input type="checkbox" id="rnd-status" checked aria-label="Status Changes"/><span class="toggle-slider"></span></label></div>
        <div class="toggle-wrap"><div><div class="toggle-label">Deadline Reminders</div><div class="toggle-desc">Remind before deadline expires</div></div><label class="toggle-switch"><input type="checkbox" id="rnd-deadline" checked aria-label="Deadline Reminders"/><span class="toggle-slider"></span></label></div>
        <div class="toggle-wrap"><div><div class="toggle-label">Collaborator Activity</div><div class="toggle-desc">Notify when collaborators make changes</div></div><label class="toggle-switch"><input type="checkbox" id="rnd-collab" aria-label="Collaborator Activity"/><span class="toggle-slider"></span></label></div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" data-dialog-close="review-notif-dialog">Cancel</button>
        <button class="btn btn-primary btn-sm" data-action="saveNotifSettings">Save</button>
      </div>
    </div>
  </div>
  <script>${TOAST_SCRIPT_INLINE}
  window._rndId=null;
  window.showNotifDialog=function(reviewId,settings){window._rndId=reviewId;document.getElementById('review-notif-dialog').style.display='flex';var s=settings||{};document.getElementById('rnd-highlights').checked=s.highlights!==false;document.getElementById('rnd-comments').checked=s.comments!==false;document.getElementById('rnd-status').checked=s.status!==false;document.getElementById('rnd-deadline').checked=s.deadline!==false;document.getElementById('rnd-collab').checked=!!s.collaborator};
  window.saveNotifSettings=async function(){var s={highlights:document.getElementById('rnd-highlights').checked,comments:document.getElementById('rnd-comments').checked,status:document.getElementById('rnd-status').checked,deadline:document.getElementById('rnd-deadline').checked,collaborator:document.getElementById('rnd-collab').checked};try{var res=await fetch('/api/review/'+window._rndId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({notification_settings:JSON.stringify(s)})});if(res.ok){showToast('Notification settings saved','success');document.getElementById('review-notif-dialog').style.display='none'}else{showToast('Failed','error')}}catch(e){showToast('Error','error')}};
  </script>`;
}
