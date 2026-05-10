import { page } from '@/ui/layout.js';
import { esc, TOAST_SCRIPT } from '@/ui/render-helpers.js';

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(typeof ts === 'number' && ts < 2e10 ? ts * 1000 : ts).toLocaleString();
}

function notifRow(n) {
  const isRead = !!n.read_at;
  const typeLabels = { review_notification: 'Review', highlight_response: 'Highlight', rfi_response: 'RFI', general: 'General' };
  const typeLabel = typeLabels[n.type] || n.type || '-';
  const entityLink = n.entity_type === 'review' && n.entity_id
    ? `<a href="/review/${esc(n.entity_id)}" class="text-primary text-sm" style="text-decoration:underline">View</a>`
    : '';
  return `<tr class="hover${isRead ? ' opacity-60' : ''}" data-notif-id="${esc(n.id)}">
    <td class="text-xs text-base-content/40 w-32">${fmtDate(n.created_at)}</td>
    <td class="text-xs"><span class="badge badge-flat-secondary">${esc(typeLabel)}</span></td>
    <td class="text-sm max-w-md">${esc(n.message || '-')}</td>
    <td>${entityLink}</td>
    <td>${isRead ? '<span class="text-xs text-base-content/30">Read</span>' : `<button onclick="markRead('${esc(n.id)}')" class="btn btn-ghost btn-xs">Mark read</button>`}</td>
  </tr>`;
}

export function renderNotificationsPage(user, notifs = []) {
  const rows = notifs.map(notifRow).join('') ||
    `<tr><td colspan="5" class="text-center py-8 text-base-content/40 text-sm">No notifications</td></tr>`;

  const content = `
    <div class="page-header">
      <h1 class="page-title">Notifications</h1>
      <button onclick="markAllRead()" class="btn btn-ghost btn-sm">Mark All Read</button>
    </div>
    <div class="card-clean">
      <div class="card-clean-body">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Time</th><th>Type</th><th>Message</th><th></th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const script = `${TOAST_SCRIPT}
async function markRead(id){try{await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id})});var row=document.querySelector('[data-notif-id="'+id+'"]');if(row){row.classList.add('opacity-60');var btn=row.querySelector('button');if(btn)btn.replaceWith(document.createTextNode('Read'))}var count=document.getElementById('notif-count');if(count){var c=parseInt(count.textContent||'0',10)-1;if(c<=0)count.style.display='none';else count.textContent=c}}catch(e){showToast('Error','error')}}
async function markAllRead(){try{await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({})});document.querySelectorAll('[data-notif-id]').forEach(function(row){row.classList.add('opacity-60');var btn=row.querySelector('button');if(btn)btn.replaceWith(document.createTextNode('Read'))});var count=document.getElementById('notif-count');if(count)count.style.display='none';showToast('All marked read','success')}catch(e){showToast('Error','error')}}`;

  return page(user, 'Notifications | Moonlanding', null, content, [script]);
}
