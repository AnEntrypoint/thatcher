import { page, dataTable } from '@/ui/layout.js'
import { fmtVal, TOAST_SCRIPT, esc } from '@/ui/render-helpers.js'
import { canCreate, canEdit, canDelete } from '@/ui/permissions-ui.js'
import { permissionService } from '@/services/permission.service.js'

export function renderEntityList(entityName, items, spec, user, options = {}) {
  const label = spec?.labelPlural || spec?.label || entityName
  const fields = spec?.fields || {}
  const { groupBy = null } = options
  let listFields = Object.entries(fields).filter(([, f]) => f.list).slice(0, 5)
  if (!listFields.length) listFields = Object.entries(fields).filter(([k]) => !['created_by', 'updated_by'].includes(k)).slice(0, 6)
  if (!listFields.length && items.length > 0) listFields = Object.keys(items[0]).filter(k => !['created_by', 'updated_by'].includes(k)).slice(0, 5).map(k => [k, { label: k }])
  const headers = listFields.map(([k, f]) => `<th>${esc(f?.label || k)}</th>`).join('') + '<th>Actions</th>'
  const userCanEdit = canEdit(user, entityName)
  const userCanDelete = canDelete(user, entityName)
  const userCanCreate = canCreate(user, entityName)

  const buildRow = item => {
    const id = esc(String(item.id))
    const idArg = esc(JSON.stringify([String(item.id)]))
    const cells = listFields.map(([k]) => `<td>${fmtVal(item[k], k, item)}</td>`).join('')
    const editBtn = userCanEdit ? `<a href="/${entityName}/${id}/edit" class="btn btn-xs btn-outline">Edit</a>` : `<span class="btn btn-xs btn-outline btn-disabled tooltip" data-tip="No permission">Edit</span>`
    const delBtn = userCanDelete ? `<button data-stop-propagation="true" data-action="confirmDelete" data-args='${idArg}' class="btn btn-xs btn-error btn-outline">Delete</button>` : `<span class="btn btn-xs btn-error btn-outline btn-disabled tooltip" data-tip="No permission">Delete</span>`
    // Keyboard activation is handled centrally by event-delegation's data-navigate
    // handler (Enter/Space on role=link); no inline onkeydown to avoid a competing path.
    return `<tr class="hover cursor-pointer" data-searchable tabindex="0" role="link" data-navigate="/${entityName}/${id}">${cells}<td class="flex gap-1"><a href="/${entityName}/${id}" class="btn btn-xs btn-ghost">View</a>${editBtn}${delBtn}</td></tr>`
  }

  let tableContent
  if (groupBy && items.length > 0) {
    const groups = {}
    items.forEach(item => { const key = String(item[groupBy] || '(No ' + groupBy + ')'); if (!groups[key]) groups[key] = []; groups[key].push(item) })
    const sortedKeys = Object.keys(groups).sort()
    const groupRows = sortedKeys.map((gkey, gi) => {
      const groupItems = groups[gkey]
      // Index-based ids: slugs collide when two group values differ only by
      // punctuation/case (e.g. 'A/B' vs 'a-b'), which breaks the collapse toggle.
      const groupId = `group-${gi}`
      const togglerId = `toggle-${gi}`
      const itemRows = groupItems.map(buildRow).join('')
      const gkeySafe = esc(gkey)
      return `<tbody class="group-section" data-group="${gkeySafe}"><tr class="group-header hover cursor-pointer" tabindex="0" data-toggle="${togglerId}"><td colspan="100" style="padding:12px"><div class="flex items-center gap-2"><input type="checkbox" id="${togglerId}" class="group-toggle" style="cursor:pointer" checked/><span class="font-semibold text-base">${gkeySafe}</span><span class="badge badge-sm">${groupItems.length}</span></div></td></tr><tr class="group-content" id="${groupId}" style="display:contents"><td colspan="100"><table class="data-table" style="background:transparent"><tbody>${itemRows}</tbody></table></td></tr></tbody>`
    }).join('')
    tableContent = `<div class="card-clean"><div class="table-wrap"><table class="data-table"><thead><tr>${headers}</tr></thead>${groupRows}</table></div></div>`
  } else {
    const rows = items.map(buildRow).join('')
    tableContent = dataTable(headers, rows, items.length === 0 ? (userCanCreate ? `No items found. <a href="/${entityName}/new" class="text-primary hover:underline">Create your first ${esc(label.toLowerCase())}</a>` : 'No items found.') : '')
  }

  const createBtn = userCanCreate ? `<a href="/${entityName}/new" class="btn btn-primary btn-sm">Create New</a>` : ''
  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">${esc(label)}</h1><div class="flex gap-2"><label for="search-input" class="sr-only">Search</label><input type="text" id="search-input" placeholder="Search..." class="input input-solid input-sm" style="width:200px" aria-label="Search items"/>${createBtn}</div></div>${tableContent}`

  // Canonical gmConfirm (session-13): replaces the bespoke confirm-dialog markup + confirmDelete/cancelDelete/executeDelete show-hide.
  const deleteScript = `window.confirmDelete=async(id)=>{if(!id)return;const ok=await window.gmConfirm({title:'Delete ${entityName}',message:'Delete this ${entityName}? This cannot be undone.',confirmLabel:'Delete',danger:true});if(!ok)return;try{const res=await fetch('/api/${entityName}/'+id,{method:'DELETE'});if(res.ok){showToast('Deleted successfully','success');setTimeout(()=>window.location.reload(),500)}else{const d=await res.json().catch(()=>({}));showToast(d.message||d.error||'Delete failed','error')}}catch(err){showToast('Error: '+err.message,'error')}}`
  const searchScript = `function initSearch(){const si=document.getElementById('search-input');const tb=document.querySelectorAll('[data-searchable]');const groups=document.querySelectorAll('[data-group]');let visibleGroupCount=0;si.addEventListener('input',(e)=>{const query=e.target.value.toLowerCase().trim();const terms=query.length>0?query.split(/\\s+/):[],hasResults=terms.length>0;visibleGroupCount=0;groups.forEach(g=>{const rows=g.querySelectorAll('[data-searchable]');let visibleRows=0;rows.forEach(r=>{const text=r.textContent.toLowerCase();const matches=terms.every(t=>text.includes(t));r.style.display=matches?'':'none';if(matches)visibleRows++});const groupVisible=visibleRows>0;g.style.display=groupVisible?'':'none';if(groupVisible)visibleGroupCount++;const badge=g.querySelector('.badge');if(badge)badge.textContent=visibleRows});tb.forEach(r=>{if(!r.closest('[data-group]')){const text=r.textContent.toLowerCase();const matches=query.length===0||terms.every(t=>text.includes(t));r.style.display=matches?'':'none'}});const totalVisible=document.querySelectorAll('[data-searchable]:not([style*="display: none"])').length,noResults=hasResults&&totalVisible===0;let msg=document.getElementById('search-no-results');if(noResults&&!msg){msg=document.createElement('tr');msg.id='search-no-results';msg.innerHTML='<td colspan="100" class="text-center py-8 text-base-content/50">No results found for "'+query+'"</td>';const tbody=document.getElementById('table-body')||document.querySelector('tbody');if(tbody)tbody.appendChild(msg)}else if(!noResults&&msg)msg.remove()});const toggles=document.querySelectorAll('.group-toggle');toggles.forEach(tog=>{tog.addEventListener('change',(e)=>{e.stopPropagation();const row=tog.closest('tr');const tbody=row.parentElement;const content=tbody.querySelector('.group-content');content.style.display=tog.checked?'contents':'none'})});if(si.value)si.dispatchEvent(new Event('input'))}document.addEventListener('DOMContentLoaded',initSearch)`
  return page(user, `${label} | Thatcher`, [{ href: '/', label: 'Dashboard' }, { href: `/${entityName}`, label }], content, [TOAST_SCRIPT, deleteScript, searchScript])
}

const HIDDEN_FIELDS = new Set(['password_hash', 'password', 'session_token', 'photo_url'])
const KNOWN_ROLE_LABELS = { admin:'Admin', partner:'Partner', manager:'Manager', clerk:'Clerk', user:'User', auditor:'Auditor', client_admin:'Client Admin', client_user:'Client User' }

function roleLabel(r) {
  const key = (r || '').toLowerCase()
  return KNOWN_ROLE_LABELS[key] || (key.length > 8 ? 'Staff' : (key.charAt(0).toUpperCase() + key.slice(1)))
}

function formatFieldValue(k, v, entityName, f) {
  if (entityName === 'user' && k === 'role') return `<span class="pill pill-neutral">${roleLabel(v)}</span>`
  if (entityName === 'user' && k === 'status') {
    const cls = v === 'active' ? 'pill-success' : v === 'deleted' ? 'pill-danger' : 'pill-neutral'
    return `<span class="pill ${cls}">${v ? esc(v.charAt(0).toUpperCase() + v.slice(1)) : '-'}</span>`
  }
  if (entityName === 'user' && k === 'email' && v) { const e = esc(v); return `<a href="mailto:${e}" class="text-primary hover:underline">${e}</a>` }
  if (k === 'photo_url' && v && v.startsWith('http')) return `<img src="${esc(v)}" style="width:2.5rem;height:2.5rem;border-radius:50%;object-fit:cover" alt="avatar" onerror="this.style.display='none'"/>`
  if (f?.type === 'currency' && typeof v === 'number') return esc((f.currency_symbol || '$') + (v / 100).toFixed(2))
  if (f?.type === 'formula') return v == null ? '-' : esc(String(Math.round(v * 100) / 100)) + ' <span class="pill pill-neutral" style="margin-left:4px;font-size:10px">computed</span>'
  if (f?.type === 'multiselect') {
    const arr = Array.isArray(v) ? v : (typeof v === 'string' && v ? (() => { try { return JSON.parse(v) } catch { return [] } })() : [])
    return arr.length ? arr.map(x => `<span class="pill pill-neutral" style="margin-right:4px">${esc(x)}</span>`).join('') : '-'
  }
  if (f?.type === 'multiref' && f.ref) {
    const arr = Array.isArray(v) ? v : (typeof v === 'string' && v ? (() => { try { return JSON.parse(v) } catch { return [] } })() : [])
    return arr.length ? arr.map(x => `<a href="/${esc(f.ref)}/${esc(x)}" class="pill pill-neutral" style="margin-right:4px;text-decoration:none">${esc(x)}</a>`).join('') : '-'
  }
  if (f?.type === 'file' || f?.type === 'attachment') {
    const meta = typeof v === 'object' && v ? v : (typeof v === 'string' && v ? (() => { try { return JSON.parse(v) } catch { return null } })() : null)
    return meta?.url ? `<a href="${esc(meta.url)}" class="text-primary hover:underline" target="_blank" rel="noopener">${esc(meta.filename || 'Download')}</a>` : '-'
  }
  return fmtVal(v, k)
}

function formatHistoryDiff(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  const changed = [...keys].filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]) && !['updated_at', '_version'].includes(k))
  if (!changed.length) return ''
  return changed.map(k => {
    const from = before?.[k] !== undefined ? esc(String(before[k])) : '<em>none</em>'
    const to = after?.[k] !== undefined ? esc(String(after[k])) : '<em>none</em>'
    return `<div class="history-field-change"><strong>${esc(k)}</strong>: ${from} &rarr; ${to}</div>`
  }).join('')
}

function renderHistorySection(history) {
  if (!history || !history.length) return ''
  const rows = history.map(h => {
    const when = esc(new Date((h.createdAt || 0) * 1000).toLocaleString('en-ZA'))
    const diff = h.action === 'update' ? formatHistoryDiff(h.beforeState, h.afterState) : ''
    return `<div class="history-entry">
      <div class="history-entry-header"><span class="pill pill-info">${esc(h.action || '-')}</span><span class="history-entry-time">${when}</span><span class="history-entry-user">${esc(h.userId || '-')}</span></div>
      ${diff ? `<div class="history-entry-diff">${diff}</div>` : ''}
    </div>`
  }).join('')
  return `<div class="card-clean" style="margin-top:1.5rem"><div class="card-clean-body">
    <h3 style="margin-bottom:12px">History</h3>
    <div class="history-list">${rows}</div>
  </div></div>`
}

export function renderEntityDetail(entityName, item, spec, user, history = []) {
  const label = spec?.label || entityName
  // A field the caller's role isn't visible_to must never reach rendered HTML,
  // not just be CSS-hidden -- filterFields drops it from `fields` entirely so
  // it can't appear in visibleFields below however this function evolves.
  const fields = permissionService.filterFields(user, spec || {}, spec?.fields || {})
  const userCanEdit = canEdit(user, entityName)
  const userCanDelete = canDelete(user, entityName)

  // current_stock is computed (page-handler.js sums stock_movement rows),
  // never a spec.fields entry -- rendered as its own row rather than folded
  // into the generic field loop below, which only knows about spec fields.
  const stockRow = entityName === 'product' && typeof item.current_stock === 'number'
    ? (() => {
        const low = item.reorder_threshold != null && item.current_stock <= item.reorder_threshold
        const pillCls = low ? 'pill-danger' : 'pill-success'
        return `<div class="detail-row">
          <span class="detail-row-label">Current Stock</span>
          <span class="detail-row-value"><span class="pill ${pillCls}">${esc(String(item.current_stock))}${low ? ' (Low Stock)' : ''}</span></span>
        </div>`
      })()
    : ''

  // Forecast fields are computed alongside current_stock (page-handler.js's
  // inventory-forecast.js), same not-a-spec-field treatment.
  const forecastRow = entityName === 'product' && item.days_until_stockout !== undefined
    ? (() => {
        const daysLabel = item.days_until_stockout == null ? 'Unknown (no recent consumption)' : `${Math.round(item.days_until_stockout)} days`
        const reorderLabel = item.reorder_date == null ? '-' : new Date(item.reorder_date * 1000).toISOString().slice(0, 10)
        const pillCls = item.reorder_due ? 'pill-danger' : 'pill-success'
        return `<div class="detail-row">
          <span class="detail-row-label">Days Until Stockout</span>
          <span class="detail-row-value">${esc(daysLabel)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">Suggested Reorder Date</span>
          <span class="detail-row-value"><span class="pill ${pillCls}">${esc(reorderLabel)}${item.reorder_due ? ' (Reorder Now)' : ''}</span></span>
        </div>`
      })()
    : ''

  // total_hours/billable_amount are computed (page-handler.js sums time_entry
  // rows, directly for a task or joined through task for a project), same
  // not-a-spec-field treatment as current_stock above.
  const timeTrackingRows = (entityName === 'task' || entityName === 'project') && typeof item.total_hours === 'number'
    ? `<div class="detail-row"><span class="detail-row-label">Total Hours</span><span class="detail-row-value">${esc(String(item.total_hours))}</span></div>
       <div class="detail-row"><span class="detail-row-label">Billable Amount</span><span class="detail-row-value">${esc('$' + (item.billable_amount / 100).toFixed(2))}</span></div>`
    : ''

  // days_until_expiry is computed (page-handler.js diffs end_date against
  // now), never a spec.fields entry, same treatment as current_stock above.
  const expiryRow = entityName === 'contract' && typeof item.days_until_expiry === 'number'
    ? (() => {
        const warn = item.status === 'active' && item.days_until_expiry <= (item.notice_period_days ?? 30)
        const pillCls = item.days_until_expiry < 0 ? 'pill-danger' : (warn ? 'pill-warning' : 'pill-success')
        const label = item.days_until_expiry < 0 ? `Expired ${Math.abs(item.days_until_expiry)} days ago` : `${item.days_until_expiry} days`
        return `<div class="detail-row">
          <span class="detail-row-label">Days Until Expiry</span>
          <span class="detail-row-value"><span class="pill ${pillCls}">${esc(label)}${warn ? ' (Renewal Notice)' : ''}</span></span>
        </div>`
      })()
    : ''

  // allocated_hours_per_week/weekly_capacity_hours are computed (page-handler.js
  // sums resource_allocation rows for this user), same not-a-spec-field
  // treatment as current_stock/total_hours above.
  const utilizationRow = entityName === 'user' && typeof item.allocated_hours_per_week === 'number'
    ? (() => {
        const over = item.allocated_hours_per_week > item.weekly_capacity_hours
        const pillCls = over ? 'pill-danger' : 'pill-success'
        return `<div class="detail-row">
          <span class="detail-row-label">Resource Utilization</span>
          <span class="detail-row-value"><span class="pill ${pillCls}">${esc(String(item.allocated_hours_per_week))}h / ${esc(String(item.weekly_capacity_hours))}h${over ? ' (Over-allocated)' : ''}</span></span>
        </div>`
      })()
    : ''

  const visibleFields = Object.entries(fields).filter(([k]) => k !== 'id' && !HIDDEN_FIELDS.has(k) && item[k] !== undefined)

  const fieldRows = stockRow + forecastRow + timeTrackingRows + expiryRow + utilizationRow + visibleFields.map(([k, f]) =>
    `<div class="detail-row">
      <span class="detail-row-label">${esc(f.label || k)}</span>
      <span class="detail-row-value">${formatFieldValue(k, item[k], entityName, f)}</span>
    </div>`
  ).join('')

  const displayName = item.name || item.title || label
  const displayNameSafe = esc(displayName)
  const initials = esc((displayName || '?').charAt(0).toUpperCase())
  const statusCls = item.status === 'active' ? 'pill-success' : item.status === 'deleted' ? 'pill-danger' : 'pill-neutral'
  const statusLabel2 = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '-'

  const headerExtra = entityName === 'user' ? `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:var(--color-avatar-bg,#e0f2fe);display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:700;color:var(--color-avatar-fg,#0369a1);flex-shrink:0">
        ${item.photo_url ? `<img src="${esc(item.photo_url)}" style="width:3.5rem;height:3.5rem;border-radius:50%;object-fit:cover" alt="${displayNameSafe}" onerror="this.style.display='none'"/>` : initials}
      </div>
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;margin:0">${displayNameSafe}</h1>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.375rem">
          <span class="pill pill-neutral">${esc(roleLabel(item.role))}</span>
          <span class="pill ${statusCls}">${esc(statusLabel2)}</span>
          ${item.user_type ? `<span style="font-size:0.75rem;color:var(--color-text-muted)">${esc(item.user_type)}</span>` : ''}
        </div>
      </div>
    </div>` : `<div style="margin-bottom:1.5rem"><h1 style="font-size:1.5rem;font-weight:700">${displayNameSafe}</h1></div>`

  const editBtn = userCanEdit ? `<a href="/${entityName}/${item.id}/edit" class="btn btn-outline btn-sm">Edit</a>` : ''
  const cloneBtn = canCreate(user, entityName) ? `<a href="/${entityName}/new?clone_from=${esc(item.id)}" class="btn btn-outline btn-sm">Clone</a>` : ''
  const delBtn = userCanDelete ? `<button data-action="showDeleteConfirm" class="btn btn-error btn-outline btn-sm">Delete</button>` : ''

  const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="flex:1">${headerExtra}</div>
      <div style="display:flex;gap:0.5rem;margin-left:1rem">${editBtn}${cloneBtn}${delBtn}</div>
    </div>
    <div id="stale-data-banner" style="display:none;margin-bottom:12px" class="card-clean">
      <div class="card-clean-body" style="padding:10px 16px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px">This record was updated by someone else -- refresh to see changes.</span>
        <button type="button" class="btn-ghost-clean" onclick="window.location.reload()">Refresh</button>
      </div>
    </div>
    <div id="presence-indicator" style="display:none;margin-bottom:12px;font-size:13px;color:var(--color-text-muted)"></div>
    <div class="card-clean">
      <div class="card-clean-body"><div class="detail-grid">${fieldRows || '<p style="color:var(--color-text-muted);font-size:0.875rem;grid-column:1/-1">No details available</p>'}</div></div>
    </div>
    ${renderHistorySection(history)}
    `

  // Canonical gmConfirm (session-13): showDeleteConfirm runs the styled confirm then DELETEs; no bespoke dialog markup/show-hide.
  const script = `${TOAST_SCRIPT}window.showDeleteConfirm=async()=>{const ok=await window.gmConfirm({title:'Delete ${entityName}',message:'Delete this ${entityName}? This cannot be undone.',confirmLabel:'Delete',danger:true});if(!ok)return;try{const res=await fetch('/api/${entityName}/${item.id}',{method:'DELETE'});if(res.ok){showToast('Deleted successfully','success');setTimeout(()=>{window.location='/${entityName}'},500)}else{const d=await res.json().catch(()=>({}));showToast(d.message||d.error||'Delete failed','error')}}catch(err){showToast('Error: '+err.message,'error')}}`
  const collabScript = `(function(){
    var entity='${entityName}',id='${esc(String(item.id))}';
    var openedAt=Math.floor(Date.now()/1000);
    function heartbeat(){fetch('/api/presence/'+entity+'/'+id+'/heartbeat',{method:'POST'}).catch(function(){})}
    function pollPresence(){
      fetch('/api/presence/'+entity+'/'+id).then(function(r){return r.json()}).then(function(d){
        var el=document.getElementById('presence-indicator');
        if(!el)return;
        var viewers=d.viewers||[];
        if(viewers.length){
          el.style.display='block';
          el.textContent=(viewers.length===1?'1 other person is':viewers.length+' other people are')+' currently viewing this: '+viewers.map(function(v){return v.userName}).join(', ');
        } else {
          el.style.display='none';
        }
      }).catch(function(){})
    }
    function pollChanges(){
      fetch('/api/changes/'+entity+'/'+id+'/since/'+openedAt).then(function(r){return r.json()}).then(function(d){
        if(d.changed){
          var el=document.getElementById('stale-data-banner');
          if(el)el.style.display='block';
        }
      }).catch(function(){})
    }
    heartbeat();pollPresence();pollChanges();
    setInterval(heartbeat,10000);
    setInterval(pollPresence,10000);
    setInterval(pollChanges,8000);
  })();`
  const bc = [{ href: '/', label: 'Dashboard' }, { href: `/${entityName}`, label: spec?.labelPlural || label }, { label: item.name || item.title || `#${item.id}` }]
  return page(user, `${label} Detail`, bc, content, [script, collabScript])
}

export function renderEntityForm(entityName, item, spec, user, isNew = false, refOptions = {}, templates = []) {
  const label = spec?.label || entityName
  // A field the caller's role isn't editable_by must not be offered in the
  // form at all -- omitting it here is UX (a clean form), the real
  // enforcement is enforceEditPermissions rejecting the field server-side if
  // a raw request includes it anyway.
  const allFields = spec?.fields || {}
  const fields = {}
  for (const [k, f] of Object.entries(allFields)) {
    if (permissionService.checkFieldAccess(user, spec || {}, k, 'edit')) fields[k] = f
  }
  const lbl = (k, f, req) => `<label class="form-label" for="field-${k}">${esc(f.label||k)}${req ? '<span class="req">*</span>' : ''}</label>`
  // f.readonly (lowercase) is the actual normalized key generateEntitySpec
  // sets -- f.readOnly (camelCase) is never present on a spec object, so
  // this exclusion was previously silently dead: a field marked readonly
  // without ALSO being marked auto (e.g. a formula field) would render as
  // an editable input despite the label claiming otherwise.
  const formFields = Object.entries(fields).filter(([k, f]) => k !== 'id' && !f.auto && !f.readonly && !f.auto_generate && f.type !== 'formula' && k !== 'password_hash').map(([k, f]) => {
    let val = item?.[k] ?? f.default ?? ''
    const req = f.required ? 'required' : ''
    const type = f.type === 'number' || f.type === 'int' || f.type === 'decimal' ? 'number' : f.type === 'email' ? 'email' : f.type === 'timestamp' || f.type === 'date' ? 'date' : f.type === 'bool' ? 'checkbox' : 'text'
    // <input type=date> only populates from a strict YYYY-MM-DD; coerce a stored timestamp/ISO value so the existing date pre-fills (else it renders blank and saves empty).
    if (type === 'date' && val) { const d = new Date(val); if (!isNaN(d)) val = d.toISOString().slice(0, 10) }
    const placeholder = `placeholder="Enter ${esc((f.label||k).toLowerCase())}"`
    if (entityName === 'user' && k === 'role') {
      const opts = ['partner','manager','clerk','client_admin','client_user'].map(o => `<option value="${o}" ${val===o?'selected':''}>${o.charAt(0).toUpperCase()+o.slice(1).replace('_',' ')}</option>`).join('')
      return `<div class="form-field">${lbl(k,{label:'Role'},true)}<select id="field-role" name="role" class="form-input" required>${opts}</select></div>`
    }
    if (entityName === 'user' && k === 'status') {
      const opts = ['active','inactive','pending'].map(o => `<option value="${o}" ${val===o?'selected':''}>${o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('')
      return `<div class="form-field">${lbl(k,{label:'Status'},false)}<select id="field-status" name="status" class="form-input">${opts}</select></div>`
    }
    if (f.type === 'ref' && refOptions[k]) {
      const opts = refOptions[k].map(o => `<option value="${esc(o.value)}" ${val===o.value?'selected':''}>${esc(o.label)}</option>`).join('')
      const suggestBtn = entityName === 'resource_allocation' && k === 'user_id'
        ? `<button type="button" class="btn-ghost-clean" style="margin-top:4px" data-action="suggestBestFitUser">Suggest best-fit user</button>`
        : ''
      return `<div class="form-field">${lbl(k,f,f.required)}<select id="field-${k}" name="${k}" class="form-input" ${req}><option value="">Select ${esc(f.label||k)}...</option>${opts}</select>${suggestBtn}</div>`
    }
    if (f.type === 'textarea') return `<div class="form-field full">${lbl(k,f,f.required)}<textarea id="field-${k}" name="${k}" class="form-input" style="min-height:100px;resize:vertical" ${req} placeholder="Enter ${esc((f.label||k).toLowerCase())}">${esc(val)}</textarea></div>`
    if (f.type === 'bool') return `<div class="form-field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="field-${k}" name="${k}" class="checkbox checkbox-primary" ${val?'checked':''}/><span class="form-label" style="margin:0">${esc(f.label||k)}</span></label></div>`
    if (f.type === 'enum' && f.options) {
      const opts = (Array.isArray(f.options) ? f.options : []).map(o => { const ov = typeof o === 'string' ? o : o.value; const ol = typeof o === 'string' ? o : o.label; return `<option value="${esc(ov)}" ${val===ov?'selected':''}>${esc(ol)}</option>` }).join('')
      return `<div class="form-field">${lbl(k,f,f.required)}<select id="field-${k}" name="${k}" class="form-input" ${req}><option value="">Select ${esc(f.label||k)}...</option>${opts}</select></div>`
    }
    if (f.type === 'multiselect' && f.options) {
      const selected = new Set(Array.isArray(val) ? val : (typeof val === 'string' && val ? (() => { try { return JSON.parse(val) } catch { return [] } })() : []))
      const opts = (Array.isArray(f.options) ? f.options : []).map(o => { const ov = typeof o === 'string' ? o : o.value; const ol = typeof o === 'string' ? o : o.label; return `<label style="display:flex;align-items:center;gap:6px;margin:2px 0"><input type="checkbox" name="${k}[]" value="${esc(ov)}" class="checkbox checkbox-primary" ${selected.has(ov)?'checked':''}/><span>${esc(ol)}</span></label>` }).join('')
      return `<div class="form-field full">${lbl(k,f,f.required)}<div id="field-${k}" data-multiselect="${k}">${opts}</div></div>`
    }
    if (f.type === 'multiref' && refOptions[k]) {
      const selected = new Set(Array.isArray(val) ? val : (typeof val === 'string' && val ? (() => { try { return JSON.parse(val) } catch { return [] } })() : []))
      const opts = refOptions[k].filter(o => o.value !== item?.id).map(o => `<label style="display:flex;align-items:center;gap:6px;margin:2px 0"><input type="checkbox" name="${k}[]" value="${esc(o.value)}" class="checkbox checkbox-primary" ${selected.has(o.value)?'checked':''}/><span>${esc(o.label)}</span></label>`).join('') || '<p style="font-size:0.8rem;color:var(--color-text-muted)">No options available</p>'
      return `<div class="form-field full">${lbl(k,f,f.required)}<div id="field-${k}" data-multiselect="${k}">${opts}</div></div>`
    }
    if (f.type === 'currency') {
      const symbol = esc(f.currency_symbol || '$')
      const decimalVal = typeof val === 'number' ? (val / 100).toFixed(2) : val
      return `<div class="form-field">${lbl(k,f,f.required)}<div style="display:flex;align-items:center;gap:6px"><span>${symbol}</span><input type="number" step="0.01" id="field-${k}" name="${k}" value="${esc(decimalVal)}" class="form-input" data-currency="${k}" ${req} placeholder="0.00"/></div></div>`
    }
    if (f.type === 'file' || f.type === 'attachment') {
      const existing = val && typeof val === 'object' ? val : (typeof val === 'string' && val ? (() => { try { return JSON.parse(val) } catch { return null } })() : null)
      const existingNote = existing?.filename ? `<div style="font-size:0.8rem;color:var(--color-text-muted)" data-existing-file="${k}">Current: ${esc(existing.filename)}</div>` : ''
      return `<div class="form-field">${lbl(k,f,f.required)}<input type="file" id="field-${k}" data-attachment="${k}" class="form-input" ${existing ? '' : req}/>${existingNote}<input type="hidden" id="field-${k}-value" name="${k}" value="${existing ? esc(JSON.stringify(existing)) : ''}"/></div>`
    }
    return `<div class="form-field">${lbl(k,f,f.required)}<input type="${type}" id="field-${k}" name="${k}" value="${esc(val)}" class="form-input" ${req} ${placeholder}/></div>`
  }).join('\n')

  const pwField = entityName === 'user' ? `<div class="form-field"><label class="form-label" for="field-new-password">New Password <small style="font-weight:400;color:var(--color-text-muted)">(leave blank to keep unchanged)</small></label><input type="password" id="field-new-password" name="new_password" class="form-input" placeholder="Enter new password" autocomplete="new-password"/></div>` : ''
  const bc = isNew
    ? [{ href: '/', label: 'Dashboard' }, { href: `/${entityName}`, label: spec?.labelPlural || label }, { label: 'Create' }]
    : [{ href: '/', label: 'Dashboard' }, { href: `/${entityName}`, label: spec?.labelPlural || label }, { href: `/${entityName}/${item?.id}`, label: item?.name || item?.title || `#${item?.id}` }, { label: 'Edit' }]
  const templatePicker = isNew && templates.length
    ? `<div class="form-field full"><label class="form-label" for="template-picker">Start from template</label>
        <select id="template-picker" onchange="if(this.value)window.location='/${entityName}/new?template='+this.value">
          <option value="">Blank</option>${templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}
        </select></div>`
    : ''
  const content = `<div class="form-shell"><div style="margin-bottom:24px"><h1 style="font-size:24px;font-weight:700">${isNew ? 'Create' : 'Edit'} ${esc(label)}</h1></div>
    <div class="form-section"><form id="entity-form" class="form-grid" aria-label="${isNew ? 'Create' : 'Edit'} ${esc(label)}">${templatePicker}${formFields}${pwField}
    <div class="form-actions" style="grid-column:1/-1"><button type="submit" id="submit-btn" class="btn-primary-clean"><span class="btn-text">Save</span><span class="btn-loading-text" style="display:none">Saving...</span></button>
    <a href="/${entityName}${isNew ? '' : '/' + item?.id}" class="btn-ghost-clean">Cancel</a></div></form></div></div>`
  const script = `${TOAST_SCRIPT}const form=document.getElementById('entity-form');const sb=document.getElementById('submit-btn');form.addEventListener('submit',async(e)=>{e.preventDefault();sb.classList.add('btn-loading');sb.querySelector('.btn-text').style.display='none';sb.querySelector('.btn-loading-text').style.display='inline';sb.disabled=true;try{const fileInputs=[...form.querySelectorAll('input[type=file][data-attachment]')];for(const fi of fileInputs){const f=fi.files&&fi.files[0];if(!f)continue;const uf=new FormData();uf.append('file',f);const ures=await fetch('/api/upload',{method:'POST',body:uf});const ud=await ures.json();if(!ures.ok)throw new Error(ud.error||'File upload failed');const hidden=document.getElementById('field-'+fi.dataset.attachment+'-value');hidden.value=JSON.stringify(ud)}const fd=new FormData(form);const data={};for(const[k,v]of fd.entries()){if(k.endsWith('[]'))continue;data[k]=v}form.querySelectorAll('input[type=checkbox]:not([name$="[]"])').forEach(cb=>{data[cb.name]=cb.checked});form.querySelectorAll('[data-multiselect]').forEach(ms=>{const name=ms.dataset.multiselect;data[name]=[...ms.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value)});form.querySelectorAll('input[type=number]:not([data-currency])').forEach(inp=>{if(inp.name&&data[inp.name]!==undefined&&data[inp.name]!=='')data[inp.name]=Number(data[inp.name])});form.querySelectorAll('input[data-currency]').forEach(inp=>{const name=inp.dataset.currency;if(inp.value!=='')data[name]=Math.round(Number(inp.value)*100)});const url=${isNew}?'/api/${entityName}':'/api/${entityName}/${item?.id}';const method=${isNew}?'POST':'PUT';const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await res.json();if(res.ok){showToast('${isNew?'Created':'Updated'} successfully!','success');const ed=result.data||result;setTimeout(()=>{window.location='/${entityName}/'+(ed.id||'${item?.id}')},500)}else{showToast(result.message||result.error||'Save failed','error');sb.classList.remove('btn-loading');sb.querySelector('.btn-text').style.display='inline';sb.querySelector('.btn-loading-text').style.display='none';sb.disabled=false}}catch(err){showToast('Error: '+err.message,'error');sb.classList.remove('btn-loading');sb.querySelector('.btn-text').style.display='inline';sb.querySelector('.btn-loading-text').style.display='none';sb.disabled=false}})`
  const suggestScript = entityName === 'resource_allocation'
    ? `window.suggestBestFitUser=async function(){const start=document.getElementById('field-start_date');const end=document.getElementById('field-end_date');const hours=document.getElementById('field-allocated_hours_per_week');if(!start.value||!end.value||!hours.value){showToast('Fill in start date, end date, and hours first','error');return}const startTs=Math.floor(new Date(start.value).getTime()/1000);const endTs=Math.floor(new Date(end.value).getTime()/1000);try{const res=await fetch('/api/resource-optimizer/suggest?start_date='+startTs+'&end_date='+endTs+'&hours_needed='+encodeURIComponent(hours.value));const data=await res.json();if(!res.ok){showToast(data.error||'Suggestion failed','error');return}if(!data.suggestions||!data.suggestions.length){showToast('No user has enough remaining capacity','warning');return}const top=data.suggestions[0];const select=document.getElementById('field-user_id');if(select){select.value=top.user_id;showToast('Suggested user selected ('+top.remaining_capacity+'h remaining capacity)','success')}}catch(err){showToast('Error: '+err.message,'error')}}`
    : ''
  return page(user, `${isNew ? 'Create' : 'Edit'} ${label}`, bc, content, [script, suggestScript])
}

export function renderSettings(user, config = {}) {
  const t = config.thresholds || {}
  const sections = [
    { title: 'System Information', items: [['Database Type', config.database?.type || 'SQLite'], ['Server Port', config.server?.port || 3000], ['Session TTL', (t.cache?.session_ttl_seconds || 3600) + 's'], ['Page Size (Default)', t.system?.default_page_size || 50], ['Page Size (Max)', t.system?.max_page_size || 500]] },
    { title: 'RFI Configuration', items: [['Max Days Outstanding', (t.rfi?.max_days_outstanding || 90) + ' days'], ['Escalation Delay', (t.rfi?.escalation_delay_hours || 24) + ' hours'], ['Notification Days', (t.rfi?.notification_days || [7,3,1,0]).join(', ')]] },
    { title: 'Email Configuration', items: [['Batch Size', t.email?.send_batch_size || 10], ['Max Retries', t.email?.send_max_retries || 3], ['Rate Limit Delay', (t.email?.rate_limit_delay_ms || 6000) + 'ms']] },
    { title: 'Workflow Configuration', items: [['Stage Transition Lockout', (t.workflow?.stage_transition_lockout_minutes || 5) + ' minutes'], ['Collaborator Default Expiry', (t.collaborator?.default_expiry_days || 7) + ' days'], ['Collaborator Max Expiry', (t.collaborator?.max_expiry_days || 30) + ' days']] },
  ]
  const cards = sections.map(s => `<div class="card-clean"><div class="card-clean-body"><h2 style="font-size:1rem;font-weight:600">${esc(s.title)}</h2><div class="space-y-4 mt-4">${s.items.map(([l, v]) => `<div class="flex justify-between py-2 border-b border-base-200"><span class="text-base-content/50 text-sm">${esc(l)}</span><span class="font-medium text-sm">${esc(v)}</span></div>`).join('')}</div></div></div>`).join('')
  // These values are config-driven (read-only here). State the source so an admin
  // who lands expecting to edit knows where to change them, rather than hitting a
  // silent dead-end page with no affordance.
  const notice = `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body" style="display:flex;gap:0.75rem;align-items:flex-start"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted,#64748b)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><p style="margin:0;font-size:0.875rem;color:var(--color-text-muted,#64748b)">These settings are read-only. They are defined in <code>thatcher.config.yml</code> and applied on server start; edit that file and restart to change them.</p></div></div>`
  return page(user, 'System Settings | Thatcher', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }],
    `<h1 class="text-2xl font-bold mb-6">System Settings</h1>${notice}<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">${cards}</div>`)
}
