import { esc } from '@/ui/render-helpers.js';
import { SPACING, renderTable, renderButton } from '@/ui/spacing-system.js';

function fmtDate(ts) {
  if (!ts) return '-';
  const n = Number(ts);
  if (!isNaN(n) && n > 1e9 && n < 3e9) return new Date(n * 1000).toLocaleDateString();
  try { return new Date(ts).toLocaleDateString(); } catch { return String(ts); }
}

function fmtDateInput(ts) {
  if (!ts) return '';
  const n = Number(ts);
  const d = (!isNaN(n) && n > 1e9 && n < 3e9) ? new Date(n * 1000) : new Date(ts);
  return d.toISOString().slice(0, 10);
}

const TENDER_STATUS_COLORS = {
  open: { bg: '#dbeafe', text: '#1e40af', label: 'Open' },
  won: { bg: '#d1fae5', text: '#065f46', label: 'Won' },
  lost: { bg: '#fee2e2', text: '#991b1b', label: 'Lost' },
  closed: { bg: '#f3f4f6', text: '#6b7280', label: 'Closed' },
  awaiting: { bg: '#ede9fe', text: '#5b21b6', label: 'Awaiting' },
};

function tenderBadge(status) {
  const s = TENDER_STATUS_COLORS[status] || TENDER_STATUS_COLORS.open;
  return `<span style="background:${s.bg};color:${s.text};padding:2px 10px;border-radius:9999px;font-size:0.7rem;font-weight:600">${s.label}</span>`;
}

export function tenderPanelHtml(reviewId, tenders, canEdit, tablePanel) {
  const rows = tenders.map(t => `<tr>
    <td>${tenderBadge(t.status || 'open')}</td>
    <td style="font-size:13px">${fmtDate(t.deadline)}</td>
    <td style="font-size:13px">${esc(t.contact_person || '-')}</td>
    <td style="font-size:13px">${t.price ? 'R' + Number(t.price).toLocaleString() : '-'}</td>
    <td style="font-size:13px">${fmtDate(t.announcement_date)}</td>
    ${canEdit ? `<td><button class="btn-ghost-clean" style="font-size:12px;padding:3px 8px" data-action="openEditTender" data-args='["${esc(t.id)}","${esc(t.status||'open')}","${fmtDateInput(t.deadline)}","${fmtDateInput(t.announcement_date)}","${esc(t.contact_person||'')}","${esc(t.contact_number||'')}","${esc(t.contact_email||'')}","${esc(t.price||'')}"]'>Edit</button><button class="btn-ghost-clean" style="font-size:12px;padding:3px 8px;color:var(--color-danger,#dc2626)" data-action="deleteTender" data-args='["${esc(t.id)}"]'>Delete</button></td>` : '<td></td>'}
  </tr>`).join('');
  const addBtn = canEdit ? renderButton('+ Add Tender', { variant: 'primary', size: 'sm', action: 'openAddTender', args: [] }) : '';
  return tablePanel('tender', 'Tender Tracking', tenders.length || null, addBtn,
    ['Status', 'Deadline', 'Contact', 'Price', 'Announcement', ''], rows, 'No tenders added yet');
}

export function tenderDialog(reviewId) {
  return `<div id="tender-dialog" class="dialog-backdrop" style="display:none" data-dialog-close="tender-dialog">
    <div class="dialog" style="max-width:540px" onclick="event.stopPropagation()">
      <div class="dialog-header">
        <h2 id="tender-dialog-title" style="font-size:17px;font-weight:600;margin:0">Add Tender</h2>
        <button class="dialog-close" data-dialog-close="tender-dialog" aria-label="Close">&times;</button>
      </div>
      <div class="dialog-body" style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <input type="hidden" id="tender-id" value=""/>
        <div style="grid-column:span 2"><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Status</label>
          <select id="tender-status" class="input" style="width:100%"><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option><option value="closed">Closed</option><option value="awaiting">Awaiting Adjudication</option></select></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Deadline *</label><input id="tender-deadline" type="date" class="input" style="width:100%"/></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Announcement Date</label><input id="tender-announcement" type="date" class="input" style="width:100%"/></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Contact Person</label><input id="tender-contact-person" type="text" class="input" style="width:100%" placeholder="Name"/></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Contact Number</label><input id="tender-contact-number" type="text" class="input" style="width:100%" placeholder="Phone"/></div>
        <div style="grid-column:span 2"><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Contact Email</label><input id="tender-contact-email" type="email" class="input" style="width:100%" placeholder="email@example.com"/></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Price</label><input id="tender-price" type="number" class="input" style="width:100%" placeholder="0"/></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Winning Price</label><input id="tender-winning-price" type="number" class="input" style="width:100%" placeholder="0"/></div>
      </div>
      <div class="dialog-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--color-border,#e5e7eb)">
        <button class="btn-ghost-clean" data-dialog-close="tender-dialog">Cancel</button>
        <button class="btn-primary-clean" id="tender-save-btn" data-action="saveTender" data-args='["${esc(reviewId)}"]'>Save</button>
      </div>
    </div>
  </div>`;
}

export function linksPanelHtml(reviewId, parsedLinks, canEdit, tablePanel) {
  const rows = parsedLinks.map((lk, idx) => `<tr>
    <td><span style="font-size:11px;text-transform:uppercase;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#6b7280">${esc(lk.type || 'url')}</span></td>
    <td><a href="${esc(lk.url || '#')}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary);text-decoration:none;font-size:13px">${esc(lk.label || lk.url || '-')}</a></td>
    ${canEdit ? `<td><button class="btn-ghost-clean" style="font-size:12px;padding:3px 8px;color:var(--color-danger,#dc2626)" data-action="removeLink" data-args='["${esc(reviewId)}","${idx}"]'>Remove</button></td>` : '<td></td>'}
  </tr>`).join('');
  const addBtn = canEdit ? renderButton('+ Add Link', { variant: 'primary', size: 'sm', action: 'openAddLink', args: [] }) : '';
  return tablePanel('links', 'Links & Attachments', parsedLinks.length || null, addBtn, ['Type', 'Link', ''], rows, 'No links added yet');
}

export function linkDialog(reviewId) {
  return `<div id="link-dialog" class="dialog-backdrop" style="display:none" data-dialog-close="link-dialog">
    <div class="dialog" style="max-width:440px" onclick="event.stopPropagation()">
      <div class="dialog-header">
        <h2 style="font-size:17px;font-weight:600;margin:0">Add Link</h2>
        <button class="dialog-close" data-dialog-close="link-dialog" aria-label="Close">&times;</button>
      </div>
      <div class="dialog-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">Label</label><input id="link-label" type="text" class="input" style="width:100%" placeholder="e.g. Working Papers"/></div>
        <div><label style="font-size:13px;font-weight:500;color:var(--color-text-muted);display:block;margin-bottom:4px">URL *</label><input id="link-url" type="url" class="input" style="width:100%" placeholder="https://..."/></div>
      </div>
      <div class="dialog-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--color-border,#e5e7eb)">
        <button class="btn-ghost-clean" data-dialog-close="link-dialog">Cancel</button>
        <button class="btn-primary-clean" data-action="saveLink" data-args='["${esc(reviewId)}"]'>Add</button>
      </div>
    </div>
  </div>`;
}

export function sectionsPanelHtml(reviewId, sections, SPACING, renderTable, renderButton) {
  const secTotalH = sections.reduce((a, s) => a + (s.resolution?.total || s.highlight_count || 0), 0);
  const secResolvedH = sections.reduce((a, s) => a + (s.resolution?.resolved || s.resolved_count || 0), 0);
  const secOverallPct = secTotalH > 0 ? Math.round((secResolvedH / secTotalH) * 100) : 0;
  const summary = sections.length > 0
    ? `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;margin-bottom:12px;border-bottom:1px solid var(--color-border,#e5e7eb)">
        <span style="font-size:13px;color:var(--color-text-muted)">${sections.length} sections &mdash; ${secResolvedH}/${secTotalH} highlights resolved</span>
        <div style="flex:1;max-width:160px"><div class="resolution-bar"><div class="resolution-bar-segment resolution-bar-resolved" style="width:${secOverallPct}%"></div></div></div>
        <span style="font-size:13px;font-weight:600;color:${secOverallPct===100?'var(--color-success,#16a34a)':'var(--color-text)'}">${secOverallPct}%</span>
      </div>` : '';
  const rows = sections.map(s => {
    const total = s.resolution?.total ?? s.highlight_count ?? 0;
    const resolved = s.resolution?.resolved ?? s.resolved_count ?? 0;
    const pct = s.resolution?.progress ?? (total > 0 ? Math.round((resolved / total) * 100) : 100);
    return `<tr style="cursor:pointer" data-action="goToSectionHighlight" data-args='["${esc(s.id || '')}"]'>
      <td style="font-weight:500">${esc(s.name || s.title || '-')}${s.mandatory ? '<span style="margin-left:6px;font-size:10px;background:#fef2f2;color:#dc2626;padding:1px 5px;border-radius:4px;font-weight:600">Required</span>' : ''}</td>
      <td style="text-align:center"><span style="background:#f3f4f6;color:var(--color-text-muted);font-size:12px;padding:2px 8px;border-radius:9999px;font-weight:500">${total}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="resolution-bar" style="width:80px"><div class="resolution-bar-segment resolution-bar-resolved" style="width:${pct}%"></div></div><span style="font-size:12px;color:var(--color-text-muted)">${resolved}/${total}</span></div></td>
    </tr>`;
  }).join('');
  return `<div id="rvpanel-sections" class="rv-panel" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md}">
      <div><span style="font-size:15px;font-weight:600;color:var(--color-text)">Sections</span><span style="font-size:13px;color:var(--color-text-muted);margin-left:8px">(${sections.length})</span></div>
      <div>${renderButton('Full Report', { variant: 'primary', size: 'sm', href: `/review/${esc(reviewId)}/sections` })}</div>
    </div>
    ${summary}
    ${renderTable(['Section', 'Highlights', 'Progress'], rows || `<tr><td colspan="3" style="text-align:center;padding:${SPACING.xl} 0;color:var(--color-text-muted)">No sections defined</td></tr>`, SPACING.md)}
  </div>`;
}

export function compareDialogHtml(reviewId) {
  const rid = esc(reviewId);
  return `<div id="pdf-compare-dialog" class="dialog-backdrop" style="display:none" data-dialog-close="pdf-compare-dialog">
    <div class="dialog" style="max-width:560px" onclick="event.stopPropagation()">
      <div class="dialog-header"><h2 style="font-size:17px;font-weight:600;margin:0">Compare PDFs</h2><button class="dialog-close" data-dialog-close="pdf-compare-dialog">&times;</button></div>
      <div class="dialog-body" style="padding:16px 20px">
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px">Select a second review to compare side by side.</p>
        <select id="pdf-compare-select" class="input" style="width:100%"><option value="">Loading reviews...</option></select>
      </div>
      <div class="dialog-footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--color-border,#e5e7eb)">
        <button class="btn-ghost-clean" data-dialog-close="pdf-compare-dialog">Cancel</button>
        <button class="btn-primary-clean" data-action="openPdfCompare">Open Side by Side</button>
      </div>
    </div>
  </div>
  <div id="pdf-compare-view" style="display:none;position:fixed;inset:0;background:#1a1a2e;z-index:9999;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#0f0f1a;border-bottom:1px solid #333">
      <span style="color:#fff;font-weight:600;font-size:14px">PDF Comparison</span>
      <button onclick="document.getElementById('pdf-compare-view').style.display='none'" style="color:#fff;background:transparent;border:1px solid #555;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:13px">Close</button>
    </div>
    <div style="display:flex;flex:1;gap:2px;overflow:hidden">
      <iframe id="pdf-compare-left" src="" style="flex:1;border:none;background:#fff"></iframe>
      <iframe id="pdf-compare-right" src="" style="flex:1;border:none;background:#fff"></iframe>
    </div>
  </div>
  <script>(function(){var reviewId='${rid}';var pdfUrl='/review/'+reviewId+'/pdf';window.__events&&window.__events.register('openPdfCompare',function(){var sel=document.getElementById('pdf-compare-select');if(!sel||!sel.value){if(window.showToast)showToast('Select a review first','error');return;}document.getElementById('pdf-compare-left').src=pdfUrl;document.getElementById('pdf-compare-right').src='/review/'+sel.value+'/pdf';document.getElementById('pdf-compare-dialog').style.display='none';document.getElementById('pdf-compare-view').style.display='flex';});document.addEventListener('DOMContentLoaded',function(){fetch('/api/review?limit=100').then(function(r){return r.json();}).then(function(d){var reviews=(d.data||d||[]).filter(function(rv){return rv.id!==reviewId&&rv.pdf_url;});var sel=document.getElementById('pdf-compare-select');if(!sel)return;sel.innerHTML='<option value="">-- select review --</option>'+reviews.map(function(rv){return'<option value="'+rv.id+'">'+(rv.name||rv.title||rv.id)+'</option>';}).join('');}).catch(function(){});});})();</script>`;
}
