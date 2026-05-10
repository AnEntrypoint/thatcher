import { statusLabel } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { canEdit } from '@/ui/permissions-ui.js';
import { fmtDate } from '@/ui/render-helpers.js';

function reviewCheckRow(review) {
  const sts = review.status ? statusLabel(review.status) : '';
  const highlights = review.highlights_count !== undefined ? review.highlights_count : '-';
  return `<tr data-review-id="${review.id}" data-status="${review.status || ''}"><td><input type="checkbox" class="checkbox checkbox-sm review-check" value="${review.id}" onchange="updateSelection()"/></td><td class="font-medium">${review.name || review.title || 'Untitled'}</td><td>${review.engagement_name || '-'}</td><td>${sts}</td><td>${highlights}</td><td>${review.creator_name || '-'}</td><td class="text-xs text-gray-500">${fmtDate(review.created_at)}</td></tr>`;
}

export function renderBatchOperations(user, reviews) {
  const canEditReview = canEdit(user, 'review');
  if (!canEditReview) {
    const denied = `<div class="text-center py-12"><h1 class="text-xl font-bold mb-2">Access Denied</h1><p class="text-gray-500">You need edit permissions for batch operations.</p><a href="/reviews" class="btn btn-primary btn-sm mt-4">Back to Reviews</a></div>`;
    return page(user, 'Batch Operations | Moonlanding', null, denied);
  }

  const statusOptions = ['active', 'completed', 'archived', 'draft', 'closed'].map(s =>
    `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
  ).join('');

  const actionBar = `<div class="card-clean" style="margin-bottom:1rem"><div class="card-clean-body" style="padding:0.75rem 0"><div class="flex items-center gap-3 flex-wrap"><div class="flex items-center gap-2"><input type="checkbox" id="select-all" class="checkbox checkbox-sm" onchange="toggleAll()"/><span class="text-sm font-medium">Select All</span><span class="text-sm text-gray-500" id="selection-count">(0 selected)</span></div><div class="flex gap-2 ml-auto"><select id="batch-status" class="select select-bordered select-sm"><option value="">Change Status...</option>${statusOptions}</select><button class="btn btn-sm btn-primary" data-action="batchUpdateStatus" id="btn-status" disabled>Apply Status</button><button class="btn btn-sm btn-outline" data-action="batchAssign" id="btn-assign" disabled>Assign</button><button class="btn btn-sm btn-error btn-outline" data-action="batchArchive" id="btn-archive" disabled>Archive</button><button class="btn btn-sm btn-error" data-action="batchDelete" id="btn-delete" disabled>Delete</button></div></div></div></div>`;

  const headers = '<th class="w-10"></th><th>Name</th><th>Engagement</th><th>Status</th><th>Highlights</th><th>Creator</th><th>Created</th>';
  const rows = reviews.map(r => reviewCheckRow(r)).join('');
  const table = `<div class="card-clean" style="overflow-x:auto"><table class="data-table"><thead><tr>${headers}</tr></thead><tbody id="batch-tbody">${rows || '<tr><td colspan="7" class="text-center py-8 text-gray-500">No reviews found</td></tr>'}</tbody></table></div>`;

  const filterBar = `<div class="flex gap-2 mb-4"><label for="batch-search" class="sr-only">Filter reviews</label><input type="text" id="batch-search" placeholder="Filter reviews..." class="input input-bordered input-sm" style="width:250px" aria-label="Filter reviews"/><label for="batch-filter-status" class="sr-only">Filter by status</label><select id="batch-filter-status" class="select select-bordered select-sm" onchange="filterBatch()" aria-label="Filter by status"><option value="">All Statuses</option>${statusOptions}</select></div>`;

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Batch Operations</h1><a href="/reviews" class="btn btn-ghost btn-sm">Back to Reviews</a></div>${actionBar}${filterBar}${table}`;

  const batchScript = `function getSelected(){return[...document.querySelectorAll('.review-check:checked')].map(c=>c.value)}function updateSelection(){const n=getSelected().length;document.getElementById('selection-count').textContent='('+n+' selected)';const dis=n===0;document.getElementById('btn-status').disabled=dis;document.getElementById('btn-assign').disabled=dis;document.getElementById('btn-archive').disabled=dis;document.getElementById('btn-delete').disabled=dis}window.toggleAll=function(){const checked=document.getElementById('select-all').checked;document.querySelectorAll('.review-check').forEach(c=>{if(c.closest('tr').style.display!=='none')c.checked=checked});updateSelection()};window.batchUpdateStatus=async function(){const ids=getSelected();const status=document.getElementById('batch-status')?.value;if(!ids.length||!status)return alert('Select reviews and a status');if(!confirm('Update '+ids.length+' reviews to '+status+'?'))return;try{const r=await fetch('/api/review/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_status',ids,status})});if(r.ok){location.reload()}else{alert('Failed')}}catch(e){alert(e.message)}};window.batchArchive=async function(){const ids=getSelected();if(!ids.length)return;if(!confirm('Archive '+ids.length+' reviews?'))return;try{const r=await fetch('/api/review/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_status',ids,status:'archived'})});if(r.ok)location.reload();else alert('Failed')}catch(e){alert(e.message)}};window.batchDelete=async function(){const ids=getSelected();if(!ids.length)return;if(!confirm('DELETE '+ids.length+' reviews? This cannot be undone!'))return;try{const r=await fetch('/api/review/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',ids})});if(r.ok)location.reload();else alert('Failed')}catch(e){alert(e.message)}};window.batchAssign=function(){alert('Assignment dialog would open here for '+getSelected().length+' reviews')};window.filterBatch=function(){const q=(document.getElementById('batch-search')?.value||'').toLowerCase();const s=document.getElementById('batch-filter-status')?.value||'';document.querySelectorAll('#batch-tbody tr[data-review-id]').forEach(r=>{let show=true;if(q&&!r.textContent.toLowerCase().includes(q))show=false;if(s&&r.dataset.status!==s)show=false;r.style.display=show?'':'none'})};document.getElementById('batch-search')?.addEventListener('input',()=>{clearTimeout(window._bst);window._bst=setTimeout(filterBatch,300)})`;

  return page(user, 'Batch Operations | Moonlanding', [{ href: '/', label: 'Dashboard' }, { href: '/reviews', label: 'Reviews' }, { label: 'Batch' }], content, [batchScript]);
}
