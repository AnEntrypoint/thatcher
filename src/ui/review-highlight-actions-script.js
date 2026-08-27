// Client-side actions for the highlight table row actions rendered by
// review/detail-panels.js's highlightRow(): flag toggle, tag add/remove,
// and the flagged-filter toolbar button in review/detail-renderer.js.
export function reviewHighlightActionsScript(reviewId) {
  const id = String(reviewId || '');
  return `
window.toggleFlag=async function(highlightId,wasFlagged){var on=wasFlagged==='true'||wasFlagged===true;try{var r=await fetch('/api/mwr/review/${id}/highlights/'+highlightId,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({flag:!on})});if(r.ok){showToast(on?'Unflagged':'Flagged','success');setTimeout(function(){location.reload()},400)}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
window.openAddTag=function(highlightId){var tag=window.prompt('Add tag:');if(!tag||!tag.trim())return;fetch('/api/mwr/review/${id}/highlights/'+highlightId,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({add_tag:tag.trim()})}).then(function(r){if(r.ok){showToast('Tag added','success');setTimeout(function(){location.reload()},400)}else showToast('Failed','error')}).catch(function(e){showToast('Error: '+e.message,'error')})};
window.removeTag=async function(highlightId,tag){try{var r=await fetch('/api/mwr/review/${id}/highlights/'+highlightId,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({remove_tag:tag})});if(r.ok){showToast('Tag removed','success');setTimeout(function(){location.reload()},400)}else showToast('Failed','error')}catch(e){showToast('Error: '+e.message,'error')}};
window.filterByFlag=function(){var btn=document.getElementById('btn-filter-flagged');var active=btn&&btn.classList.contains('is-active');document.querySelectorAll('#rvpanel-highlights tbody tr[data-flagged]').forEach(function(row){if(active){row.style.display=''}else{row.style.display=row.dataset.flagged==='true'?'':'none'}});if(btn)btn.classList.toggle('is-active',!active)};
`;
}
