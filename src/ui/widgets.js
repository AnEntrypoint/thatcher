import { h } from '@/ui/webjsx.js'
import { STAGE_COLORS, AVATAR_COLORS, AVATAR_SIZES, nameHash, getInitials } from '@/ui/render-helpers.js'

export function linearProgress(value = 0, max = 100, label = '', variant = 'medium') {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const ht = variant === 'thin' ? '4px' : variant === 'thick' ? '16px' : '8px'
  const color = pct < 30 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#22c55e'
  const ariaLabel = label || 'Progress'
  return h('div', { className: 'linear-progress-wrap' },
    label ? h('span', { className: 'progress-label' }, label) : '',
    h('div', { className: 'linear-progress', style: `height:${ht}`, role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': ariaLabel },
      h('div', { className: 'linear-progress-bar', style: `width:${pct}%;height:100%;background:${color}` })
    ),
    h('span', { className: 'progress-pct', style: `color:${color}`, 'aria-hidden': 'true' }, `${pct}%`)
  )
}

export function circularProgress(value = 0, max = 100, label = '') {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const color = pct < 30 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#22c55e'
  const r = 40, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ
  const ariaLabel = label || 'Progress'
  return `<div class="circular-progress" style="width:100px;height:100px" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${ariaLabel}">
    <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="8"/>
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
    </svg>
    <div class="circular-progress-text" aria-hidden="true">
      <span class="circular-progress-pct">${pct}%</span>
      ${label ? `<span class="circular-progress-label">${label}</span>` : ''}
    </div>
  </div>`
}

export function engagementProgress(stage, stages = null) {
  const stageKeys = stages || Object.keys(STAGE_COLORS)
  const activeIdx = stageKeys.indexOf(stage)
  const pills = stageKeys.map((key, i) => {
    const s = STAGE_COLORS[key] || { bg: '#f3f4f6', text: '#4b5563', label: key }
    const cls = i === activeIdx ? 'stage-active' : i < activeIdx ? 'stage-completed' : ''
    return h('div', { className: `stage-pill ${cls}`, style: `background:${s.bg};color:${s.text}` }, s.label)
  }).join('')
  return h('div', { className: 'engagement-pipeline' }, pills)
}

export function emptyState(icon = '', title = '', message = '', actionHref = '', actionLabel = '') {
  const btn = actionHref && actionLabel ? h('a', { href: actionHref, className: 'btn btn-primary btn-sm' }, actionLabel) : ''
  return h('div', { className: 'empty-state' },
    h('div', { className: 'empty-state-icon' }, icon),
    h('div', { className: 'empty-state-title' }, title),
    h('div', { className: 'empty-state-msg' }, message),
    btn
  )
}

export function getUserAvatarUrl(user) {
  const name = user?.name || user?.email || 'User'
  const initials = getInitials(name)
  const color = AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="24" fill="${color}"/><text x="24" y="24" dy=".35em" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18" font-weight="600">${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function userAvatar(user, size = 'md', showStatus = false) {
  const px = AVATAR_SIZES[size] || AVATAR_SIZES.md
  const name = user?.name || user?.email || 'User'
  const initials = getInitials(name)
  const color = AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length]
  const fontSize = Math.round(px * 0.4)
  const statusDot = showStatus ? `<span class="avatar-status avatar-status-${user?.status === 'active' || user?.online ? 'online' : 'offline'}" style="width:${Math.round(px * 0.3)}px;height:${Math.round(px * 0.3)}px"></span>` : ''
  return `<span class="user-avatar user-avatar-${size}" style="width:${px}px;height:${px}px;background:${color};font-size:${fontSize}px" title="${name}" aria-label="${name}" role="img"><span aria-hidden="true">${initials}</span>${statusDot}</span>`
}

export function teamAvatarGroup(users = [], maxShow = 3) {
  if (!users.length) return ''
  const shown = users.slice(0, maxShow)
  const overflow = users.length - maxShow
  const avatars = shown.map((u, i) => `<span class="avatar-group-item" style="z-index:${maxShow - i}">${userAvatar(u, 'sm')}</span>`).join('')
  const badge = overflow > 0 ? `<span class="avatar-group-overflow">+${overflow}</span>` : ''
  return `<span class="avatar-group">${avatars}${badge}</span>`
}

export function infoBubble(text, position = 'top') {
  return `<span class="info-bubble info-bubble-${position}" data-tooltip="${text.replace(/"/g, '&quot;')}"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><text x="8" y="12" text-anchor="middle" fill="currentColor" font-size="10" font-weight="600">i</text></svg></span>`
}

export function sortableList(items = [], containerId = 'sortable') {
  const lis = items.map((item, i) =>
    `<li class="sortable-item" draggable="true" data-index="${i}"><span class="sortable-handle">&#9776;</span><span>${typeof item === 'string' ? item : item.label || item.name || ''}</span></li>`
  ).join('')
  const script = `(function(){const c=document.getElementById('${containerId}');let dragged=null;c.addEventListener('dragstart',e=>{dragged=e.target.closest('.sortable-item');e.dataTransfer.effectAllowed='move'});c.addEventListener('dragover',e=>{e.preventDefault();const t=e.target.closest('.sortable-item');if(t&&t!==dragged)t.classList.add('drag-over')});c.addEventListener('dragleave',e=>{const t=e.target.closest('.sortable-item');if(t)t.classList.remove('drag-over')});c.addEventListener('drop',e=>{e.preventDefault();const t=e.target.closest('.sortable-item');if(t&&t!==dragged){t.classList.remove('drag-over');c.insertBefore(dragged,t.nextSibling);const order=[...c.querySelectorAll('.sortable-item')].map(el=>+el.dataset.index);c.dispatchEvent(new CustomEvent('sortable-reorder',{detail:{order}}))}});})();`
  return `<ul id="${containerId}" class="sortable-list">${lis}</ul><script>${script}</script>`
}

export function responseChoiceBox(name, options = [], selected = null, type = 'radio') {
  const sel = Array.isArray(selected) ? selected : (selected != null ? [selected] : [])
  const items = options.map((opt) => {
    const val = typeof opt === 'string' ? opt : opt.value || opt
    const lbl = typeof opt === 'string' ? opt : opt.label || opt.value || opt
    const checked = sel.includes(val) ? 'checked' : ''
    return `<label class="choice-option"><input type="${type}" name="${name}" value="${val}" ${checked}/><span class="choice-label">${lbl}</span></label>`
  }).join('')
  return `<div class="choice-group">${items}</div>`
}

export function responseAttachment(file = {}) {
  const name = file.name || file.filename || 'Unnamed'
  const size = file.size ? (file.size < 1024 ? file.size + ' B' : file.size < 1048576 ? (file.size / 1024).toFixed(1) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB') : ''
  const href = file.url || file.path || '#'
  const ext = name.split('.').pop().toLowerCase()
  const isImg = ['png','jpg','jpeg','gif','webp','svg'].includes(ext)
  const isPdf = ext === 'pdf'
  const icon = isImg ? '&#128444;' : isPdf ? '&#128196;' : '&#128206;'
  const preview = isImg ? `<img src="${href}" alt="${name}" class="attachment-preview"/>` : isPdf ? `<iframe src="${href}" class="attachment-preview" style="width:100%;height:200px;border:none"></iframe>` : ''
  return `<div class="attachment-card"><span class="attachment-icon">${icon}</span><div class="attachment-info"><div class="attachment-name">${name}</div>${size ? `<div class="attachment-size">${size}</div>` : ''}${preview}</div><a href="${href}" download class="btn btn-ghost btn-xs">Download</a></div>`
}

export function accordion(items) {
  if (!items?.length) return ''
  return h('div', { className: 'accordion' },
    items.map(item =>
      h('details', { className: 'accordion-item' },
        h('summary', { className: 'accordion-summary' }, item.title),
        h('div', { className: 'accordion-content' }, item.content)
      )
    ).join('')
  )
}

export function divider(label) {
  if (!label) return '<hr class="divider"/>'
  return `<div class="divider-labeled"><hr class="divider-line"/><span class="divider-text">${label}</span><hr class="divider-line"/></div>`
}

export function responsiveClass(breakpoint) {
  const bp = { sm: 640, md: 768, lg: 1024, xl: 1280 }
  if (!bp[breakpoint]) return ''
  return `resp-${breakpoint}`
}

export function reviewCalcFields(review, highlights) {
  const hl = highlights || []
  const total = hl.length
  const resolved = hl.filter(h => h.resolved || h.status === 'resolved').length
  const unresolved = total - resolved
  const resolutionPct = total > 0 ? Math.round((resolved / total) * 100) : 0
  const flagged = hl.filter(h => h.flagged || h.flag).length
  const byColor = {}
  hl.forEach(h => { const c = h.color || 'none'; byColor[c] = (byColor[c] || 0) + 1 })
  return { total, resolved, unresolved, resolutionPct, flagged, byColor }
}
