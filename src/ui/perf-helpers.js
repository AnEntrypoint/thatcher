import { memoize } from '@/lib/render-cache.js'

export const renderLargeList = memoize(function renderLargeList(items, renderFn, options = {}) {
  const { chunkSize = 100, useVirtual = false } = options
  if (!items || items.length === 0) return ''
  if (items.length <= chunkSize || !useVirtual) {
    return items.map(renderFn).join('')
  }
  const visible = items.slice(0, chunkSize)
  const deferred = items.slice(chunkSize)
  return visible.map(renderFn).join('') +
    `<tr class="defer-load" data-count="${deferred.length}"><td colspan="99" class="text-center text-gray-500 py-4">Loading ${deferred.length} more...</td></tr>`
})

export const batchRender = memoize(function batchRender(items, renderFn, batchSize = 50) {
  if (!items || items.length === 0) return ''
  const batches = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches.map((batch, idx) => {
    const html = batch.map(renderFn).join('')
    if (idx === 0) return html
    return `<div class="defer-load" data-content="${escapeAttr(html)}"></div>`
  }).join('')
})

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function eventDelegation(containerId, selector, eventType, handlerCode) {
  return `
(function(){
const c=document.getElementById('${containerId}');
if(!c)return;
c.addEventListener('${eventType}',function(e){
  const t=e.target.closest('${selector}');
  if(t){${handlerCode}}
});
})();
`.trim()
}

export function optimizeTableScroll(tableId) {
  return `
(function(){
const t=document.getElementById('${tableId}');
if(!t)return;
let ticking=false;
t.addEventListener('scroll',()=>{
  if(!ticking){
    requestAnimationFrame(()=>{
      ticking=false;
    });
    ticking=true;
  }
});
})();
`.trim()
}

export const styleFragment = memoize(function styleFragment(styles) {
  return `<style>${Object.entries(styles).map(([k, v]) => `${k}{${v}}`).join('')}</style>`
})

export function minifyHtml(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+>/g, '>')
    .replace(/<\s+/g, '<')
    .trim()
}

export const progressiveEnhance = memoize(function progressiveEnhance(baseHtml, enhancedHtml) {
  return baseHtml + `<noscript>${enhancedHtml}</noscript>`
})

export function createSkeleton(type = 'list', count = 3) {
  if (type === 'list') {
    return Array(count).fill(0).map(() =>
      `<div class="skeleton-row" style="height:48px;background:#f3f4f6;margin:8px 0;border-radius:4px;animation:pulse 1.5s ease-in-out infinite"></div>`
    ).join('')
  }
  if (type === 'card') {
    return Array(count).fill(0).map(() =>
      `<div class="skeleton-card" style="width:100%;height:200px;background:#f3f4f6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite"></div>`
    ).join('')
  }
  return ''
}

export function perfBudget(key, maxMs) {
  return `performance.mark('${key}-start');(window.requestIdleCallback||function(cb){setTimeout(cb,1)})(()=>{performance.mark('${key}-end');const m=performance.measure('${key}','${key}-start','${key}-end');if(m.duration>${maxMs})console.warn('[PERF] ${key} exceeded budget: '+m.duration.toFixed(2)+'ms > ${maxMs}ms')});`
}
