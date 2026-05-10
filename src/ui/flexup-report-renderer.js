// FlexUp-style summary report for an engagement — print-friendly HTML.
// Aggregates: engagement details, RFI status counts, review progress, highlight resolution,
// activity timeline. Users hit "Print" to save as PDF in-browser (no server-side puppeteer
// dependency needed for this report).

import { esc, STAGE_CONFIG } from '@/ui/render-helpers.js';

function fmtDate(v) {
    if (!v) return '-';
    const n = typeof v === 'number' ? (v > 1e10 ? v : v * 1000) : Date.parse(v);
    if (!n || isNaN(n)) return '-';
    return new Date(n).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCurrency(v) {
    if (v == null || v === '') return '-';
    return 'R ' + Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(part, total) {
    if (!total || total === 0) return 0;
    return Math.round((Number(part) / Number(total)) * 100);
}

function progressRing(value, label, color) {
    const radius = 32, circ = 2 * Math.PI * radius;
    const offset = circ - (value / 100) * circ;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg)">
            <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="6"/>
            <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${color}" stroke-width="6"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div style="font-size:20px;font-weight:700;color:#111;margin-top:-54px;position:relative;height:24px">${value}%</div>
        <div style="font-size:12px;font-weight:500;color:#64748b;margin-top:4px">${esc(label)}</div>
    </div>`;
}

export function renderFlexupReport(user, engagement, client, rfis, reviews, highlights, activity, team) {
    const e = engagement;
    const cfg = STAGE_CONFIG.find((s) => s.key === e.stage);
    const themeColor = e.color || cfg?.color || '#3b82f6';

    const rfiStats = {
        total: rfis.length,
        open: rfis.filter((r) => (r.status || 'open') === 'open').length,
        closed: rfis.filter((r) => ['closed', 'completed', 'resolved'].includes((r.status || '').toLowerCase())).length,
        overdue: rfis.filter((r) => r.due_date && Number(r.due_date) < Math.floor(Date.now() / 1000) && (r.status || 'open') !== 'closed').length,
    };
    const hlStats = {
        total: highlights.length,
        resolved: highlights.filter((h) => h.status === 'resolved').length,
        partial: highlights.filter((h) => h.status === 'partial_resolved' || h.partial_resolved).length,
        partner: highlights.filter((h) => h.partner_resolved).length,
        manager: highlights.filter((h) => h.manager_resolved).length,
    };

    const resolvedPct = pct(hlStats.resolved, hlStats.total);
    const partnerPct = pct(hlStats.partner, hlStats.total);
    const managerPct = pct(hlStats.manager, hlStats.total);
    const engProgress = Number(e.progress) || 0;

    const rfiRows = rfis.length ? rfis.map((r) => {
        const overdue = r.due_date && Number(r.due_date) < Math.floor(Date.now() / 1000) && (r.status || 'open') !== 'closed';
        return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px">${esc(r.title || r.name || '-')}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#64748b">${esc(r.status || 'open')}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:${overdue ? '#dc2626' : '#64748b'}">${r.due_date ? fmtDate(r.due_date) : '-'}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="3" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">No RFIs</td></tr>`;

    const reviewRows = reviews.length ? reviews.map((r) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px">${esc(r.name || '-')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#64748b">${esc(r.status || '-')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#64748b">${r.total_highlights || 0}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#64748b">${r.resolved_highlights || 0}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">No reviews linked</td></tr>`;

    const activityRows = activity.slice(0, 10).map((a) => {
        const ts = a.timestamp || a.created_at;
        const when = ts ? (typeof ts === 'number' && ts > 1e9 ? new Date(ts * 1000).toLocaleString() : new Date(ts).toLocaleString()) : '-';
        return `<tr>
            <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#64748b">${when}</td>
            <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;font-size:13px">${esc(a.action || a.operation || a.type || '-')}</td>
            <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#64748b">${esc(a.user_id || 'System')}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#9ca3af;font-size:12px">No recent activity</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>Engagement Report — ${esc(e.name || 'Engagement')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; color: #111; background: #f9fafb; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
  .accent { height: 6px; background: ${esc(themeColor)}; border-radius: 3px; margin-bottom: 24px; }
  .h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px 0; }
  .muted { color: #64748b; font-size: 13px; }
  .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; font-size: 14px; }
  .grid .k { color: #64748b; }
  .rings { display: flex; gap: 24px; justify-content: center; padding: 12px 0; }
  .kstat { display: flex; flex-direction: column; align-items: center; }
  .kstat .val { font-size: 28px; font-weight: 700; color: #111; }
  .kstat .lbl { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
  .no-print { display: block; }
  .foot { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .pbtn { background: ${esc(themeColor)}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    .card { box-shadow: none; page-break-inside: avoid; }
    .wrap { padding: 0; max-width: 100%; }
  }
</style>
</head><body>
<div class="wrap">
  <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <a href="/engagement/${esc(e.id)}" style="color:#64748b;text-decoration:none;font-size:13px">← Back</a>
    <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="accent"></div>
  <div class="card">
    <h1 class="h1">${esc(e.name || e.title || 'Engagement')}</h1>
    <div class="muted">${esc(client?.name || e.client_name || '-')} &middot; ${esc(cfg?.label || e.stage || '-')} &middot; FY ${esc(e.year || '-')}</div>
  </div>
  <div class="card">
    <h2 style="font-size:14px;margin:0 0 16px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151">Progress</h2>
    <div class="rings">
      ${progressRing(engProgress, 'Engagement', '#3b82f6')}
      ${progressRing(resolvedPct, 'Resolved', '#10b981')}
      ${progressRing(partnerPct, 'Partner', '#8b5cf6')}
      ${progressRing(managerPct, 'Manager', '#f59e0b')}
    </div>
  </div>
  <div class="card">
    <h2 style="font-size:14px;margin:0 0 16px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151">Engagement Details</h2>
    <div class="grid">
      <div><div class="k">Team</div><div>${esc(team?.name || e.team_name || '-')}</div></div>
      <div><div class="k">Status</div><div>${esc(e.status || '-')}</div></div>
      <div><div class="k">Type</div><div>${esc(e.type || e.engagement_type || e.repeat_interval || '-')}</div></div>
      <div><div class="k">Fee</div><div>${fmtCurrency(e.fee)}</div></div>
      <div><div class="k">Commenced</div><div>${fmtDate(e.commencement_date)}</div></div>
      <div><div class="k">Deadline</div><div>${fmtDate(e.deadline_date || e.deadline)}</div></div>
    </div>
  </div>
  <div class="card">
    <h2 style="font-size:14px;margin:0 0 16px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151">RFIs</h2>
    <div class="stats" style="margin-bottom:16px">
      <div class="kstat"><div class="val">${rfiStats.total}</div><div class="lbl">Total</div></div>
      <div class="kstat"><div class="val" style="color:#3b82f6">${rfiStats.open}</div><div class="lbl">Open</div></div>
      <div class="kstat"><div class="val" style="color:#10b981">${rfiStats.closed}</div><div class="lbl">Closed</div></div>
      <div class="kstat"><div class="val" style="color:#dc2626">${rfiStats.overdue}</div><div class="lbl">Overdue</div></div>
    </div>
    <table><thead><tr><th>Title</th><th>Status</th><th>Due</th></tr></thead><tbody>${rfiRows}</tbody></table>
  </div>
  <div class="card">
    <h2 style="font-size:14px;margin:0 0 16px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151">Reviews (${reviews.length})</h2>
    <table><thead><tr><th>Name</th><th>Status</th><th>Highlights</th><th>Resolved</th></tr></thead><tbody>${reviewRows}</tbody></table>
  </div>
  <div class="card">
    <h2 style="font-size:14px;margin:0 0 16px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151">Recent Activity</h2>
    <table><thead><tr><th>When</th><th>Action</th><th>By</th></tr></thead><tbody>${activityRows}</tbody></table>
  </div>
  <div class="foot">
    Generated ${new Date().toLocaleString('en-ZA')} by ${esc(user?.email || user?.name || 'system')} &middot; Moonlanding
  </div>
</div>
</body></html>`;
    return html;
}
