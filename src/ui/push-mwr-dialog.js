export function pushToMwrDialog(engagementId) {
  return `<div id="push-mwr-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="push-mwr-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="push-mwr-dialog-title">Push to MWR</span><button class="dialog-close" data-dialog-close="push-mwr-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <p class="text-sm text-gray-500 mb-3">Push this engagement's review data to MyWorkReview for collaborative review.</p>
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2"><input type="checkbox" class="checkbox pmwr-opt" value="highlights" checked/><span class="text-sm">Include highlights</span></label>
          <label class="flex items-center gap-2"><input type="checkbox" class="checkbox pmwr-opt" value="comments" checked/><span class="text-sm">Include comments</span></label>
          <label class="flex items-center gap-2"><input type="checkbox" class="checkbox pmwr-opt" value="attachments"/><span class="text-sm">Include attachments</span></label>
          <label class="flex items-center gap-2"><input type="checkbox" class="checkbox pmwr-opt" value="checklists" checked/><span class="text-sm">Include checklists</span></label>
        </div>
        <div class="modal-form-group mt-3"><label for="pmwr-review">Target Review</label><select id="pmwr-review" class="select select-bordered w-full"><option value="new">Create New Review</option></select></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="push-mwr-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="pmwrPush">Push to MWR</button></div>
    </div></div>
  <script>
  window.openPushToMwr=function(){document.getElementById('push-mwr-dialog').style.display='flex';fetch('/api/review?engagement_id=${engagementId}').then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('pmwr-review');var reviews=d.data||d||[];reviews.forEach(function(r){var o=document.createElement('option');o.value=r.id;o.textContent=r.name||r.title||r.id;sel.appendChild(o)})}).catch(function(){})};
  window.pmwrPush=async function(){var opts=[].slice.call(document.querySelectorAll('.pmwr-opt:checked')).map(function(c){return c.value});var reviewId=document.getElementById('pmwr-review').value;showToast('Pushing to MWR...','info');try{var r=await fetch('/api/mwr/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({engagement_id:'${engagementId}',review_id:reviewId==='new'?null:reviewId,include:opts})});if(r.ok){showToast('Pushed to MWR','success');document.getElementById('push-mwr-dialog').style.display='none'}else showToast('Push failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function engagementChecklistPush(engagementId) {
  return `<div id="checklist-push-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="checklist-push-dialog-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="checklist-push-dialog-title">Push Checklist to Engagement</span><button class="dialog-close" data-dialog-close="checklist-push-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="cpd-source">Source Checklist</label><select id="cpd-source" class="select select-bordered w-full"></select></div>
        <div class="modal-form-group"><label for="cpd-target">Target Engagement</label><select id="cpd-target" class="select select-bordered w-full"></select></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="checklist-push-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="cpdPush">Push</button></div>
    </div></div>
  <script>
  window.openChecklistPush=function(){document.getElementById('checklist-push-dialog').style.display='flex';fetch('/api/checklist?engagement_id=${engagementId}').then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('cpd-source');while(sel.options.length)sel.remove(0);(d.data||d||[]).forEach(function(c){var o=document.createElement('option');o.value=c.id;o.textContent=c.name||c.id;sel.appendChild(o)})}).catch(function(){});fetch('/api/engagement').then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('cpd-target');while(sel.options.length)sel.remove(0);(d.data||d||[]).filter(function(e){return e.id!=='${engagementId}'}).forEach(function(e){var o=document.createElement('option');o.value=e.id;o.textContent=e.name||e.id;sel.appendChild(o)})}).catch(function(){})};
  window.cpdPush=async function(){var src=document.getElementById('cpd-source').value;var tgt=document.getElementById('cpd-target').value;if(!src||!tgt){showToast('Select both','error');return}try{var r=await fetch('/api/checklist/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checklist_id:src,source_engagement_id:'${engagementId}',target_engagement_id:tgt})});if(r.ok){showToast('Checklist pushed','success');document.getElementById('checklist-push-dialog').style.display='none'}else showToast('Push failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
