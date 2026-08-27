import { page } from '@/ui/layout.js';
import { esc } from '@/ui/render-helpers.js';
import { SPACING, renderPageHeader, renderEmptyState, renderStatsRow } from '@/ui/spacing-system.js';

function checklistProgress(c) {
  const total = c.total_items || 0;
  const done = c.completed_items || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `<div style="margin-top:${SPACING.sm}">
    <div class="resolution-bar"><div class="resolution-bar-segment resolution-bar-resolved" style="width:${pct}%"></div></div>
    <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">${done} of ${total} items complete</div>
  </div>`;
}

function checklistCard(c, href) {
  return `<a href="${href}" class="card-clean" style="display:block;margin-bottom:${SPACING.md};text-decoration:none;color:inherit">
    <div class="card-clean-body">
      <div class="card-header" style="margin-bottom:4px">${esc(c.name || c.title || 'Untitled checklist')}</div>
      ${checklistProgress(c)}
    </div>
  </a>`;
}

export function renderChecklistsManagement(user, checklists = []) {
  const rows = checklists.map(c => `<tr data-row data-navigate="/checklist/${esc(c.id)}" style="cursor:pointer">
    <td><strong>${esc(c.name || c.title || 'Untitled')}</strong></td>
    <td>${c.total_items || 0} items</td>
  </tr>`).join('');

  const content = `${renderPageHeader('Checklists', `${checklists.length} checklist${checklists.length !== 1 ? 's' : ''}`)}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Items</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="2" class="table-empty-row">No checklists found</td></tr>`}</tbody>
      </table>
    </div>`;

  return page(user, 'Checklists | Thatcher', [{ label: 'Admin', href: '/admin' }, { label: 'Checklists', href: '/admin/settings/checklists/manage' }], content);
}

export function renderChecklistsHome(user, checklists = []) {
  const cards = checklists.map(c => checklistCard(c, `/checklist/${esc(c.id)}`)).join('');
  const content = `${renderPageHeader('Checklists', `${checklists.length} checklist${checklists.length !== 1 ? 's' : ''}`)}
    ${cards || renderEmptyState('No checklists found')}`;

  return page(user, 'Checklists | Thatcher', [{ label: 'Checklists', href: '/checklists' }], content);
}

export function renderChecklistDetails(user, checklist = {}, items = []) {
  const total = items.length;
  const done = items.filter(i => i.is_done === 1 || i.is_done === true || i.completed).length;

  const stats = renderStatsRow([
    { label: 'Total items', value: total },
    { label: 'Completed', value: done },
    { label: 'Remaining', value: total - done, sub: total - done > 0 ? 'Still open' : 'All done' },
  ]);

  const itemRows = items.map(i => `<div class="card-clean" style="margin-bottom:${SPACING.sm}"><div class="card-clean-body" style="padding:${SPACING.sm} ${SPACING.md};display:flex;align-items:center;gap:${SPACING.sm}">
    <span class="${(i.is_done === 1 || i.is_done === true || i.completed) ? 'pill pill-success' : 'pill pill-neutral'}">${(i.is_done === 1 || i.is_done === true || i.completed) ? 'Done' : 'Open'}</span>
    <span>${esc(i.text || i.label || i.title || 'Untitled item')}</span>
  </div></div>`).join('');

  const content = `${renderPageHeader(checklist.name || checklist.title || 'Checklist', null)}
    ${stats}
    <div style="margin-top:${SPACING.lg}">${itemRows || renderEmptyState('No items in this checklist')}</div>`;

  return page(user, `${checklist.name || checklist.title || 'Checklist'} | Thatcher`, [
    { label: 'Checklists', href: '/checklists' },
    { label: checklist.name || checklist.title || 'Checklist', href: `/checklist/${esc(checklist.id || '')}` },
  ], content);
}
