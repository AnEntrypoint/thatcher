// ML / AI query console — lists highlight comments flagged as ML-candidate queries.
// MVP: read-only list of highlights with comment text + link back to the source review.
// Full AI integration (model invocation, response streaming) is out of scope — stub.

import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { SPACING } from '@/ui/spacing-system.js';

function fmtDate(ts) {
    if (!ts) return '-';
    const n = typeof ts === 'number' ? (ts > 1e10 ? ts : ts * 1000) : Date.parse(ts);
    if (!n || isNaN(n)) return '-';
    return new Date(n).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function renderMlConsole(user, candidates, reviewMap) {
    const rows = candidates.map((h) => {
        const reviewName = reviewMap[h.review_id] || '-';
        const comment = h.comment || h.text || '';
        const truncated = comment.length > 240 ? comment.slice(0, 240) + '…' : comment;
        return `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid var(--color-border);font-size:13px">
                <div style="font-weight:500">${esc(reviewName)}</div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">p.${h.page_number || '?'}</div>
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid var(--color-border);font-size:13px;max-width:560px">${esc(truncated)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid var(--color-border);font-size:12px;color:var(--color-text-muted);white-space:nowrap">${fmtDate(h.created_at)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid var(--color-border);text-align:right">
                <a href="/review/${esc(h.review_id)}/pdf#h-${esc(h.id)}" class="btn-ghost-clean" style="padding:4px 10px;font-size:12px">Open</a>
                <button data-action="runMlQuery" data-args='["${esc(h.id)}"]' class="btn-primary-clean" style="padding:4px 10px;font-size:12px;margin-left:4px">Ask AI</button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="4" style="padding:48px;text-align:center;color:var(--color-text-muted);font-size:13px">
        No highlights have been flagged as ML-query candidates yet.<br>
        <span style="font-size:12px">Mark a highlight with the ML flag to see it here.</span>
    </td></tr>`;

    const content = `<div style="margin:0 auto;max-width:1100px;padding:${SPACING.lg}">
        <div class="page-header">
            <div>
                <h1 class="page-title">AI / ML Query Console</h1>
                <div style="font-size:13px;color:var(--color-text-muted);margin-top:4px">
                    ${candidates.length} flagged highlight${candidates.length === 1 ? '' : 's'} pending AI assistance.
                </div>
            </div>
        </div>
        <div style="background:var(--color-surface,white);border:1px solid var(--color-border);border-radius:8px;overflow:hidden;margin-top:${SPACING.md}">
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr style="background:var(--color-surface-muted,#f8fafc)">
                        <th style="padding:10px;text-align:left;font-size:12px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px">Review</th>
                        <th style="padding:10px;text-align:left;font-size:12px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px">Comment</th>
                        <th style="padding:10px;text-align:left;font-size:12px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px">Created</th>
                        <th style="padding:10px;text-align:right;font-size:12px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px">Actions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="margin-top:${SPACING.md};padding:${SPACING.md};background:var(--color-surface-muted,#f8fafc);border-radius:8px;font-size:13px;color:var(--color-text-muted)">
            <strong>Note:</strong> Full AI integration requires an external model service.
            Clicking "Ask AI" currently records an intent; plumbing to a model endpoint is
            the next implementation step.
        </div>
    </div>
    <div id="ml-ask-dialog" class="modal" style="display:none" data-dialog-close-overlay="true">
      <div class="modal-overlay" data-dialog-close="ml-ask-dialog"></div>
      <div class="modal-content rounded-box max-w-lg p-6">
        <h3 style="font-size:16px;font-weight:600;margin:0 0 12px 0">AI Suggestion</h3>
        <div id="ml-ask-query" style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;padding:8px 10px;background:var(--color-surface-muted,#f8fafc);border-radius:6px"></div>
        <div id="ml-ask-result" style="font-size:14px;white-space:pre-wrap;min-height:60px;padding:10px;background:white;border:1px solid var(--color-border);border-radius:6px">
          <div style="color:var(--color-text-muted);font-style:italic">Generating suggestion…</div>
        </div>
        <div id="ml-ask-meta" style="font-size:11px;color:var(--color-text-muted);margin-top:8px"></div>
        <div class="modal-action" style="margin-top:16px">
          <button data-dialog-close="ml-ask-dialog" class="btn btn-ghost">Close</button>
        </div>
      </div>
    </div>
    <script>
    (function(){
      window.runMlQuery = async function(highlightId){
        var row = document.querySelector('[data-args=\\'["'+highlightId+'"]\\']').closest('tr');
        var qText = row ? row.querySelector('td:nth-child(2)').textContent.trim() : '';
        var dlg = document.getElementById('ml-ask-dialog');
        document.getElementById('ml-ask-query').textContent = qText;
        document.getElementById('ml-ask-result').innerHTML = '<div style="color:#64748b;font-style:italic">Generating suggestion…</div>';
        document.getElementById('ml-ask-meta').textContent = '';
        dlg.style.display = 'flex';
        try {
          var r = await fetch('/api/mwr/ml-ask', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ highlight_id: highlightId }) });
          var d = await r.json();
          if (d.success) {
            document.getElementById('ml-ask-result').textContent = d.suggestion || '(empty)';
            document.getElementById('ml-ask-meta').textContent = d.mode === 'live' ? ('Model: ' + (d.model || '?') + (d.usage ? ' · ' + (d.usage.input_tokens||0) + ' in / ' + (d.usage.output_tokens||0) + ' out' : '')) : ('Mode: ' + (d.mode || 'stub'));
          } else {
            document.getElementById('ml-ask-result').textContent = 'Error: ' + (d.error || 'unknown');
          }
        } catch (e) {
          document.getElementById('ml-ask-result').textContent = 'Network error: ' + e.message;
        }
      };
    })();
    </script>`;

    const bc = [{ href: '/', label: 'Home' }, { href: '/review', label: 'Reviews' }, { label: 'ML Console' }];
    return page(user, 'AI / ML Query Console | Moonlanding', bc, content);
}
