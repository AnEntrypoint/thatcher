import { h } from '@/ui/webjsx.js'
import { STAGE_COLORS, statusLabel } from '@/ui/render-helpers.js'
import { teamAvatarGroup } from '@/ui/widgets.js'
import { canEdit } from '@/ui/permissions-ui.js'

export function engagementCard(engagement, user) {
  const e = engagement || {}
  const stage = e.stage ? (STAGE_COLORS[e.stage] || { bg: '#f3f4f6', text: '#6b7280', label: e.stage }) : null
  const stageBadge = stage ? `<span class="badge-stage" data-stage="${e.stage}" style="background:${stage.bg};color:${stage.text}">${stage.label || e.stage}</span>` : ''
  const sts = e.status ? statusLabel(e.status) : ''
  const progress = typeof e.progress === 'number' ? `<div class="engagement-card-progress"><div class="engagement-card-progress-bar" style="width:${Math.min(100, Math.max(0, e.progress))}%"></div></div>` : ''
  const team = e.team?.length ? `<div class="engagement-card-team">${teamAvatarGroup(e.team, 3)}</div>` : ''
  const dueDate = e.due_date ? `<span class="text-xs text-gray-500">${typeof e.due_date === 'number' ? new Date(e.due_date * 1000).toLocaleDateString() : e.due_date}</span>` : ''
  const clientName = e.client_name || e.client?.name || ''
  return `<div class="engagement-card card-clean" data-navigate="/engagement/${e.id}" style="cursor:pointer">
    <div class="card-clean-body">
      <div class="flex justify-between items-center mb-2">${clientName ? `<span class="text-xs text-gray-500">${clientName}</span>` : '<span></span>'}${sts}</div>
      <h3 class="font-medium mb-2">${e.name || e.title || 'Untitled'}</h3>
      <div class="flex items-center gap-2 mb-2">${stageBadge}${dueDate}</div>
      ${progress}
      <div class="flex justify-between items-center mt-2">${team}<div class="flex gap-1"><a href="/engagement/${e.id}" class="btn btn-xs btn-ghost" data-stop-propagation="true">View</a>${canEdit(user, 'engagement') ? `<a href="/engagement/${e.id}/edit" class="btn btn-xs btn-outline" data-stop-propagation="true">Edit</a>` : ''}</div></div>
    </div></div>`
}

export function mobileEngagementCard(engagement) {
  const e = engagement || {}
  const stage = e.stage ? (STAGE_COLORS[e.stage] || { bg: '#f3f4f6', text: '#6b7280', label: e.stage }) : null
  const stageBadge = stage ? `<span class="badge-stage" data-stage="${e.stage}" style="background:${stage.bg};color:${stage.text};font-size:0.65rem;padding:0.15rem 0.5rem">${stage.label || e.stage}</span>` : ''
  const sts = e.status ? statusLabel(e.status) : ''
  return `<div class="mobile-card mobile-engagement-card card-clean">
    <div class="card-clean-body">
      <div class="flex justify-between items-center mb-2"><h3 class="font-medium text-sm">${e.name || e.title || 'Untitled'}</h3>${sts}</div>
      ${e.client_name ? `<div class="text-xs text-gray-500 mb-1">${e.client_name}</div>` : ''}
      <div class="flex items-center gap-2 mb-2">${stageBadge}${e.due_date ? `<span class="text-xs text-gray-500">${typeof e.due_date === 'number' ? new Date(e.due_date * 1000).toLocaleDateString() : e.due_date}</span>` : ''}</div>
      <div class="flex gap-1 mt-2"><a href="/engagement/${e.id}" class="btn btn-xs btn-primary">View</a><a href="/engagement/${e.id}/edit" class="btn btn-xs btn-outline">Edit</a></div>
    </div></div>`
}

export function stagePipeline(currentStage, stages = null, clickable = false, onClickFn = '') {
  const stageKeys = stages || Object.keys(STAGE_COLORS)
  const activeIdx = stageKeys.indexOf(currentStage)
  const pills = stageKeys.map((key, i) => {
    const s = STAGE_COLORS[key] || { bg: '#f3f4f6', text: '#4b5563', label: key }
    const cls = i === activeIdx ? 'spl-current' : i < activeIdx ? 'spl-past' : 'spl-future'
    const click = clickable ? ` spl-clickable" data-action="${onClickFn}" data-args='["${key}"]'` : '"'
    return `<div class="spl-pill ${cls}" data-stage="${key}"${click} style="background:${s.bg};color:${s.text}">${s.label}</div>`
  }).join('')
  return `<div class="stage-pipeline">${pills}</div>`
}

export function activityTimeline(activities = [], showAll = false) {
  const maxItems = showAll ? activities.length : 10
  const items = activities.slice(0, maxItems)
  const iconMap = { created: '&#43;', updated: '&#9998;', status_changed: '&#9679;', commented: '&#128172;', assigned: '&#128100;', uploaded: '&#128206;' }
  const timelineItems = items.map(a => {
    const action = a.action || 'updated'
    const icon = iconMap[action] || '&#9679;'
    const ts = a.timestamp || a.created_at
    const timeStr = ts ? (typeof ts === 'number' && ts > 1e9 ? new Date(ts * 1000).toLocaleString() : new Date(ts).toLocaleString()) : ''
    return `<div class="act-tl-item"><div class="act-tl-icon act-tl-${action}">${icon}</div><div class="act-tl-content"><div class="act-tl-header"><span class="act-tl-desc">${a.description || a.action || ''}</span></div><div class="act-tl-time">${timeStr}${a.user_name ? ' by ' + a.user_name : ''}</div></div></div>`
  }).join('')
  const moreBtn = !showAll && activities.length > maxItems ? `<div class="act-tl-more"><button class="btn btn-ghost btn-sm" data-action="showAllActivity" aria-label="Show ${activities.length - maxItems} more activities">Show ${activities.length - maxItems} more</button></div>` : ''
  return `<div class="act-timeline">${timelineItems}</div>${moreBtn}`
}

export function splashScreen(domain) {
  const isFriday = domain === 'friday'
  const name = isFriday ? 'Friday' : 'MyWorkReview'
  const color = isFriday ? '#3b82f6' : '#8b5cf6'
  const initial = isFriday ? 'F' : 'M'
  return `<div id="splash-screen" class="splash-screen" style="--splash-color:${color}"><div class="splash-content"><div class="splash-logo" style="background:${color}">${initial}</div><div class="splash-name">${name}</div><div class="splash-spinner"><div class="splash-spinner-ring"></div></div></div></div><script>(function(){window.addEventListener('load',function(){var s=document.getElementById('splash-screen');if(s){setTimeout(function(){s.classList.add('splash-hide');setTimeout(function(){s.remove()},400)},600)}})})()</script>`
}

export function swUpdateBanner() {
  return `<div id="sw-update-banner" class="sw-banner" style="display:none"><span class="sw-banner-text">A new version is available.</span><button class="btn btn-sm btn-primary sw-banner-btn" data-action="swDoUpdate" aria-label="Update to new version">Update</button><button class="btn btn-sm btn-ghost sw-banner-btn" data-action="swDismiss" aria-label="Dismiss update notification">Dismiss</button></div><script>(function(){function show(){document.getElementById('sw-update-banner').style.display='flex'}window.swDoUpdate=function(){window.location.reload()};window.swDismiss=function(){document.getElementById('sw-update-banner').style.display='none'};if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('controllerchange',show);navigator.serviceWorker.getRegistration().then(function(reg){if(reg)reg.addEventListener('updatefound',function(){var nw=reg.installing;if(nw)nw.addEventListener('statechange',function(){if(nw.state==='installed'&&navigator.serviceWorker.controller)show()})})})}})()</script>`
}
