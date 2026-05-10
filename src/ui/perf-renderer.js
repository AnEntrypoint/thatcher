import { memoize } from '@/lib/render-cache.js'
import { measure } from '@/lib/perf-monitor.js'
import { virtualScrollScript, lazyLoadImages, deferOffscreen } from '@/ui/virtual-scroll.js'
import { eventDelegation, perfBudget, createSkeleton } from '@/ui/perf-helpers.js'

export function optimizedListRender(items, renderFn, options = {}) {
  const { chunkSize = 100, containerId = 'list-container', enableVirtual = true } = options
  return measure('list-render', () => {
    if (!items || items.length === 0) return createSkeleton('list', 3)
    if (items.length <= chunkSize) return items.map(renderFn).join('')
    const visible = items.slice(0, chunkSize)
    const deferred = items.slice(chunkSize)
    return visible.map(renderFn).join('') +
      (enableVirtual && deferred.length > 0
        ? `<div class="defer-load" data-deferred="${deferred.length}"></div>`
        : deferred.map(renderFn).join(''))
  })
}

export function withPerformanceMonitoring(renderFn, name) {
  return function(...args) {
    return measure(name, () => renderFn(...args))
  }
}

export function withMemoization(renderFn) {
  return memoize(renderFn)
}

export function optimizedTableScripts(tableId, options = {}) {
  const { enableVirtual = false, enableDefer = true, rowHeight = 48, perfBudgetMs = 200 } = options
  const scripts = []
  if (enableVirtual) scripts.push(virtualScrollScript(tableId, rowHeight))
  if (enableDefer) scripts.push(deferOffscreen('.defer-load'))
  scripts.push(perfBudget(`${tableId}-render`, perfBudgetMs))
  scripts.push(lazyLoadImages())
  return scripts.filter(Boolean)
}

export function batchOperations(operations, batchSize = 10) {
  const batches = []
  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize))
  }
  return batches.map((batch, idx) => {
    if (idx === 0) return batch
    return { deferred: true, operations: batch }
  })
}

export function progressiveLoad(content, priority = 'high') {
  if (priority === 'high') return content
  return `<div class="defer-load" data-content="${escapeAttr(content)}"></div>`
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export const perfConfig = {
  tableChunkSize: 100,
  cardChunkSize: 50,
  virtualScrollThreshold: 200,
  deferLoadThreshold: 100,
  perfBudgets: {
    'list-render': 100,
    'table-render': 150,
    'card-render': 80,
    'page-render': 500
  }
}
