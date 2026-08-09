import { page } from '@/ui/layout.js';
import { esc, emptyRow } from '@/ui/render-helpers.js';

const SEVERITY_PILL = { critical: 'pill-danger', warning: 'pill-warning', info: 'pill-neutral' };
const ENTITY_ROUTE = { product: 'product', contract: 'contract', user: 'user', resource_allocation: 'resource_allocation' };

function insightRow(insight) {
  const pillCls = SEVERITY_PILL[insight.severity] || 'pill-neutral';
  const entityPath = ENTITY_ROUTE[insight.entity];
  // opportunity-pipeline insights carry a month-string entity_id (e.g.
  // '2026-09'), not a real record id -- there is no single record to link
  // to for a whole-pipeline observation, so only entities with a real
  // per-record id get a link.
  const link = entityPath && insight.entity !== 'opportunity'
    ? `<a href="/${esc(entityPath)}/${esc(insight.entity_id)}" class="text-primary hover:underline">View</a>`
    : '';
  return `<tr>
    <td><span class="pill ${pillCls}">${esc(insight.severity)}</span></td>
    <td>${esc(insight.category)}</td>
    <td>${esc(insight.message)}</td>
    <td>${link}</td>
  </tr>`;
}

export function renderInsightsPage(user, insights = []) {
  const rows = insights.map(insightRow).join('') || emptyRow(4, 'No insights right now');
  const counts = insights.reduce((acc, i) => { acc[i.severity] = (acc[i.severity] || 0) + 1; return acc; }, {});

  const content = `
    <div class="page-header">
      <h1 class="page-title">Insights</h1>
      <p class="page-subtitle">${esc(String(counts.critical || 0))} critical, ${esc(String(counts.warning || 0))} warning, ${esc(String(counts.info || 0))} info</p>
    </div>
    <div class="card-clean">
      <div class="card-clean-body">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Severity</th><th>Category</th><th>Insight</th><th>Link</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return page(user, 'Insights | Thatcher', null, content, []);
}
