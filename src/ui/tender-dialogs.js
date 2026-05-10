import { statusLabel } from '@/ui/renderer.js';

export function tenderDetailsDialog(tenderId) {
  return `<div id="tender-detail-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true" onkeydown="if(event.key==='Escape')this.style.display='none'" role="dialog" aria-modal="true" aria-labelledby="tender-detail-dialog-title" aria-hidden="true">
    <div class="dialog-panel" style="max-width:640px">
      <div class="dialog-header"><span class="dialog-title" id="tender-detail-dialog-title">Tender Details</span><button class="dialog-close" data-dialog-close="tender-detail-dialog" aria-label="Close dialog">&times;</button></div>
      <div class="dialog-body" id="tdd-body"><div class="text-gray-500 text-center py-4">Loading...</div></div>
      <div class="dialog-footer"><button class="btn btn-ghost btn-sm" data-dialog-close="tender-detail-dialog">Close</button><a id="tdd-edit-link" href="#" class="btn btn-outline btn-sm">Edit</a></div>
    </div></div>
  <script>
  window.openTenderDetails=function(id){var tid=id||'${tenderId}';document.getElementById('tender-detail-dialog').style.display='flex';document.getElementById('tdd-edit-link').href='/tender/'+tid+'/edit';fetch('/api/tender/'+tid).then(function(r){return r.json()}).then(function(d){var t=d.data||d;var rows=[['Name',t.name||'-'],['Status',t.status||'-'],['Type',t.tender_type||'-'],['Priority',t.priority||'-'],['Client',t.client_name||t.client_id||'-'],['Due Date',t.due_date?new Date(typeof t.due_date==='number'?t.due_date*1000:t.due_date).toLocaleDateString():'-'],['Value',t.value?'R '+Number(t.value).toLocaleString():'-'],['Description',t.description||'-']];document.getElementById('tdd-body').innerHTML=rows.map(function(r){return'<div class="py-2 border-b"><span class="text-gray-500 text-sm">'+r[0]+'</span><p class="font-medium">'+r[1]+'</p></div>'}).join('')}).catch(function(){document.getElementById('tdd-body').innerHTML='<div class="text-red-500 text-center py-4">Failed to load</div>'})};
  </script>`;
}

export function tenderDetailsHolder(tenderId) {
  return `<div id="tender-holder" class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body"><h3 style="font-size:0.875rem;font-weight:600">Tender Information</h3><div id="th-content" class="mt-3"><div class="text-gray-500 text-sm">Loading...</div></div></div></div>
  <script>
  (function(){fetch('/api/tender/${tenderId}').then(function(r){return r.json()}).then(function(d){var t=d.data||d;var el=document.getElementById('th-content');el.innerHTML='<div class="grid grid-cols-2 gap-2 text-sm"><div><span class="text-gray-500">Type:</span> '+(t.tender_type||'-')+'</div><div><span class="text-gray-500">Status:</span> '+(t.status||'-')+'</div><div><span class="text-gray-500">Priority:</span> '+(t.priority||'-')+'</div><div><span class="text-gray-500">Value:</span> '+(t.value?'R '+Number(t.value).toLocaleString():'-')+'</div></div>'}).catch(function(){document.getElementById('th-content').innerHTML='<div class="text-red-500 text-sm">Error</div>'})})();
  </script>`;
}

export function tenderTypeStatusPriorityUI(tenderId) {
  return `<div class="flex gap-3 flex-wrap">
    <div class="modal-form-group"><label class="text-xs text-gray-500" for="tsp-type">Type</label><select id="tsp-type" class="select select-bordered select-sm" onchange="tspUpdate('${tenderId}')"><option value="open">Open</option><option value="closed">Closed</option><option value="selective">Selective</option><option value="negotiated">Negotiated</option></select></div>
    <div class="modal-form-group"><label class="text-xs text-gray-500" for="tsp-status">Status</label><select id="tsp-status" class="select select-bordered select-sm" onchange="tspUpdate('${tenderId}')"><option value="draft">Draft</option><option value="published">Published</option><option value="evaluation">Evaluation</option><option value="awarded">Awarded</option><option value="cancelled">Cancelled</option></select></div>
    <div class="modal-form-group"><label class="text-xs text-gray-500" for="tsp-priority">Priority</label><select id="tsp-priority" class="select select-bordered select-sm" onchange="tspUpdate('${tenderId}')"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
  </div>
  <script>
  (function(){fetch('/api/tender/${tenderId}').then(function(r){return r.json()}).then(function(d){var t=d.data||d;if(t.tender_type)document.getElementById('tsp-type').value=t.tender_type;if(t.status)document.getElementById('tsp-status').value=t.status;if(t.priority)document.getElementById('tsp-priority').value=t.priority}).catch(function(){})})();
  window.tspUpdate=async function(id){try{await fetch('/api/tender/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({tender_type:document.getElementById('tsp-type').value,status:document.getElementById('tsp-status').value,priority:document.getElementById('tsp-priority').value})});showToast('Updated','success')}catch(e){showToast('Error','error')}};
  </script>`;
}
