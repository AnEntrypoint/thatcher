import { esc } from '@/ui/render-helpers.js';

export function renderRfiReport(user, rfi, engagement, questions, responses) {
  const e = engagement || {};
  const fmtDate = (v) => { if (!v) return '-'; const n = typeof v === 'number' ? (v > 1e10 ? v : v * 1000) : new Date(v).getTime(); return new Date(n).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const respMap = {};
  for (const r of responses) {
    if (!respMap[r.question_id]) respMap[r.question_id] = [];
    respMap[r.question_id].push(r);
  }
  const statusBadge = (s) => { const color = s === 'answered' || s === 'accepted' ? '#22c55e' : s === 'overdue' ? '#ef4444' : '#f59e0b'; return `<span style="padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:700;background:${color}20;color:${color}">${s || 'pending'}</span>`; };
  const qRows = questions.map((q, i) => {
    const resps = respMap[q.id] || [];
    const respHtml = resps.length ? resps.map(r => `<div style="margin-top:6px;padding:6px 10px;background:#f8fafc;border-left:3px solid #3b82f6;font-size:0.75rem">${esc(r.response||'')}<div style="margin-top:4px;color:#94a3b8;font-size:0.65rem">${fmtDate(r.created_at)}</div></div>`).join('') : '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">No response yet</div>';
    return `<div style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:6px;break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div style="font-size:0.85rem;font-weight:600">${i+1}. ${esc(q.question||q.text||'Question')}</div>
        ${statusBadge(q.status)}
      </div>
      ${q.due_date ? `<div style="color:#64748b;font-size:0.7rem;margin-bottom:6px">Due: ${fmtDate(q.due_date)}</div>` : ''}
      ${q.assigned_to ? `<div style="color:#64748b;font-size:0.7rem;margin-bottom:6px">Assigned: ${esc(q.assigned_to_name||q.assigned_to)}</div>` : ''}
      ${respHtml}
    </div>`;
  }).join('');
  const answered = questions.filter(q => ['answered','accepted','closed'].includes(q.status)).length;
  const pct = questions.length ? Math.round(answered / questions.length * 100) : 0;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>RFI Report — ${esc(rfi.name || rfi.title || 'RFI')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #1e293b; font-size: 14px; }
  .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; margin: 12px 0; font-size: 0.8rem; color: #64748b; }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { font-weight: 600; margin-bottom: 2px; }
  .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin: 8px 0; }
  .progress-fill { height: 100%; border-radius: 4px; background: #3b82f6; }
  .no-print { padding: 12px 0; }
  @media print { .no-print { display: none; } body { padding: 12px; } }
</style></head><body>
<div class="no-print"><button onclick="window.print()" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem">Print / Save PDF</button> <a href="/rfi/${esc(rfi.id)}" style="margin-left:12px;font-size:0.85rem;color:#3b82f6">← Back to RFI</a></div>
<div class="header">
  <div style="font-size:1.4rem;font-weight:700">${esc(rfi.name||rfi.title||'RFI')}</div>
  <div style="color:#64748b;font-size:0.85rem;margin-top:4px">${esc(e.name||e.client_name||'')}</div>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">Status</span>${esc(rfi.status||'-')}</div>
    <div class="meta-item"><span class="meta-label">Created</span>${fmtDate(rfi.created_at)}</div>
    ${rfi.deadline ? `<div class="meta-item"><span class="meta-label">Deadline</span>${fmtDate(rfi.deadline)}</div>` : ''}
    <div class="meta-item"><span class="meta-label">Questions</span>${questions.length}</div>
    <div class="meta-item"><span class="meta-label">Complete</span>${pct}% (${answered}/${questions.length})</div>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
</div>
<div>${qRows || '<div style="color:#94a3b8;text-align:center;padding:24px">No questions found</div>'}</div>
<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:0.7rem;color:#94a3b8;text-align:center">Generated ${new Date().toLocaleString('en-ZA')} &bull; Moonlanding</div>
</body></html>`;
}
