import { statusLabel } from '@/ui/renderer.js';
import { page } from '@/ui/layout.js';
import { fmtDate } from '@/ui/render-helpers.js';

function resultCard(item, entityType) {
  const sts = item.status ? statusLabel(item.status) : '';
  const title = item.name || item.title || 'Untitled';
  const subtitle = item.client_name || item.engagement_name || item.email || '';
  const date = fmtDate(item.created_at);
  const typeLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  return `<div class="card-clean" style="margin-bottom:8px;cursor:pointer" data-navigate="/${entityType}/${item.id}"><div class="card-clean-body" style="padding:0.75rem"><div class="flex items-start justify-between"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="badge badge-sm bg-gray-100 text-gray-600">${typeLabel}</span>${sts}</div><div class="font-medium">${title}</div>${subtitle ? `<div class="text-xs text-gray-500 mt-0.5">${subtitle}</div>` : ''}</div><div class="text-xs text-gray-400">${date}</div></div></div></div>`;
}

function filterPanel(teams, stages) {
  const teamOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  const stageOpts = stages.map(s => `<option value="${s}">${s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>`).join('');
  return `<div class="card-clean" style="margin-bottom:1.5rem"><div class="card-clean-body"><div class="grid grid-cols-1 md:grid-cols-4 gap-3"><div><label class="text-xs font-medium text-gray-600 block mb-1" for="search-query">Search</label><input type="text"  id="search-query" class="input input-bordered input-sm w-full" placeholder="Search across all entities..."/></div><div><label class="text-xs font-medium text-gray-600 block mb-1" for="filter-entity">Entity Type</label><select id="filter-entity" class="select select-bordered select-sm w-full"><option value="">All Types</option><option value="engagement">Engagements</option><option value="client">Clients</option><option value="rfi">RFIs</option><option value="review">Reviews</option><option value="user">Users</option></select></div><div><label class="text-xs font-medium text-gray-600 block mb-1" for="filter-status">Status</label><select id="filter-status" class="select select-bordered select-sm w-full"><option value="">All Statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="archived">Archived</option></select></div><div><label class="text-xs font-medium text-gray-600 block mb-1" for="filter-stage">Stage</label><select id="filter-stage" class="select select-bordered select-sm w-full"><option value="">All Stages</option>${stageOpts}</select></div></div><div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3"><div><label class="text-xs font-medium text-gray-600 block mb-1" for="filter-team">Team</label><select id="filter-team" class="select select-bordered select-sm w-full"><option value="">All Teams</option>${teamOpts}</select></div><div><label class="text-xs font-medium text-gray-600 block mb-1" for="filter-from">Date From</label><input type="date"  id="filter-from" class="input input-bordered input-sm w-full"/></div><div><label class="text-xs font-medium text-gray-600 block mb-1" for="filter-to">Date To</label><input type="date"  id="filter-to" class="input input-bordered input-sm w-full"/></div><div class="flex items-end"><button class="btn btn-primary btn-sm w-full" data-action="doSearch">Search</button></div></div></div></div>`;
}

export function renderAdvancedSearch(user, results = {}, options = {}) {
  const { teams = [], stages = [] } = options;
  const allResults = [];
  for (const [entityType, items] of Object.entries(results)) {
    (items || []).forEach(item => allResults.push({ ...item, _type: entityType }));
  }
  allResults.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  const totalCount = allResults.length;
  const entityCounts = {};
  allResults.forEach(r => { entityCounts[r._type] = (entityCounts[r._type] || 0) + 1; });
  const countBadges = Object.entries(entityCounts).map(([type, count]) => `<span class="badge badge-sm">${type}: ${count}</span>`).join(' ');

  const resultCards = allResults.length > 0
    ? allResults.map(r => resultCard(r, r._type)).join('')
    : '<div class="text-center py-12 text-gray-400">Enter a search query to find engagements, clients, RFIs, and reviews</div>';

  const content = `<div class="flex justify-between items-center mb-6"><h1 class="text-2xl font-bold">Advanced Search</h1></div>${filterPanel(teams, stages)}<div class="flex items-center gap-2 mb-4"><span class="text-sm text-gray-500">${totalCount} result${totalCount !== 1 ? 's' : ''}</span>${countBadges}</div><div id="search-results">${resultCards}</div>`;

  const searchScript = `window.doSearch=async function(){const q=document.getElementById('search-query')?.value||'';const entity=document.getElementById('filter-entity')?.value||'';const status=document.getElementById('filter-status')?.value||'';const stage=document.getElementById('filter-stage')?.value||'';const team=document.getElementById('filter-team')?.value||'';const from=document.getElementById('filter-from')?.value||'';const to=document.getElementById('filter-to')?.value||'';const params=new URLSearchParams();if(q)params.set('q',q);if(entity)params.set('entity',entity);if(status)params.set('status',status);if(stage)params.set('stage',stage);if(team)params.set('team',team);if(from)params.set('from',from);if(to)params.set('to',to);window.location='/search?'+params.toString()};document.getElementById('search-query')?.addEventListener('keydown',function(e){if(e.key==='Enter')doSearch()})`;

  return page(user, 'Search | Moonlanding', [{ href: '/', label: 'Dashboard' }, { label: 'Search' }], content, [searchScript]);
}
