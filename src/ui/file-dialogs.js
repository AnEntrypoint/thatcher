import { statusLabel } from '@/ui/renderer.js';

export function zipFileCreationDialog(engagementId) {
  return `<div id="zip-create-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="zip-create-dialog-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="zip-create-dialog-title">Create Zip Archive</span><button class="dialog-close" data-dialog-close="zip-create-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div id="zcd-files" class="flex flex-col gap-2" style="max-height:300px;overflow:auto"></div><div class="flex items-center gap-2 mt-3"><label class="flex items-center gap-2 text-sm"><input type="checkbox" id="zcd-all" class="checkbox checkbox-sm" checked/><span>Select All</span></label></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="zip-create-dialog">Cancel</button><button class="btn btn-primary btn-sm" data-action="zcdCreate">Create Zip</button></div>
    </div></div>
  <script>
  window.openZipCreation=function(){document.getElementById('zip-create-dialog').style.display='flex';fetch('/api/file?engagement_id=${engagementId}').then(function(r){return r.json()}).then(function(d){var files=d.data||d||[];var el=document.getElementById('zcd-files');el.innerHTML=files.map(function(f){return'<label class="flex items-center gap-2"><input type="checkbox" class="checkbox checkbox-sm zcd-cb" value="'+f.id+'" checked/><span class="text-sm">'+(f.name||f.id)+'</span><span class="text-xs text-gray-400">'+(f.size?Math.round(f.size/1024)+'KB':'')+'</span></label>'}).join('')||'<div class="text-gray-500 text-sm">No files available</div>'}).catch(function(){})};
  document.getElementById('zcd-all').addEventListener('change',function(){document.querySelectorAll('.zcd-cb').forEach(function(c){c.checked=this.checked}.bind(this))});
  window.zcdCreate=async function(){var ids=[].slice.call(document.querySelectorAll('.zcd-cb:checked')).map(function(c){return c.value});if(!ids.length){showToast('Select files','error');return}showToast('Creating zip...','info');try{var r=await fetch('/api/file/zip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file_ids:ids,engagement_id:'${engagementId}'})});if(r.ok){var blob=await r.blob();var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='files.zip';a.click();showToast('Zip downloaded','success')}else showToast('Failed','error')}catch(e){showToast('Error','error')}document.getElementById('zip-create-dialog').style.display='none'};
  </script>`;
}
export function crossEngagementFilePicker(currentEngId) {
  return `<div id="cross-file-picker" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="cross-file-picker-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:640px"><div class="dialog-header"><span class="dialog-title" id="cross-file-picker-title">Pick File from Another Engagement</span><button class="dialog-close" data-dialog-close="cross-file-picker" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="modal-form-group"><label for="cfp-eng">Engagement</label><select id="cfp-eng" class="select select-bordered w-full" onchange="cfpLoadFiles()"></select></div><div id="cfp-files" class="flex flex-col gap-2 mt-3" style="max-height:300px;overflow:auto"></div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="cross-file-picker">Close</button></div>
    </div></div>
  <script>
  window.openCrossFilePicker=function(){document.getElementById('cross-file-picker').style.display='flex';fetch('/api/engagement').then(function(r){return r.json()}).then(function(d){var engs=d.data||d||[];var sel=document.getElementById('cfp-eng');while(sel.options.length>0)sel.remove(0);engs.filter(function(e){return e.id!=='${currentEngId}'}).forEach(function(e){var o=document.createElement('option');o.value=e.id;o.textContent=e.name||e.id;sel.appendChild(o)});if(sel.options.length)cfpLoadFiles()}).catch(function(){})};
  window.cfpLoadFiles=function(){var eid=document.getElementById('cfp-eng').value;if(!eid)return;fetch('/api/file?engagement_id='+eid).then(function(r){return r.json()}).then(function(d){var files=d.data||d||[];document.getElementById('cfp-files').innerHTML=files.map(function(f){return'<div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded"><span class="text-sm">'+(f.name||f.id)+'</span><button class="btn btn-xs btn-primary" data-action="cfpLink" data-args='["'+f.id+'"]'>Link</button></div>'}).join('')||'<div class="text-gray-500 text-sm">No files</div>'}).catch(function(){})};
  window.cfpLink=async function(fid){try{var r=await fetch('/api/file/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file_id:fid,engagement_id:'${currentEngId}'})});if(r.ok){showToast('File linked','success');document.getElementById('cross-file-picker').style.display='none'}else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function fileUploadPanel(entityType, entityId) {
  return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body"><h3 style="font-size:0.875rem;font-weight:600">Upload Files</h3><div class="mt-3"><input type="file" id="fup-files" class="file-input file-input-bordered w-full" multiple/><div class="flex justify-end mt-2"><button class="btn btn-primary btn-sm" data-action="fupUpload">Upload</button></div><div id="fup-progress" class="text-sm text-gray-500 mt-2"></div></div></div></div>
  <script>
  window.fupUpload=async function(){var files=document.getElementById('fup-files').files;if(!files.length){showToast('Select files','error');return}var prog=document.getElementById('fup-progress');var ok=0;for(var i=0;i<files.length;i++){prog.textContent='Uploading '+(i+1)+'/'+files.length;var fd=new FormData();fd.append('file',files[i]);fd.append('entity_type','${entityType}');fd.append('entity_id','${entityId}');try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok)ok++}catch(e){}}prog.textContent=ok+'/'+files.length+' uploaded';if(ok>0)showToast(ok+' files uploaded','success')};
  </script>`;
}
export function userCvUpload(userId) {
  return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body"><h3 style="font-size:0.875rem;font-weight:600">Upload CV</h3><div class="mt-3"><input type="file" id="cv-file" class="file-input file-input-bordered w-full" accept=".pdf,.doc,.docx"/><div class="flex justify-end mt-2"><button class="btn btn-primary btn-sm" data-action="cvUpload">Upload CV</button></div></div></div></div>
  <script>
  window.cvUpload=async function(){var file=document.getElementById('cv-file').files[0];if(!file){showToast('Select a file','error');return}var fd=new FormData();fd.append('file',file);fd.append('entity_type','user_cv');fd.append('entity_id','${userId}');try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok)showToast('CV uploaded','success');else showToast('Upload failed','error')}catch(e){showToast('Error','error')}};
  </script>`;
}
export function quickViewAttachment() {
  return `<div id="quick-view" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="quick-view-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:900px;max-height:90vh"><div class="dialog-header"><span class="dialog-title" id="quick-view-title">Preview</span><button class="dialog-close" data-dialog-close="quick-view" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body" style="overflow:auto;max-height:75vh"><div id="qv-content" class="text-center"><div class="text-gray-500">Loading...</div></div></div>
      <div class="dialog-footer"><a id="qv-download" href="#" download class="btn btn-primary btn-sm">Download</a><button class="btn btn-ghost btn-sm" data-dialog-close="quick-view">Close</button></div>
    </div></div>
  <script>
  window.quickView=function(url,name,type){document.getElementById('quick-view').style.display='flex';document.getElementById('quick-view-title').textContent=name||'Preview';document.getElementById('qv-download').href=url;var c=document.getElementById('qv-content');if(type&&type.startsWith('image/')){c.innerHTML='<img src="'+url+'" alt="'+(name||'File preview')+'" style="max-width:100%;max-height:70vh"/>'}else if(type==='application/pdf'){c.innerHTML='<iframe src="'+url+'" style="width:100%;height:70vh;border:none"></iframe>'}else{c.innerHTML='<div class="py-8 text-gray-500"><div style="font-size:3rem">&#128196;</div><div class="mt-2">'+name+'</div><div class="text-xs mt-1">Preview not available</div></div>'}};
  </script>`;
}
export function fetchCachedPdf(fileId) {
  return `<script>
  window.fetchCachedPdf=function(id){var cacheKey='pdf_cache_'+id;var cached=sessionStorage.getItem(cacheKey);if(cached){return Promise.resolve(cached)}return fetch('/api/file/'+(id||'${fileId}')+'/download').then(function(r){return r.blob()}).then(function(b){var url=URL.createObjectURL(b);sessionStorage.setItem(cacheKey,url);return url})};
  </script>`;
}
export function fileAttachmentBar(files = []) {
  if (!files.length) return '';
  const items = files.map(f => `<div class="flex items-center gap-2 p-1 rounded hover:bg-gray-100 cursor-pointer" data-action="quickView" data-args='["/api/file/${f.id}/download","${(f.name || '').replace(/"/g, '&quot;')}","${f.mime_type || ''}"]'><span style="font-size:1.2rem">&#128206;</span><span class="text-xs truncate" style="max-width:120px">${f.name || 'file'}</span></div>`).join('');
  return `<div class="flex flex-wrap gap-1 mt-2">${items}</div>`;
}
export function fileLinksBar(links = []) {
  if (!links.length) return '';
  const items = links.map(l => `<a href="${l.url || '#'}" target="_blank" class="flex items-center gap-1 p-1 rounded hover:bg-gray-100 text-xs text-blue-600"><span>&#128279;</span><span class="truncate" style="max-width:150px">${l.name || l.url || 'Link'}</span></a>`).join('');
  return `<div class="flex flex-wrap gap-1 mt-2">${items}</div>`;
}
export function reviewAttachmentChoiceDialog(reviewId) {
  return `<div id="rev-attach-choice" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="rev-attach-choice-title" aria-hidden="true">
    <div class="dialog-panel"><div class="dialog-header"><span class="dialog-title" id="rev-attach-choice-title">Add Attachment</span><button class="dialog-close" data-dialog-close="rev-attach-choice" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body"><div class="flex flex-col gap-3"><button class="btn btn-outline w-full text-left" data-dialog-close="rev-attach-choice" data-action="triggerUpload">&#128206; Upload New File</button><button class="btn btn-outline w-full text-left" data-dialog-close="rev-attach-choice" data-action="openCrossFilePicker">&#128279; Link Existing File</button><button class="btn btn-outline w-full text-left" data-dialog-close="rev-attach-choice" data-action="racUrl">&#127760; Add URL</button></div><input type="file" id="rac-upload" style="display:none" onchange="racUploadFile()"/></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="rev-attach-choice">Cancel</button></div>
    </div></div>
  <script>
  window.openRevAttachChoice=function(){document.getElementById('rev-attach-choice').style.display='flex'};
  window.racUploadFile=async function(){var file=document.getElementById('rac-upload').files[0];if(!file)return;var fd=new FormData();fd.append('file',file);fd.append('review_id','${reviewId}');try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok)showToast('Attached','success');else showToast('Failed','error')}catch(e){showToast('Error','error')}};
  window.racUrl=function(){var url=prompt('Enter URL:');if(!url)return;fetch('/api/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({review_id:'${reviewId}',url:url,name:url,type:'link'})}).then(function(r){if(r.ok)showToast('Link added','success');else showToast('Failed','error')}).catch(function(){showToast('Error','error')})};
  </script>`;
}
export function uploadFridayFilesCrossApp(engagementId) {
  return `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body"><h3 style="font-size:0.875rem;font-weight:600">Upload Friday Files</h3><p class="text-xs text-gray-500 mb-2">Upload files accessible from both Friday and MWR</p><input type="file" id="fxf-files" class="file-input file-input-bordered w-full" multiple/><div class="flex justify-end mt-2"><button class="btn btn-primary btn-sm" data-action="fxfUpload">Upload</button></div></div></div>
  <script>
  window.fxfUpload=async function(){var files=document.getElementById('fxf-files').files;if(!files.length){showToast('Select files','error');return}var ok=0;for(var i=0;i<files.length;i++){var fd=new FormData();fd.append('file',files[i]);fd.append('engagement_id','${engagementId}');fd.append('cross_app',true);try{var r=await fetch('/api/file/upload',{method:'POST',body:fd});if(r.ok)ok++}catch(e){}}if(ok)showToast(ok+' files uploaded','success')};
  </script>`;
}
