export function engagementLetterDialog(engagementId) {
  return `<div id="eng-letter-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="eng-letter-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:640px">
      <div class="dialog-header"><span class="dialog-title" id="eng-letter-dialog-title">Engagement Letter</span><button class="dialog-close" data-dialog-close="eng-letter-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="eld-template">Template</label><select id="eld-template" class="select select-bordered w-full" onchange="eldLoadTemplate()"><option value="">Select template...</option></select></div>
        <div class="modal-form-group"><label for="eld-date">Letter Date</label><input type="date"  id="eld-date" class="input input-bordered w-full"/></div>
        <div class="modal-form-group"><label for="eld-recipient">Recipient Name</label><input id="eld-recipient" class="input input-bordered w-full" placeholder="Client contact name"/></div>
        <div class="modal-form-group"><label for="eld-content">Content</label><textarea id="eld-content" class="textarea textarea-bordered w-full" rows="8" placeholder="Letter content..."></textarea></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="eng-letter-dialog">Cancel</button><button class="btn btn-outline btn-sm" data-action="eldPreview">Preview</button><button class="btn btn-primary btn-sm" data-action="eldSave">Save Letter</button></div>
    </div></div>
  <script>
  (function(){fetch('/api/letter_template').then(function(r){return r.json()}).then(function(d){var sel=document.getElementById('eld-template');(d.data||d||[]).forEach(function(t){var o=document.createElement('option');o.value=t.id;o.textContent=t.name||t.id;sel.appendChild(o)})}).catch(function(){})})();
  window.openEngLetter=function(){document.getElementById('eng-letter-dialog').style.display='flex'};
  window.eldLoadTemplate=function(){var id=document.getElementById('eld-template').value;if(!id)return;fetch('/api/letter_template/'+id).then(function(r){return r.json()}).then(function(d){var t=d.data||d;document.getElementById('eld-content').value=t.content||t.body||''}).catch(function(){})};
  window.eldPreview=function(){var content=document.getElementById('eld-content').value;var w=window.open('','_blank','width=800,height=600');w.document.write('<html><body style="padding:2rem;font-family:serif;max-width:700px;margin:auto"><h2>Engagement Letter</h2><p>Date: '+(document.getElementById('eld-date').value||'-')+'</p><p>To: '+(document.getElementById('eld-recipient').value||'-')+'</p><hr/><div style="white-space:pre-wrap">'+content+'</div></body></html>');w.document.close()};
  window.eldSave=async function(){var body={engagement_id:'${engagementId}',template_id:document.getElementById('eld-template').value||null,date:document.getElementById('eld-date').value||null,recipient:document.getElementById('eld-recipient').value||null,content:document.getElementById('eld-content').value};try{var r=await fetch('/api/letter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){showToast('Letter saved','success');document.getElementById('eng-letter-dialog').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}

export function engagementLetterTemplateUpload() {
  return `<div id="letter-tpl-upload" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="letter-tpl-upload-title" aria-hidden="true">
    <div class="dialog-panel">
      <div class="dialog-header"><span class="dialog-title" id="letter-tpl-upload-title">Upload Letter Template</span><button class="dialog-close" data-dialog-close="letter-tpl-upload" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body">
        <div class="modal-form-group"><label for="ltu-name">Template Name</label><input id="ltu-name" class="input input-bordered w-full" placeholder="Template name"/></div>
        <div class="modal-form-group"><label for="ltu-file">Template File</label><input type="file"  id="ltu-file" class="file-input file-input-bordered w-full" accept=".docx,.doc,.html,.txt"/></div>
        <div class="modal-form-group"><label for="ltu-content">Or paste content</label><textarea id="ltu-content" class="textarea textarea-bordered w-full" rows="5" placeholder="Template content..."></textarea></div>
      </div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="letter-tpl-upload">Cancel</button><button class="btn btn-primary btn-sm" data-action="ltuSave">Save Template</button></div>
    </div></div>
  <script>
  window.openLetterTemplateUpload=function(){document.getElementById('letter-tpl-upload').style.display='flex'};
  window.ltuSave=async function(){var name=document.getElementById('ltu-name').value.trim();if(!name){showToast('Name required','error');return}var file=document.getElementById('ltu-file').files[0];var content=document.getElementById('ltu-content').value;if(file){var fd=new FormData();fd.append('file',file);fd.append('name',name);try{var r=await fetch('/api/letter_template/upload',{method:'POST',body:fd});if(r.ok){showToast('Template uploaded','success');document.getElementById('letter-tpl-upload').style.display='none';location.reload()}else showToast('Upload failed','error')}catch(e){showToast('Error','error')}}else if(content){try{var r=await fetch('/api/letter_template',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,content:content})});if(r.ok){showToast('Template saved','success');document.getElementById('letter-tpl-upload').style.display='none';location.reload()}else showToast('Failed','error')}catch(e){showToast('Error','error')}}else{showToast('Provide file or content','error')}};
  </script>`;
}
