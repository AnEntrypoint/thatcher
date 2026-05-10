import { statusLabel } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { canEdit } from '@/ui/permissions-ui.js';

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString();
  return String(ts);
}

function daysRemaining(deadline) {
  if (!deadline) return null;
  const dl = typeof deadline === 'number' ? deadline * 1000 : new Date(deadline).getTime();
  const now = Date.now();
  return Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
}

function deadlineBadge(days) {
  if (days === null) return '<span class="text-xs text-gray-400">No deadline</span>';
  if (days < 0) return `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:0.7rem;font-weight:600">${Math.abs(days)}d overdue</span>`;
  if (days <= 7) return `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:0.7rem;font-weight:600">${days}d left</span>`;
  return `<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:9999px;font-size:0.7rem;font-weight:600">${days}d left</span>`;
}

const TENDER_FLAGS = {
  open: { bg: '#dbeafe', text: '#1e40af', label: 'Open' },
  won: { bg: '#d1fae5', text: '#065f46', label: 'Won' },
  lost: { bg: '#fee2e2', text: '#991b1b', label: 'Lost' },
  missed: { bg: '#f3f4f6', text: '#6b7280', label: 'Missed' },
  declined: { bg: '#fef3c7', text: '#92400e', label: 'Declined' },
  awaiting: { bg: '#ede9fe', text: '#5b21b6', label: 'Awaiting Adjudication' },
};

function tenderFlagBadge(flag) {
  const f = TENDER_FLAGS[flag] || TENDER_FLAGS.open;
  return `<span style="background:${f.bg};color:${f.text};padding:2px 10px;border-radius:9999px;font-size:0.7rem;font-weight:600">${f.label}</span>`;
}

function tenderRow(tender) {
  const days = daysRemaining(tender.deadline_date);
  const flag = tender.flag || tender.status || 'open';
  return `<tr class="hover cursor-pointer" tabindex="0" role="link" data-navigate="/review/${tender.review_id}" onkeydown="if(event.key==='Enter'){window.location='/review/${tender.review_id}'}" data-flag="${flag}" data-overdue="${days !== null && days < 0 ? '1' : '0'}"><td class="font-medium">${tender.review_name || tender.name || 'Untitled'}</td><td>${tenderFlagBadge(flag)}</td><td>${fmtDate(tender.deadline_date)}</td><td>${deadlineBadge(days)}</td><td class="text-sm">${tender.contact_person || '-'}</td><td class="text-sm">${tender.price ? '$' + Number(tender.price).toLocaleString() : '-'}</td><td class="text-sm">${fmtDate(tender.announcement_date)}</td></tr>`;
}

export function renderTenderDashboard(user, tenders, reviews = []) {
  const canEditTender = canEdit(user, 'review');
  const total = tenders.length;
  const open = tenders.filter(t => (t.flag || t.status) === 'open').length;
  const overdue = tenders.filter(t => { const d = daysRemaining(t.deadline_date); return d !== null && d < 0; }).length;
  const won = tenders.filter(t => (t.flag || t.status) === 'won').length;
  const upcoming7 = tenders.filter(t => { const d = daysRemaining(t.deadline_date); return d !== null && d >= 0 && d <= 7; }).length;

  const statCards = `<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">${[
    { label: 'Total', value: total },
    { label: 'Open', value: open, color: 'blue' },
    { label: 'Due Soon', value: upcoming7, color: 'yellow' },
    { label: 'Overdue', value: overdue, color: overdue > 0 ? 'red' : '' },
    { label: 'Won', value: won, color: 'green' },
  ].map(s => `<div class="card-clean"><div class="card-clean-body" style="padding:0.75rem 0"><h3 class="text-gray-500 text-xs">${s.label}</h3><p class="text-xl font-bold${s.color ? ` text-${s.color}-600` : ''}">${s.value}</p></div></div>`).join('')}</div>`;

  const filterBar = `<div class="flex gap-2 mb-4 flex-wrap"><button class="btn btn-sm btn-primary" data-tender-filter="all" data-action="filterTenders" data-args='["all"]'>All (${total})</button>${Object.entries(TENDER_FLAGS).map(([k, v]) => {
    const cnt = tenders.filter(t => (t.flag || t.status) === k).length;
    return cnt > 0 ? `<button class="btn btn-sm btn-ghost" data-tender-filter="${k}" data-action="filterTenders" data-args='["${k}"]'>${v.label} (${cnt})</button>` : '';
  }).join('')}<button class="btn btn-sm btn-ghost ${overdue > 0 ? 'text-red-600' : ''}" data-tender-filter="overdue" data-action="filterTenders" data-args='["overdue"]'>Overdue (${overdue})</button></div>`;

  const headers = '<th>Review</th><th>Status</th><th>Deadline</th><th>Remaining</th><th>Contact</th><th>Price</th><th>Announcement</th>';
  const rows = tenders.sort((a, b) => {
    const da = daysRemaining(a.deadline_date);
    const db = daysRemaining(b.deadline_date);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  }).map(t => tenderRow(t)).join('');
  const table = `<div class="card-clean" style="overflow-x:auto"><table class="data-table"><thead><tr>${headers}</tr></thead><tbody id="tender-tbody">${rows || '<tr><td colspan="7" class="text-center py-8 text-gray-500">No tenders found</td></tr>'}</tbody></table></div>`;

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Tender Management</h1><a href="/reviews" class="btn btn-ghost btn-sm">Back to Reviews</a></div>${statCards}${filterBar}${table}`;

  const tenderScript = `window.filterTenders=function(f){document.querySelectorAll('[data-tender-filter]').forEach(b=>{b.classList.toggle('btn-primary',b.dataset.tenderFilter===f);b.classList.toggle('btn-ghost',b.dataset.tenderFilter!==f)});document.querySelectorAll('#tender-tbody tr').forEach(r=>{if(f==='all')r.style.display='';else if(f==='overdue')r.style.display=r.dataset.overdue==='1'?'':'none';else r.style.display=r.dataset.flag===f?'':'none'})}`;

  return page(user, 'Tenders | Moonlanding', [{ href: '/', label: 'Dashboard' }, { href: '/reviews', label: 'Reviews' }, { label: 'Tenders' }], content, [tenderScript]);
}
