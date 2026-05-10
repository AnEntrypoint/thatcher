import { esc } from '@/ui/render-helpers.js';

export function reviewHighlightActionsScript(reviewId) {
  const id = esc(reviewId || '');
  return `
async function toggleFlag(highlightId,currentFlagged){
  var isFlagged=currentFlagged==='true'||currentFlagged===true;
  var flags=isFlagged?[]:['flagged'];
  try{
    var r=await fetch('/api/mwr/review/${id}/highlights/'+highlightId,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({flags:JSON.stringify(flags)})});
    if(r.ok){showToast(isFlagged?'Flag removed':'Flagged','success');setTimeout(function(){location.reload()},400)}
    else showToast('Failed','error');
  }catch(e){showToast('Error','error')}
}
async function openAddTag(highlightId){
  var tag=window.prompt('Enter tag:');
  if(!tag||!tag.trim())return;
  try{
    var r=await fetch('/api/mwr/review/${id}/highlights/'+highlightId,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({_add_tag:tag.trim()})});
    if(r.ok){showToast('Tag added','success');setTimeout(function(){location.reload()},400)}
    else showToast('Failed','error');
  }catch(e){showToast('Error','error')}
}
async function removeTag(highlightId,tag){
  try{
    var r=await fetch('/api/mwr/review/${id}/highlights/'+highlightId,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({_remove_tag:tag})});
    if(r.ok){showToast('Tag removed','success');setTimeout(function(){location.reload()},400)}
    else showToast('Failed','error');
  }catch(e){showToast('Error','error')}
}
var __flagFilterActive=false;
function filterByFlag(){
  __flagFilterActive=!__flagFilterActive;
  var btn=document.getElementById('btn-filter-flagged');
  document.querySelectorAll('tr[data-highlight-id]').forEach(function(row){
    if(__flagFilterActive){row.style.display=row.dataset.flagged==='true'?'':'none';}
    else{row.style.display='';}
  });
  if(btn){
    btn.style.background=__flagFilterActive?'#fef3c7':'';
    btn.style.borderColor=__flagFilterActive?'#f59e0b':'';
    btn.style.color=__flagFilterActive?'#92400e':'';
    btn.textContent=__flagFilterActive?'\\u2691 Flagged (filtered)':btn.textContent.replace(' (filtered)','');
  }
}
function goToSectionHighlight(sectionId){
  switchTab('highlights');
  var rows=document.querySelectorAll('tr[data-highlight-id]');
  var found=false;
  rows.forEach(function(row){
    row.style.display='';
    if(!found&&row.dataset.sectionId===sectionId){
      row.style.background='#fffbeb';
      setTimeout(function(){row.style.background='';},2000);
      row.scrollIntoView({behavior:'smooth',block:'center'});
      found=true;
    }
  });
  if(!found)showToast('No highlights in this section','info');
}`;
}
