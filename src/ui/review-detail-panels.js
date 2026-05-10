import { esc } from '@/ui/render-helpers.js';

export function highlightRow(h) {
  const resolved = h.resolved || h.status === 'resolved';
  const badge = resolved
    ? '<span class="pill pill-success">Resolved</span>'
    : '<span class="pill pill-warning">Open</span>';
  const rowStyle = resolved ? 'opacity:0.6' : '';
  const textStyle = resolved ? 'text-decoration:line-through;color:var(--color-text-muted)' : 'font-weight:500';

  let flags = [];
  let tags = [];
  try { flags = JSON.parse(h.flags || '[]') || []; } catch {}
  try { tags = JSON.parse(h.tags || '[]') || []; } catch {}
  const isFlagged = flags.includes('flagged');

  const flagBtn = `<button data-action="toggleFlag" data-args='["${esc(h.id)}","${isFlagged}"]' title="${isFlagged ? 'Unflag' : 'Flag'}" style="background:none;border:none;cursor:pointer;padding:2px 4px;font-size:15px;line-height:1;color:${isFlagged ? '#f59e0b' : 'var(--color-text-muted)'}">${isFlagged ? '⚑' : '⚐'}</button>`;
  const tagPills = tags.map(t => `<span style="display:inline-flex;align-items:center;gap:3px;background:#eff6ff;color:#1d4ed8;font-size:11px;padding:1px 6px;border-radius:9999px;font-weight:500">${esc(t)}<button data-action="removeTag" data-args='["${esc(h.id)}","${esc(t)}"]' style="background:none;border:none;cursor:pointer;padding:0;margin-left:2px;font-size:11px;color:#6b7280;line-height:1">&times;</button></span>`).join(' ');
  const addTagBtn = `<button data-action="openAddTag" data-args='["${esc(h.id)}"]' style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--color-text-muted);padding:1px 5px;border:1px dashed var(--color-border,#e5e7eb);border-radius:9999px">+tag</button>`;
  const tagsCell = `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;min-width:80px">${tagPills}${addTagBtn}</div>`;

  return `<tr style="${rowStyle}" data-highlight-id="${esc(h.id)}" data-flagged="${isFlagged}" data-section-id="${esc(h.section_id||'')}">
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${textStyle}">${flagBtn}${esc(h.text||h.content||h.comment||'Highlight')}</td>
    <td style="font-size:13px;color:var(--color-text-muted);white-space:nowrap">p.${h.page||h.page_number||'-'}</td>
    <td>${badge}</td>
    <td>${tagsCell}</td>
    <td style="font-size:13px;color:var(--color-text-muted)">${esc(h.created_by_name||h.user_id||'-')}</td>
    <td style="text-align:right">${!resolved ? `<button data-action="resolveHighlight" data-args='["${esc(h.id)}"]' class="btn-primary-clean" style="font-size:12px;padding:4px 12px;min-height:28px">Resolve</button>` : '<span style="font-size:12px;color:var(--color-text-muted)">Done</span>'}</td>
  </tr>`;
}

export function collaboratorRow(c) {
  const initials = (c.user_name || c.email || '?').charAt(0).toUpperCase();
  const colors = ['#1565c0','#2e7d32','#6a1b9a','#c62828','#e65100','#00695c'];
  const bg = colors[(c.user_name || c.email || '').charCodeAt(0) % colors.length] || colors[0];
  return `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${initials}</div>
        <span style="font-size:14px">${esc(c.user_name||c.email||c.user_id||'-')}</span>
      </div>
    </td>
    <td><span class="pill pill-info" style="text-transform:capitalize">${esc(c.role||'viewer')}</span></td>
    <td style="font-size:13px;color:var(--color-text-muted)">${c.expires_at?new Date(typeof c.expires_at==='number'?c.expires_at*1000:c.expires_at).toLocaleDateString():'-'}</td>
    <td style="text-align:right"><button data-action="removeCollaborator" data-args='["${esc(c.id)}"]' class="btn-danger-clean" style="font-size:12px;padding:4px 10px;min-height:28px">Remove</button></td>
  </tr>`;
}

export function addCollaboratorDialog(reviewId) {
  return `<div id="collab-dialog" class="dialog-overlay" style="display:none" data-dialog-close-overlay="true">
    <div class="dialog-panel" style="max-width:400px;width:100%">
      <h3 style="font-size:16px;font-weight:600;color:var(--color-text);margin:0 0 16px">Add Collaborator</h3>
      <div class="form-field" style="margin-bottom:12px">
        <label class="form-label">Email</label>
        <input type="email" id="collab-email" class="form-input" placeholder="collaborator@example.com"/>
      </div>
      <div class="form-field" style="margin-bottom:16px">
        <label class="form-label">Role</label>
        <select id="collab-role" class="form-input">
          <option value="viewer">Viewer</option>
          <option value="commenter">Commenter</option>
          <option value="editor">Editor</option>
        </select>
      </div>
      <div class="form-actions" style="padding-top:0;margin-top:0">
        <button data-dialog-close="collab-dialog" class="btn-ghost-clean" style="font-size:13px;padding:8px 16px">Cancel</button>
        <button data-action="addCollaborator" data-args='["${esc(reviewId)}"]' class="btn-primary-clean" style="font-size:13px;padding:8px 16px">Add</button>
      </div>
    </div>
  </div>`;
}
