import { h } from '@/ui/webjsx.js'
import { TOAST_SCRIPT } from '@/ui/render-helpers.js'

export function dataGridAdvanced(config) {
  const { columns = [], data = [], groupBy = null, sortable = true, filterable = true, expandable = false, detailRenderer = null } = config
  const gridId = 'dg-' + Math.random().toString(36).slice(2, 8)
  const colHeaders = columns.map((col, i) => {
    const sortAttr = sortable ? ` data-dg-sort="${col.field}" data-action="dgSort" data-args='["${gridId}","${col.field}","${i},event"]'` : ''
    const filterHtml = filterable ? `<div class="dg-filter"><input type="text" data-dg-filter="${col.field}" placeholder="Filter..." class="dg-filter-input" aria-label="Filter ${col.label || col.field}" oninput="dgFilter('${gridId}')"/></div>` : ''
    return `<th${sortAttr} class="${sortable ? 'dg-sortable' : ''}">${col.label || col.field}<span class="dg-sort-indicator" data-dg-indicator="${col.field}"></span>${filterHtml}</th>`
  }).join('')
  const expandCol = expandable ? '<th class="dg-expand-col"></th>' : ''
  const renderRow = (item, rowId, groupId) => {
    const memberAttr = groupId ? ` data-dg-member="${groupId}"` : ''
    const expandBtn = expandable ? `<td class="dg-expand-col"><button class="dg-expand-btn" data-dg-row="${rowId}" data-action="dgToggleDetail" data-args='["${gridId}"]' data-self aria-label="Expand row details" aria-expanded="false">&#9654;</button></td>` : ''
    const cells = columns.map(col => `<td>${item[col.field] ?? '-'}</td>`).join('')
    const detailRow = expandable ? `<tr class="dg-detail-row"${memberAttr} data-dg-detail="${rowId}" style="display:none"><td colspan="${columns.length + 1}"><div class="dg-detail-panel">${detailRenderer ? detailRenderer(item) : ''}</div></td></tr>` : ''
    return `<tr class="dg-data-row"${memberAttr} data-dg-values='${JSON.stringify(columns.map(c => String(item[c.field] ?? '')))}'>${expandBtn}${cells}</tr>${detailRow}`
  }
  let bodyHtml = ''
  if (groupBy) {
    const groups = {}
    data.forEach(item => { const key = String(item[groupBy] ?? 'Ungrouped'); if (!groups[key]) groups[key] = []; groups[key].push(item) })
    bodyHtml = Object.entries(groups).map(([key, items]) => {
      const gid = `${gridId}-g-${key.replace(/\W/g, '_')}`
      const rows = items.map((item, i) => renderRow(item, `${gid}-r${i}`, gid)).join('')
      return `<tr class="dg-group-header" data-dg-group="${gid}" tabindex="0" data-action="dgToggleGroup" data-args='["${gid}"]' onkeydown="if(event.key==='Enter')dgToggleGroup('${gid}')"><td colspan="${columns.length + (expandable ? 1 : 0)}"><span class="dg-group-arrow">&#9660;</span> <strong>${key}</strong> <span class="dg-group-count">(${items.length})</span></td></tr>${rows}`
    }).join('')
  } else {
    bodyHtml = data.map((item, i) => renderRow(item, `${gridId}-r${i}`, null)).join('')
  }
  const script = `(function(){var sorts={};window.dgSort=function(gid,field,ci,evt){if(!sorts[gid])sorts[gid]=[];if(!evt.shiftKey)sorts[gid]=[];var ex=sorts[gid].find(function(s){return s.field===field});if(ex){ex.dir=ex.dir==='asc'?'desc':'asc'}else{sorts[gid].push({field:field,col:ci,dir:'asc'})}var t=document.getElementById(gid);t.querySelectorAll('[data-dg-indicator]').forEach(function(el){el.textContent=''});sorts[gid].forEach(function(s){var ind=t.querySelector('[data-dg-indicator="'+s.field+'"]');if(ind)ind.textContent=s.dir==='asc'?' \\u25B2':' \\u25BC'});var rows=Array.from(t.querySelectorAll('.dg-data-row'));var tb=t.querySelector('tbody');rows.sort(function(a,b){var va=JSON.parse(a.dataset.dgValues);var vb=JSON.parse(b.dataset.dgValues);for(var i=0;i<sorts[gid].length;i++){var s=sorts[gid][i];var cmp=va[s.col].localeCompare(vb[s.col],undefined,{numeric:true});if(cmp!==0)return s.dir==='asc'?cmp:-cmp}return 0});rows.forEach(function(r){var d=t.querySelector('[data-dg-detail="'+r.querySelector('.dg-expand-btn')?.dataset?.dgRow+'"]');tb.appendChild(r);if(d)tb.appendChild(d)})};window.dgFilter=function(gid){var t=document.getElementById(gid);var fs=Array.from(t.querySelectorAll('[data-dg-filter]'));var vals=fs.map(function(f){return f.value.toLowerCase()});t.querySelectorAll('.dg-data-row').forEach(function(r){var d=JSON.parse(r.dataset.dgValues||'[]');var show=vals.every(function(v,i){return !v||d[i].toLowerCase().indexOf(v)!==-1});r.style.display=show?'':'none';var det=t.querySelector('[data-dg-detail="'+(r.querySelector('.dg-expand-btn')||{}).dataset?.dgRow+'"]');if(det&&!show)det.style.display='none'})};window.dgToggleGroup=function(gid){var ms=document.querySelectorAll('[data-dg-member="'+gid+'"]');var h=document.querySelector('[data-dg-group="'+gid+'"]');var a=h.querySelector('.dg-group-arrow');var hidden=ms[0]&&ms[0].style.display==='none';ms.forEach(function(m){m.style.display=hidden?'':'none'});a.textContent=hidden?'\\u25BC':'\\u25B6'};window.dgToggleDetail=function(gid,btn){var rid=btn.dataset.dgRow;var det=document.querySelector('[data-dg-detail="'+rid+'"]');if(!det)return;var shown=det.style.display!=='none';det.style.display=shown?'none':'';btn.textContent=shown?'\\u25B6':'\\u25BC';btn.classList.toggle('dg-expand-open',!shown)}})();`
  return `<div class="dg-wrapper"><table id="${gridId}" class="dg-table"><thead><tr>${expandCol}${colHeaders}</tr></thead><tbody>${bodyHtml}</tbody></table></div><script>${script}</script>`
}

export function collapsibleSidebar(sections, currentPath) {
  const sidebarId = 'sidebar-' + Math.random().toString(36).slice(2, 8)
  const sectionHtml = sections.map(section => {
    const links = (section.items || []).map(item => {
      const active = currentPath === item.href
      return `<a href="${item.href}" class="sidebar-link${active ? ' sidebar-link-active' : ''}">${item.label}</a>`
    }).join('')
    return `<div class="sidebar-section"><div class="sidebar-section-header" data-action="sidebarToggleSection" data-self>${section.title}<span class="sidebar-section-arrow">&#9660;</span></div><div class="sidebar-section-body">${links}</div></div>`
  }).join('')
  const script = `(function(){var sb=document.getElementById('${sidebarId}');var saved=localStorage.getItem('sidebar-width');if(saved)sb.style.width=saved+'px';var collapsed=localStorage.getItem('sidebar-collapsed')==='true';if(collapsed)sb.classList.add('sidebar-collapsed');window.sidebarToggleSection=function(el){el.parentElement.classList.toggle('sidebar-section-closed')};window.sidebarToggleCollapse=function(){sb.classList.toggle('sidebar-collapsed');localStorage.setItem('sidebar-collapsed',sb.classList.contains('sidebar-collapsed'))};var handle=sb.querySelector('.sidebar-resize-handle');var startX,startW;handle.addEventListener('mousedown',function(e){startX=e.clientX;startW=sb.offsetWidth;function onMove(ev){var w=startW+(ev.clientX-startX);if(w>48&&w<400){sb.style.width=w+'px';localStorage.setItem('sidebar-width',w)}}function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)}document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp)})})();`
  return `<aside id="${sidebarId}" class="sidebar-collapsible"><div class="sidebar-inner"><button class="sidebar-collapse-btn" data-action="sidebarToggleCollapse" title="Toggle sidebar">&#9776;</button>${sectionHtml}</div><div class="sidebar-resize-handle"></div></aside><script>${script}</script>`
}
