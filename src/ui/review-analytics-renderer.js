import { statusLabel, linearProgress, circularProgress } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';

function statCard(label, value, sub, color) {
  const borderClass = color ? ` border-l-4 border-${color}-500` : '';
  const textClass = color ? ` text-${color}-600` : '';
  return `<div class="card-clean"><div class="card-clean-body"><h3 class="text-gray-500 text-sm">${label}</h3><p class="text-2xl font-bold${textClass}">${value}</p>${sub ? `<p class="text-xs text-gray-500 mt-1">${sub}</p>` : ''}</div></div>`;
}

function barChart(data, maxVal, label) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  const bars = data.map(d => {
    const pct = Math.round((d.value / max) * 100);
    return `<div class="flex items-center gap-2 mb-2"><span class="text-xs text-gray-600 w-24 text-right truncate" title="${d.label}">${d.label}</span><div class="flex-1 bg-gray-100 rounded-full h-5 relative"><div class="h-5 rounded-full" style="width:${pct}%;background:${d.color || '#3b82f6'}"></div><span class="absolute right-2 top-0 text-xs leading-5 text-gray-700">${d.value}</span></div></div>`;
  }).join('');
  return `<div class="mb-2">${label ? `<div class="text-sm font-medium text-gray-700 mb-3">${label}</div>` : ''}${bars}</div>`;
}

function distributionRing(segments, total, centerLabel) {
  let offset = 0;
  const r = 60, circ = 2 * Math.PI * r;
  const rings = segments.map(s => {
    const pct = total > 0 ? s.value / total : 0;
    const dash = circ * pct;
    const gap = circ - dash;
    const ring = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" stroke-linecap="butt"/>`;
    offset += dash;
    return ring;
  }).join('');
  const legend = segments.map(s => `<div class="flex items-center gap-2"><span style="width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block"></span><span class="text-xs text-gray-600">${s.label}: ${s.value}</span></div>`).join('');
  return `<div class="flex items-center gap-6"><svg width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="16"/>${rings}<text x="80" y="75" text-anchor="middle" fill="#374151" font-size="20" font-weight="600">${total}</text><text x="80" y="95" text-anchor="middle" fill="#9ca3af" font-size="11">${centerLabel}</text></svg><div class="flex flex-col gap-1">${legend}</div></div>`;
}

export function renderReviewAnalytics(user, stats) {
  const { reviews = [], highlights = [], recentActivity = [] } = stats;

  const totalReviews = reviews.length;
  const activeReviews = reviews.filter(r => r.status === 'active' || r.status === 'open' || r.status === 'in_progress').length;
  const completedReviews = reviews.filter(r => r.status === 'completed' || r.status === 'closed').length;
  const totalHighlights = highlights.length;
  const resolvedHighlights = highlights.filter(h => h.status === 'resolved').length;
  const unresolvedHighlights = totalHighlights - resolvedHighlights;
  const completionRate = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;
  const resolutionRate = totalHighlights > 0 ? Math.round((resolvedHighlights / totalHighlights) * 100) : 0;

  const cards = `<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">${statCard('Total Reviews', totalReviews, `${activeReviews} active`)}${statCard('Completion Rate', completionRate + '%', `${completedReviews} completed`)}${statCard('Highlights', totalHighlights, `${resolvedHighlights} resolved`)}${statCard('Resolution Rate', resolutionRate + '%', `${unresolvedHighlights} open`, unresolvedHighlights > 0 ? 'yellow' : 'green')}</div>`;

  const statusData = [
    { label: 'Active', value: activeReviews, color: '#3b82f6' },
    { label: 'Completed', value: completedReviews, color: '#22c55e' },
    { label: 'Archived', value: reviews.filter(r => r.status === 'archived').length, color: '#9ca3af' },
    { label: 'Draft', value: reviews.filter(r => r.status === 'draft').length, color: '#d1d5db' },
  ].filter(s => s.value > 0);

  const highlightData = [
    { label: 'Resolved', value: resolvedHighlights, color: '#22c55e' },
    { label: 'Partial', value: highlights.filter(h => h.status === 'partial_resolved').length, color: '#f59e0b' },
    { label: 'Unresolved', value: highlights.filter(h => h.status !== 'resolved' && h.status !== 'partial_resolved').length, color: '#ef4444' },
  ].filter(s => s.value > 0);

  const reviewsByCreator = {};
  reviews.forEach(r => { const c = r.creator_name || r.created_by || 'Unknown'; reviewsByCreator[c] = (reviewsByCreator[c] || 0) + 1; });
  const creatorData = Object.entries(reviewsByCreator).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, color: '#6366f1' }));

  const charts = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"><div class="card-clean"><div class="card-clean-body"><h3 class="font-semibold mb-4">Review Status</h3>${distributionRing(statusData, totalReviews, 'Reviews')}</div></div><div class="card-clean"><div class="card-clean-body"><h3 class="font-semibold mb-4">Highlight Resolution</h3>${distributionRing(highlightData, totalHighlights, 'Highlights')}</div></div></div>`;

  const creatorChart = creatorData.length > 0 ? `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-4">Reviews by Creator</h3>${barChart(creatorData, 0, '')}</div></div>` : '';

  const activityRows = recentActivity.slice(0, 15).map(a => {
    const date = a.created_at ? (typeof a.created_at === 'number' ? new Date(a.created_at * 1000).toLocaleDateString() : a.created_at) : '-';
    return `<tr><td class="text-sm">${a.description || a.action || '-'}</td><td class="text-sm text-gray-500">${a.user_name || '-'}</td><td class="text-xs text-gray-400">${date}</td></tr>`;
  }).join('');
  const activityTable = `<div class="card-clean"><div class="card-clean-body"><h3 class="font-semibold mb-4">Recent Activity</h3><table class="data-table"><thead><tr><th>Action</th><th>User</th><th>Date</th></tr></thead><tbody>${activityRows || '<tr><td colspan="3" class="text-center py-4 text-gray-400">No recent activity</td></tr>'}</tbody></table></div></div>`;

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Review Analytics</h1><a href="/reviews" class="btn btn-ghost btn-sm">Back to Reviews</a></div>${cards}${charts}${creatorChart}${activityTable}`;

  return page(user, 'Review Analytics | Moonlanding', [{ href: '/', label: 'Dashboard' }, { href: '/reviews', label: 'Reviews' }, { label: 'Analytics' }], content);
}
