import { h } from '@/ui/webjsx.js'

export const STAGE_COLORS = {
  info_gathering: { bg: '#dbeafe', text: '#1e40af', label: 'Info Gathering', bgDark: '#1e3a8a', textDark: '#60a5fa' },
  commencement: { bg: '#dbeafe', text: '#1e40af', label: 'Commencement', bgDark: '#1e3a8a', textDark: '#60a5fa' },
  team_execution: { bg: '#fef3c7', text: '#92400e', label: 'Team Execution', bgDark: '#78350f', textDark: '#fbbf24' },
  partner_review: { bg: '#fef3c7', text: '#92400e', label: 'Partner Review', bgDark: '#78350f', textDark: '#fbbf24' },
  finalization: { bg: '#d1fae5', text: '#065f46', label: 'Finalization', bgDark: '#064e3b', textDark: '#34d399' },
  closeout: { bg: '#d1fae5', text: '#065f46', label: 'Close Out', bgDark: '#064e3b', textDark: '#34d399' },
}

export const STATUS_COLORS = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  active: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  archived: { bg: '#f3f4f6', text: '#4b5563' },
  open: { bg: '#fef3c7', text: '#92400e' },
  closed: { bg: '#d1fae5', text: '#065f46' },
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  review: { bg: '#ede9fe', text: '#5b21b6' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  overdue: { bg: '#fee2e2', text: '#991b1b' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
  on_hold: { bg: '#fef3c7', text: '#92400e' },
  resolved: { bg: '#d1fae5', text: '#065f46' },
  unresolved: { bg: '#fee2e2', text: '#991b1b' },
  flagged: { bg: '#fce7f3', text: '#9d174d' },
  responded: { bg: '#dbeafe', text: '#1e40af' },
  expired: { bg: '#f3f4f6', text: '#6b7280' },
  private: { bg: '#ede9fe', text: '#5b21b6' },
  public: { bg: '#dbeafe', text: '#1e40af' },
}

export const STAGE_CONFIG = [
  { key: 'info_gathering', label: 'Info Gathering', badge: 'stage-pill stage-info_gathering', color: '#e53935' },
  { key: 'commencement',   label: 'Commencement',   badge: 'stage-pill stage-commencement',  color: '#e65100' },
  { key: 'team_execution', label: 'Team Execution', badge: 'stage-pill stage-team_execution', color: '#1565c0' },
  { key: 'partner_review', label: 'Partner Review', badge: 'stage-pill stage-partner_review', color: '#283593' },
  { key: 'finalization',   label: 'Finalization',   badge: 'stage-pill stage-finalization',   color: '#2e7d32' },
  { key: 'closeout',       label: 'Close Out',      badge: 'stage-pill stage-closeout',       color: '#33691e' },
]

export const AVATAR_COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#e11d48']
export const AVATAR_SIZES = { sm: 24, md: 32, lg: 40, xl: 48 }

export const TOAST_SCRIPT = `window.showToast=(m,t='info')=>{let c=document.getElementById('toast-container');if(!c){c=document.createElement('div');c.id='toast-container';c.className='toast-container';c.setAttribute('role','status');c.setAttribute('aria-live','polite');c.setAttribute('aria-atomic','true');document.body.appendChild(c)}const d=document.createElement('div');d.className='toast toast-'+t;d.textContent=m;c.appendChild(d);setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300)},3000)};`

export const TABLE_SCRIPT = `(function(){let sortCol=null,sortDir=1;function filterTable(){const search=(document.getElementById('search-input')?.value||'').toLowerCase();const filters={};document.querySelectorAll('[data-filter]').forEach(el=>{if(el.value)filters[el.dataset.filter]=el.value.toLowerCase()});let shown=0,total=0;document.querySelectorAll('tbody tr[data-row]').forEach(row=>{total++;const text=row.textContent.toLowerCase();const matchSearch=!search||text.includes(search);const matchFilters=Object.entries(filters).every(([key,val])=>{const cell=row.querySelector('[data-col="'+key+'"]');return !cell||cell.textContent.toLowerCase().includes(val)});const visible=matchSearch&&matchFilters;row.style.display=visible?'':'none';if(visible)shown++});const counter=document.getElementById('row-count');if(counter)counter.textContent=shown===total?total+' items':shown+' of '+total+' items'}function sortTable(col){if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1;}document.querySelectorAll('th[data-sort]').forEach(th=>{th.classList.remove('sort-asc','sort-desc');if(th.dataset.sort===col)th.classList.add(sortDir===1?'sort-asc':'sort-desc')});const tbody=document.querySelector('tbody');if(!tbody)return;const rows=Array.from(tbody.querySelectorAll('tr[data-row]'));rows.sort((a,b)=>{const av=a.querySelector('[data-col="'+col+'"]')?.textContent?.trim()||'';const bv=b.querySelector('[data-col="'+col+'"]')?.textContent?.trim()||'';return av.localeCompare(bv,undefined,{numeric:true})*sortDir});rows.forEach(r=>tbody.appendChild(r))}window.filterTable=filterTable;window.sortTable=sortTable;document.addEventListener('DOMContentLoaded',()=>{document.getElementById('search-input')?.addEventListener('input',filterTable);document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('change',filterTable));document.querySelectorAll('th[data-sort]').forEach(th=>th.addEventListener('click',()=>sortTable(th.dataset.sort)))})})();`

export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function stagePill(stage) {
  const cfg = STAGE_CONFIG.find(s => s.key === stage)
  const lbl = cfg ? cfg.label : (stage || '-')
  const stageColor = STAGE_COLORS[stage]
  if (stageColor) {
    return `<span class="stage-pill stage-${esc(stage||'')}" data-stage="${stage}" style="background:${stageColor.bg};color:${stageColor.text}">${lbl}</span>`
  }
  return `<span class="stage-pill stage-${esc(stage||'')}">${lbl}</span>`
}

export function statusPill(status) {
  const map = { active:'pill pill-success', pending:'pill pill-warning', inactive:'pill pill-neutral', draft:'pill pill-neutral', closed:'pill pill-neutral', responded:'pill pill-success', overdue:'pill pill-danger', sent:'pill pill-warning' }
  const cls = map[(status||'').toLowerCase()] || 'pill pill-neutral'
  return `<span class="${cls}">${status ? status.charAt(0).toUpperCase()+status.slice(1) : '-'}</span>`
}

export function statusBadge(status) {
  const map = { active:'pill pill-success', inactive:'pill pill-danger', pending:'pill pill-warning', open:'pill pill-info', in_progress:'pill pill-info', completed:'pill pill-success', closed:'pill pill-neutral', archived:'pill pill-neutral', responded:'pill pill-info' }
  const cls = map[(status||'').toLowerCase()] || 'pill pill-neutral'
  return `<span class="${cls}">${status ? status.charAt(0).toUpperCase()+status.slice(1) : '-'}</span>`
}

export function progressBar(pct) {
  if (typeof pct !== 'number') return '-'
  const p = Math.min(100, Math.max(0, Math.round(pct)))
  return `<div style="display:flex;align-items:center;gap:8px;min-width:100px"><div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="height:100%;width:${p}%;background:var(--color-primary);border-radius:3px"></div></div><span style="font-size:12px;color:var(--color-text-muted);min-width:28px">${p}%</span></div>`
}

export function fmtVal(value, fieldKey, item = {}) {
  if (value === null || value === undefined) return '-'
  if (fieldKey?.includes('_at') || fieldKey === 'created_at' || fieldKey === 'updated_at') {
    const num = Number(value)
    if (!isNaN(num) && num > 1000000000 && num < 3000000000) return new Date(num * 1000).toLocaleString()
  }
  if (fieldKey === 'year') { const n = Number(value); if (!isNaN(n)) return String(Math.floor(n)) }
  if (fieldKey === 'stage' && STAGE_COLORS[value]) {
    const s = STAGE_COLORS[value]
    return h('span', { className: 'badge-stage', style: `background:${s.bg};color:${s.text}` }, s.label)
  }
  if (fieldKey === 'status' && STATUS_COLORS[value]) {
    const s = STATUS_COLORS[value]
    return h('span', { className: 'badge-status', style: `background:${s.bg};color:${s.text}` }, value.charAt(0).toUpperCase() + value.slice(1))
  }
  if (item[`${fieldKey}_display`]) return item[`${fieldKey}_display`]
  return String(value)
}

export function statusLabel(status) {
  if (!status) return ''
  const key = status.toLowerCase().replace(/\s+/g, '_')
  const s = STATUS_COLORS[key] || { bg: '#f3f4f6', text: '#6b7280' }
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
  return h('span', { className: 'status-label', style: `background:${s.bg};color:${s.text}` }, label)
}

export function nameHash(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return Math.abs(hash)
}

export { getInitials } from '@/lib/utils.js'

export function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString();
  return String(ts);
}
