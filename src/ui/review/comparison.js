import { statusLabel } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { emptyRow, esc } from '../render-helpers.js';

function reviewSummaryPanel(review, highlights, _side) {
  const total = highlights.length;
  const resolved = highlights.filter(h => h.status === 'resolved').length;
  const sts = review.status ? statusLabel(review.status) : '';
  return `<div class="p-4 bg-gray-50 border-b border-gray-200"><div class="flex items-center justify-between mb-2"><span class="font-medium text-sm">${esc(review.name || 'Untitled')}</span>${sts}</div><div class="grid grid-cols-3 gap-2 text-xs"><div class="text-center"><div class="font-bold text-lg">${total}</div><div class="text-gray-500">Highlights</div></div><div class="text-center"><div class="font-bold text-lg text-green-600">${resolved}</div><div class="text-gray-500">Resolved</div></div><div class="text-center"><div class="font-bold text-lg text-red-600">${total - resolved}</div><div class="text-gray-500">Open</div></div></div></div>`;
}

function highlightDiffRow(leftH, rightH, idx) {
  const renderSide = (h) => {
    if (!h) return '<td class="p-2 bg-gray-50 text-center text-xs text-gray-400">-</td>';
    const colors = { resolved: 'var(--color-success)', partial_resolved: 'var(--color-warning)' };
    const color = colors[h.status] || 'var(--color-danger)';
    return `<td class="p-2 border-b border-gray-50"><div class="flex items-center gap-1"><span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block"></span><span class="text-xs">${h.text || h.content || 'Area'}</span></div><div class="text-xs text-gray-400">p.${h.page_number || '?'}</div></td>`;
  };
  const match = leftH && rightH && leftH.text === rightH?.text ? 'bg-green-50' : leftH && rightH ? 'bg-yellow-50' : 'bg-red-50';
  return `<tr class="${match}"><td class="p-2 text-xs text-gray-400 text-center border-b border-gray-100">${idx + 1}</td>${renderSide(leftH)}${renderSide(rightH)}<td class="p-2 text-xs text-center border-b border-gray-100">${leftH && rightH ? (leftH.status === rightH.status ? '<span class="text-green-600">Same</span>' : '<span class="text-yellow-600">Changed</span>') : '<span class="text-red-600">Missing</span>'}</td></tr>`;
}

function diffStats(leftHighlights, rightHighlights) {
  const leftTexts = new Set(leftHighlights.map(h => h.text || ''));
  const rightTexts = new Set(rightHighlights.map(h => h.text || ''));
  const common = [...leftTexts].filter(t => rightTexts.has(t)).length;
  const onlyLeft = leftHighlights.length - common;
  const onlyRight = rightHighlights.length - common;
  return { common, onlyLeft, onlyRight };
}

export function renderReviewComparison(user, leftReview, rightReview, leftHighlights, rightHighlights) {
  const stats = diffStats(leftHighlights, rightHighlights);
  const maxLen = Math.max(leftHighlights.length, rightHighlights.length);
  const rows = Array.from({ length: maxLen }, (_, i) =>
    highlightDiffRow(leftHighlights[i], rightHighlights[i], i)
  ).join('');

  const diffSummary = `<div class="grid grid-cols-3 gap-4 mb-6"><div class="card-clean"><div class="card-clean-body" style=""><div class="text-lg font-bold text-green-600">${stats.common}</div><div class="text-xs text-gray-500">Matching</div></div></div><div class="card-clean"><div class="card-clean-body" style=""><div class="text-lg font-bold text-blue-600">${stats.onlyLeft}</div><div class="text-xs text-gray-500">Only in Left</div></div></div><div class="card-clean"><div class="card-clean-body" style=""><div class="text-lg font-bold text-purple-600">${stats.onlyRight}</div><div class="text-xs text-gray-500">Only in Right</div></div></div></div>`;

  const comparisonTable = `<div class="card-clean" style="overflow-x:auto"><div class="card-clean-body" style="padding:0rem"><div class="grid grid-cols-2 gap-0"><div class="border-r border-gray-200">${reviewSummaryPanel(leftReview, leftHighlights, 'left')}</div><div>${reviewSummaryPanel(rightReview, rightHighlights, 'right')}</div></div><table class="data-table"><thead class="bg-gray-50"><tr><th class="text-center w-12">#</th><th>${esc(leftReview.name || 'Left Review')}</th><th>${esc(rightReview.name || 'Right Review')}</th><th class="text-center w-20">Status</th></tr></thead><tbody>${rows || emptyRow(4, 'No highlights to compare')}</tbody></table></div></div>`;

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Review Comparison</h1><a href="/reviews" class="btn btn-ghost btn-sm">Back to Reviews</a></div>${diffSummary}${comparisonTable}`;

  return page(user, 'Review Comparison | Thatcher', [
    { href: '/', label: 'Dashboard' },
    { href: '/reviews', label: 'Reviews' },
    { label: 'Comparison' }
  ], content);
}

export function renderComparisonPicker(user, reviews) {
  const reviewOptions = reviews.map(r => `<option value="${esc(String(r.id))}">${esc(r.name || r.title || 'Untitled')} ${r.status ? '(' + esc(r.status) + ')' : ''}</option>`).join('');
  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Compare Reviews</h1><a href="/reviews" class="btn btn-ghost btn-sm">Back to Reviews</a></div><div class="card-clean" style="margin:autorem"><div class="card-clean-body"><p class="text-sm text-gray-500 mb-4">Select two reviews to compare their highlights side by side.</p><div class="form-group mb-4"><label class="text-sm font-medium block mb-1" for="left-review">Left Review</label><select id="left-review" class="select select-bordered w-full">${reviewOptions}</select></div><div class="form-group mb-4"><label class="text-sm font-medium block mb-1" for="right-review">Right Review</label><select id="right-review" class="select select-bordered w-full">${reviewOptions}</select></div><button class="btn btn-primary w-full" data-action="startComparison">Compare</button></div></div>`;

  const script = `window.startComparison=function(){const l=document.getElementById('left-review')?.value;const r=document.getElementById('right-review')?.value;if(!l||!r)return showToast('Select both reviews','error');if(l===r)return showToast('Select different reviews','error');window.location='/reviews/compare?left='+l+'&right='+r}`;

  return page(user, 'Compare Reviews | Thatcher', [{ href: '/', label: 'Dashboard' }, { href: '/reviews', label: 'Reviews' }, { label: 'Compare' }], content, [script]);
}
