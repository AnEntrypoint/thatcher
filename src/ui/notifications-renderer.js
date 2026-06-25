import { page } from '@/ui/layout.js';
import { esc, TOAST_SCRIPT, emptyRow } from '@/ui/render-helpers.js';

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(typeof ts === 'number' && ts < 2e10 ? ts * 1000 : ts).toLocaleString('en-ZA');
}

function notifRow(n) {
  const isRead = !!n.read_at;
  const typeLabels = { review_notification: 'Review', highlight_response: 'Highlight', rfi_response: 'RFI', general: 'General' };
  const typeLabel = typeLabels[n.type] || n.type || '-';
  const entityLink = n.entity_type === 'review' && n.entity_id
    ? `<a href="/review/${esc(n.entity_id)}" class="text-sm" style="text-decoration:underline;color:var(--color-primary)">View</a>`
    : '';
  return `<tr class="hover${isRead ? ' is-read' : ''}" data-notif-id="${esc(n.id)}" data-notif-row="true">
    <td class="text-xs text-base-content/60 w-32">${fmtDate(n.created_at)}</td>
    <td class="text-xs"><span class="badge badge-flat-secondary">${esc(typeLabel)}</span></td>
    <td class="text-sm max-w-md">${esc(n.message || '-')}</td>
    <td>${entityLink}</td>
    <td>${isRead ? '<span class="text-xs text-base-content/70">Read</span>' : `<button data-action="markRead" data-args='["${esc(n.id)}"]' class="btn btn-ghost btn-xs">Mark read</button>`}</td>
  </tr>`;
}

export function renderNotificationsPage(user, notifs = []) {
  const rows = notifs.map(notifRow).join('') || emptyRow(5, 'No notifications');

  const content = `
    <div class="page-header">
      <h1 class="page-title">Notifications</h1>
      <button data-action="markAllRead" class="btn btn-primary-clean btn-sm">Mark All Read</button>
    </div>
    <div class="card-clean">
      <div class="card-clean-body">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Time</th><th>Type</th><th>Message</th><th>Link</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const script = `${TOAST_SCRIPT}
window.markRead=async function(id){var row=document.querySelector('[data-notif-id="'+id+'"]');var b=row&&row.querySelector('button[data-action="markRead"]');if(b){if(b.disabled)return;b.disabled=true}try{await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id})});if(row){row.classList.add('is-read');if(b)b.replaceWith(document.createTextNode('Read'))}var count=document.getElementById('notif-count');if(count){var c=parseInt(count.textContent||'0',10)-1;if(c<=0)count.style.display='none';else count.textContent=c}}catch(e){if(b)b.disabled=false;showToast('Error','error')}};
window.markAllRead=async function(){var b=document.querySelector('button[data-action="markAllRead"]');if(b){if(b.disabled)return;window.loadingBtn(b,true,'Marking...')}try{await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({})});document.querySelectorAll('[data-notif-id]').forEach(function(row){row.classList.add('is-read');var btn=row.querySelector('button');if(btn)btn.replaceWith(document.createTextNode('Read'))});var count=document.getElementById('notif-count');if(count)count.style.display='none';showToast('All marked read','success')}catch(e){if(b)window.loadingBtn(b,false);showToast('Error','error')}};
document.querySelectorAll('[data-notif-row]').forEach(function(row){row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();var btn=row.querySelector('button[data-action="markRead"]');if(btn)btn.click();else window.markRead(row.getAttribute('data-notif-id'))}})});`;

  return page(user, 'Notifications | Thatcher', null, content, [script]);
}
