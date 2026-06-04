import { statusLabel } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { isPartner } from '@/ui/permissions-ui.js';
import { STATUS_COLORS, esc } from '@/ui/render-helpers.js';

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleString('en-ZA');
  return String(ts);
}

function jobStatusBadge(status) {
  const colors = {
    running: { ...STATUS_COLORS.active, icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>` },
    success: { ...STATUS_COLORS.completed, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' },
    failed: { ...STATUS_COLORS.rejected, icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` },
    scheduled: { ...STATUS_COLORS.pending, icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
    disabled: { ...STATUS_COLORS.draft, icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>` },
  };
  const c = colors[status] || colors.scheduled;
  return `<span style="background:${c.bg};color:${c.text};padding:2px 10px;border-radius:9999px;font-size:0.75rem;font-weight:500">${c.icon} ${(status || 'unknown').replace(/_/g, ' ')}</span>`;
}

function jobRow(job, canManage) {
  const lastRun = fmtDate(job.last_run_at);
  const nextRun = fmtDate(job.next_run_at);
  const duration = job.last_duration ? (job.last_duration < 1000 ? job.last_duration + 'ms' : Math.round(job.last_duration / 1000) + 's') : '-';
  const jobNameArg = esc(JSON.stringify(String(job.name)));
  const triggerBtn = canManage ? `<button class="btn btn-xs btn-primary" data-action="triggerJob" data-args='[${jobNameArg}]'>Run Now</button>` : '';
  const toggleBtn = canManage ? `<button class="btn btn-xs ${job.enabled !== false ? 'btn-warning' : 'btn-success'}" data-action="toggleJob" data-args='[${jobNameArg},${!job.enabled}]'>${job.enabled !== false ? 'Disable' : 'Enable'}</button>` : '';
  return `<tr><td class="font-medium">${esc(job.label || job.name)}</td><td>${esc(job.schedule || job.cron || '-')}</td><td>${jobStatusBadge(job.status || (job.enabled === false ? 'disabled' : 'scheduled'))}</td><td class="text-sm">${lastRun}</td><td class="text-sm">${nextRun}</td><td class="text-sm">${duration}</td><td class="text-sm">${esc(job.last_result || '-')}</td><td class="flex gap-1">${triggerBtn}${toggleBtn}</td></tr>`;
}

export function renderJobManagement(user, jobs, recentLogs = []) {
  const canManage = isPartner(user);
  const runningJobs = jobs.filter(j => j.status === 'running').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;
  const totalJobs = jobs.length;

  const statCards = `<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">${[
    { label: 'Total Jobs', value: totalJobs },
    { label: 'Running', value: runningJobs, color: runningJobs > 0 ? 'blue' : '' },
    { label: 'Failed', value: failedJobs, color: failedJobs > 0 ? 'red' : '' },
    { label: 'Healthy', value: totalJobs - failedJobs, color: 'green' },
  ].map(s => `<div class="card-clean"><div class="card-clean-body" style="padding:0.75rem 0"><h3 class="text-gray-600 dark:text-gray-500 text-sm">${s.label}</h3><p class="text-xl font-bold${s.color ? ` text-${s.color}-600 dark:text-${s.color}-400` : ''}">${s.value}</p></div></div>`).join('')}</div>`;

  const headers = '<th>Job</th><th>Schedule</th><th>Status</th><th>Last Run</th><th>Next Run</th><th>Duration</th><th>Result</th><th>Actions</th>';
  const rows = jobs.map(j => jobRow(j, canManage)).join('');
  const table = `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><h3 class="font-semibold mb-3">Scheduled Jobs</h3><div style="overflow-x:auto"><table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows || '<tr><td colspan="8" class="text-center py-8 text-gray-600 dark:text-gray-500">No jobs configured</td></tr>'}</tbody></table></div></div></div>`;

  const logRows = recentLogs.slice(0, 20).map(l => {
    const sts = l.success ? '<span class="text-green-600 dark:text-green-400">OK</span>' : '<span class="text-red-600 dark:text-red-400">FAIL</span>';
    return `<tr><td class="text-sm">${esc(l.job_name || '-')}</td><td>${sts}</td><td class="text-xs text-gray-600 dark:text-gray-500">${fmtDate(l.started_at)}</td><td class="text-xs">${l.duration ? l.duration + 'ms' : '-'}</td><td class="text-xs text-gray-600 dark:text-gray-500 max-w-xs truncate">${esc(l.message || '-')}</td></tr>`;
  }).join('');
  const logTable = `<div class="card-clean"><div class="card-clean-body"><h3 class="font-semibold mb-3">Recent Execution Logs</h3><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Job</th><th>Result</th><th>Time</th><th>Duration</th><th>Message</th></tr></thead><tbody>${logRows || '<tr><td colspan="5" class="text-center py-4 text-gray-600 dark:text-gray-500">No recent logs</td></tr>'}</tbody></table></div></div></div>`;

  const content = `<main><div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Scheduled Jobs</h1>${canManage ? '<button class="btn btn-primary btn-sm" data-action="triggerAll">Run All Now</button>' : ''}</div>${statCards}${table}${logTable}</main>`;

  const jobScript = `window.triggerJob=async function(name){try{const r=await fetch('/api/admin/jobs/'+name+'/trigger',{method:'POST'});if(r.ok){location.reload()}else{showToast('Trigger failed: '+(await r.text()),'error')}}catch(e){showToast(e.message,'error')}};window.toggleJob=async function(name,enabled){try{const r=await fetch('/api/admin/jobs/'+name,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});if(r.ok)location.reload();else showToast('Toggle failed','error')}catch(e){showToast(e.message,'error')}};window.triggerAll=async function(){if(!(await window.gmConfirm({title:'Please confirm',message:'Run all jobs now?',danger:false,confirmLabel:'OK'})))return;try{const r=await fetch('/api/admin/jobs/trigger-all',{method:'POST'});if(r.ok)location.reload();else showToast('Failed','error')}catch(e){showToast(e.message,'error')}}`;

  return page(user, 'Scheduled Jobs | Thatcher', [{ href: '/', label: 'Dashboard' }, { href: '/admin/settings', label: 'Settings' }, { label: 'Jobs' }], content, [jobScript]);
}
