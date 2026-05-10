import { statusLabel, linearProgress, circularProgress, engagementProgress } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { SPACING } from '@/ui/spacing-system.js';

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString();
  return String(ts);
}

function engagementProgressCard(engagement) {
  const e = engagement;
  const pct = typeof e.progress === 'number' ? e.progress : 0;
  const stage = e.stage || 'info_gathering';
  const sts = e.status ? statusLabel(e.status) : '';
  const dueDate = fmtDate(e.deadline || e.due_date);
  const rfiProgress = e.rfi_completed !== undefined && e.rfi_total !== undefined
    ? linearProgress(e.rfi_completed, e.rfi_total, `RFI: ${e.rfi_completed}/${e.rfi_total}`, 'thin')
    : '';
  const clientProgress = typeof e.client_progress === 'number'
    ? linearProgress(e.client_progress, 100, 'Client', 'thin')
    : '';

  return `<div class="card-clean" style="margin-bottom:${SPACING.md}"><div class="card-clean-body"><div class="flex items-start justify-between" style="margin-bottom:${SPACING.md}"><div><a href="/engagement/${e.id}" class="font-medium hover:text-blue-600">${e.name || 'Untitled'}</a><div class="text-xs text-gray-500" style="margin-top:${SPACING.xs}">${e.engagement_type || ''} ${e.year ? '&middot; ' + e.year : ''}</div></div><div class="flex items-center gap-2">${sts}</div></div><div style="margin-bottom:${SPACING.md}">${engagementProgress(stage)}</div><div class="grid grid-cols-2 gap-4 text-sm" style="margin-bottom:${SPACING.md}"><div><span class="text-gray-500">Deadline:</span> <span class="font-medium">${dueDate}</span></div><div><span class="text-gray-500">Progress:</span> <span class="font-medium">${pct}%</span></div></div>${rfiProgress}${clientProgress}</div></div>`;
}

export function renderClientProgress(user, client, engagements, rfiStats) {
  const totalEngagements = engagements.length;
  const activeEngagements = engagements.filter(e => e.status === 'active').length;
  const completedEngagements = engagements.filter(e => e.status === 'completed' || e.status === 'closed').length;
  const avgProgress = totalEngagements > 0
    ? Math.round(engagements.reduce((sum, e) => sum + (e.progress || 0), 0) / totalEngagements)
    : 0;

  const totalRfis = rfiStats?.total || 0;
  const respondedRfis = rfiStats?.responded || 0;
  const overdueRfis = rfiStats?.overdue || 0;

  const statCards = `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">${[
    { label: 'Engagements', value: totalEngagements, sub: `${activeEngagements} active` },
    { label: 'Avg Progress', value: avgProgress + '%', sub: `${completedEngagements} completed` },
    { label: 'RFI Items', value: totalRfis, sub: `${respondedRfis} responded` },
    { label: 'Overdue', value: overdueRfis, sub: overdueRfis > 0 ? 'Action needed' : 'On track', color: overdueRfis > 0 ? 'red' : 'green' },
  ].map(s => `<div class="card-clean" style="${s.color === 'red' ? 'border-left:4px solid var(--color-danger,#ef4444)' : ''}"><div class="card-clean-body" style="padding:0.75rem"><h3 class="text-gray-500 text-sm">${s.label}</h3><p class="text-xl font-bold${s.color ? ` text-${s.color}-600` : ''}">${s.value}</p><p class="text-xs text-gray-400">${s.sub}</p></div></div>`).join('')}</div>`;

  const overallProgress = `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><div class="flex items-center justify-between"><div><h3 class="font-semibold mb-1">${client.name}</h3><p class="text-sm text-gray-500">${client.entity_type || ''} ${client.status ? '&middot; ' + client.status : ''}</p></div><div>${circularProgress(avgProgress, 100, 'Overall')}</div></div></div></div>`;

  const stageBreakdown = {};
  engagements.forEach(e => {
    const s = e.stage || 'unknown';
    stageBreakdown[s] = (stageBreakdown[s] || 0) + 1;
  });
  const stageTable = `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-3">Stage Breakdown</h3><div class="grid grid-cols-2 md:grid-cols-3 gap-2">${Object.entries(stageBreakdown).map(([k, v]) => `<div class="flex items-center justify-between p-2 bg-gray-50 rounded"><span class="text-sm text-gray-700">${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span><span class="font-semibold text-sm">${v}</span></div>`).join('')}</div></div></div>`;

  const engList = engagements.length > 0
    ? engagements.map(e => engagementProgressCard(e)).join('')
    : '<div class="text-center py-12 text-gray-400">No engagements for this client</div>';

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Client Progress</h1><div class="flex gap-2"><a href="/client/${client.id}/dashboard" class="btn btn-ghost btn-sm">Dashboard</a><a href="/client/${client.id}" class="btn btn-ghost btn-sm">Client Details</a></div></div>${overallProgress}${statCards}${stageTable}<h2 class="text-lg font-semibold mb-4">Engagement Details</h2>${engList}`;

  return page(user, `${client.name} - Progress`, [
    { href: '/', label: 'Dashboard' },
    { href: '/client', label: 'Clients' },
    { href: `/client/${client.id}`, label: client.name },
    { label: 'Progress' }
  ], content);
}
