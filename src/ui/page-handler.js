import { getUser, setCurrentRequest } from '@/engine.server.js';
import { hasGoogleAuth } from '@/config/env.js';
import { getSpec, getAllEntityNames } from '@/config/spec-helpers.js';
import { list, get } from '@/lib/busybase/store.js';
import { renderLogin, renderDashboard, renderAccessDenied, renderPasswordReset, renderPasswordResetConfirm, REDIRECT } from '@/ui/renderer.js';
import { renderClientDashboard, renderClientList } from '@/ui/client-renderer.js';
import { canList, canView, canCreate, canEdit, isPartner, isClerk, isClientUser, canClientAccessEntity } from '@/ui/permissions-ui.js';
import { renderEngagementGrid } from '@/ui/engagement-grid-renderer.js';
import { renderBoardView } from '@/ui/board-view-renderer.js';
import { renderGridView } from '@/ui/grid-view-renderer.js';
import { renderCalendarView, renderTimelineView } from '@/ui/calendar-view-renderer.js';
import { renderCountByFieldReport, renderCountOverTimeReport, renderSumByFieldReport, renderRollupReport } from '@/ui/report-renderer.js';
import { renderClientProgress } from '@/ui/client-progress-renderer.js';
import { renderLetterWorkflow } from '@/ui/letter-workflow-renderer.js';
import { renderAdvancedSearch } from '@/ui/advanced-search-renderer.js';
import { getDashboardStats, getClientDashboardStats, resolveRefFields, resolveEnumOptions, getRefOptions } from '@/ui/page-handler-helpers.js';
import { handleAdminPage } from '@/ui/page-handler-admin.js';
import { handleReviewRoutes } from '@/ui/page-handler-reviews.js';
import { handleRfiDetail, handleRfiList, handleRfiReport } from '@/ui/page-handler-rfi.js';
import { fileURLToPath } from 'url';

const __dirname_ph = fileURLToPath(new URL('.', import.meta.url));
const lazyRenderer = (name) => import(`file://${__dirname_ph}${name}?t=${globalThis.__reloadTs__ || Date.now()}`);

function reqUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

async function handleEngagementDetail(user, engId) {
  if (!canView(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'view');
  const engagement = await get('engagement', engId, { user });
  if (!engagement) return null;
  let client = null; try { client = engagement.client_id ? await get('client', engagement.client_id) : null; } catch {}
  let rfis = []; try { rfis = await list('rfi', { engagement_id: engId }, { user }); } catch {}
  let sections = [];
  try {
    sections = await list('rfi_section', { engagement_id: engId }, { sort: { field: 'sort_order', dir: 'ASC' }, user });
  } catch {}
  let team = null; try { team = engagement.team_id ? await get('team', engagement.team_id) : null; } catch {}
  let assignedUsers = [];
  try {
    const ids = JSON.parse(engagement.users || '[]');
    const users = await list('user', {});
    const um = Object.fromEntries(users.map(u => [u.id, u.name || u.email]));
    assignedUsers = ids.map(id => ({ id, name: um[id] || null })).filter(u => u.name);
  } catch {}
  const { renderEngagementDetail } = await lazyRenderer('engagement-detail-renderer.js');
  return renderEngagementDetail(user, { ...engagement, team_name: team?.name || engagement.team_name, client_name: client?.name || engagement.client_name, assigned_users_resolved: assignedUsers }, client, rfis, sections);
}
async function handleEngagementList(user, req) {
  if (!canList(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'list');
  let engagements = await list('engagement', {}, { user });
  const clientMap = Object.fromEntries((await list('client', {})).map(c => [c.id, c.name]));
  engagements = engagements.map(e => ({ ...e, client_name: clientMap[e.client_id] || e.client_name || '-' }));
  const spec = getSpec('engagement'); if (spec) engagements = resolveRefFields(engagements, spec);
  let teams = []; try { teams = await list('team', {}); } catch {}
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
  engagements = engagements.map(e => ({ ...e, team_name: teamMap[e.team_id] || e.team_name || '-' }));
  const years = [...new Set(engagements.map(e => { if (!e.year) return null; const m = String(e.year).match(/\b(20\d{2}|19\d{2})\b/); return m ? m[1] : null; }).filter(Boolean))].sort().reverse();
  const filter = reqUrl(req).searchParams.get('filter') || 'all';
  return renderEngagementGrid(user, engagements, { filter, teams, years });
}
async function handleSearch(user, req) {
  const url = reqUrl(req);
  const q = url.searchParams.get('q') || '', entityFilter = url.searchParams.get('entity') || '', statusFilter = url.searchParams.get('status') || '';
  let teams = []; try { teams = await list('team', {}); } catch {}
  const allEntityNames = getAllEntityNames().filter(eName => canList(user, eName));
  const searchableEntities = entityFilter ? allEntityNames.filter(e => e === entityFilter) : allEntityNames;
  const results = {};
  for (const eName of searchableEntities) {
    try { let items = await list(eName, {}, { user }); if (q) items = items.filter(i => JSON.stringify(i).toLowerCase().includes(q.toLowerCase())); if (statusFilter) items = items.filter(i => i.status === statusFilter); const spec = getSpec(eName); if (spec) items = resolveRefFields(items, spec); results[eName] = items.slice(0, 50); } catch {}
  }
  return renderAdvancedSearch(user, results, { teams, entityNames: allEntityNames });
}
const SYSTEM_FIELDS_TO_STRIP = new Set(['id', 'created_at', 'created_by', 'updated_at', 'status', 'organization_id']);

async function handleGenericEntityView(user, entityName, id, req) {
  const spec = getSpec(entityName); if (!spec) return null;
  if (isClientUser(user) && !canClientAccessEntity(user, entityName)) return renderAccessDenied(user, entityName, 'view');
  if (id === 'new') {
    if (!canCreate(user, entityName)) return renderAccessDenied(user, entityName, 'create');
    const resolvedSpec = resolveEnumOptions(spec);
    const { renderEntityForm: lazyEntityForm } = await lazyRenderer('entity-renderer.js');

    let prefill = null;
    const params = req ? reqUrl(req).searchParams : null;
    const cloneFromId = params?.get('clone_from');
    const templateId = params?.get('template');
    if (cloneFromId) {
      const source = await get(entityName, cloneFromId, { user });
      if (source) {
        prefill = {};
        for (const [key, value] of Object.entries(source)) {
          if (!SYSTEM_FIELDS_TO_STRIP.has(key)) prefill[key] = value;
        }
      }
    } else if (templateId) {
      const template = await get('entity_template', templateId);
      if (template && template.entity === entityName) {
        try {
          prefill = typeof template.field_values === 'string' ? JSON.parse(template.field_values || '{}') : (template.field_values || {});
        } catch {
          prefill = {};
        }
      }
    }

    let templates = [];
    try { templates = await list('entity_template', { entity: entityName }); } catch {}

    return lazyEntityForm(entityName, prefill, resolvedSpec, user, true, await getRefOptions(resolvedSpec), templates);
  }
  if (!canView(user, entityName)) return renderAccessDenied(user, entityName, 'view');
  const item = await get(entityName, id, { user }); if (!item) return null;
  if (item.team_id && user.team_id && item.team_id !== user.team_id && !isPartner(user)) return renderAccessDenied(user, entityName, 'view');
  if (isClientUser(user) && user.client_id && item.client_id && item.client_id !== user.client_id) return renderAccessDenied(user, entityName, 'view');
  let [resolvedItem] = resolveRefFields([item], spec);
  if (entityName === 'product') {
    // current_stock is derived, never a stored/editable field -- summed fresh
    // from stock_movement history so it can never drift from the ledger the
    // way a separately-writable counter could.
    try {
      const movements = await list('stock_movement', { product_id: id });
      const currentStock = movements.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
      resolvedItem = { ...resolvedItem, current_stock: currentStock };
    } catch { resolvedItem = { ...resolvedItem, current_stock: 0 }; }
  }
  if (entityName === 'task') {
    // total_hours/billable_amount are derived from time_entry history, same
    // never-a-stored-counter discipline as product.current_stock above.
    try {
      const entries = await list('time_entry', { task_id: id });
      const totalHours = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
      const billableAmount = entries.filter(e => e.billable).reduce((sum, e) => sum + (Number(e.hours) || 0) * (Number(e.rate) || 0), 0);
      resolvedItem = { ...resolvedItem, total_hours: totalHours, billable_amount: billableAmount };
    } catch { resolvedItem = { ...resolvedItem, total_hours: 0, billable_amount: 0 }; }
  }
  if (entityName === 'project') {
    // Project-level rollup joins through task the same way the rollup report
    // added last pass joins entity A through a ref field to entity B -- no
    // new join logic, just the same id-lookup-then-aggregate shape.
    try {
      const tasks = await list('task', { project_id: id });
      const taskIds = new Set(tasks.map(t => t.id));
      const allEntries = await list('time_entry', {});
      const projectEntries = allEntries.filter(e => taskIds.has(e.task_id));
      const totalHours = projectEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
      const billableAmount = projectEntries.filter(e => e.billable).reduce((sum, e) => sum + (Number(e.hours) || 0) * (Number(e.rate) || 0), 0);
      resolvedItem = { ...resolvedItem, total_hours: totalHours, billable_amount: billableAmount };
    } catch { resolvedItem = { ...resolvedItem, total_hours: 0, billable_amount: 0 }; }
  }
  if (entityName === 'contract' && resolvedItem.end_date != null) {
    // days_until_expiry is computed from the already-access-checked record
    // (get(...,{user}) above already returned null for a denied/absent
    // contract before this line is ever reached), never a separate query
    // that could leak the value to a caller who never proved they can view
    // this specific contract.
    const { daysUntilExpiry } = await import('@/lib/contract-expiry.js');
    resolvedItem = { ...resolvedItem, days_until_expiry: daysUntilExpiry(resolvedItem.end_date) };
  }
  if (entityName === 'user') {
    // Resource utilization reuses the same "sum grouped by owner" rollup
    // shape as task/project total_hours above, just grouped by allocation
    // rather than time entry -- no new aggregation logic, only overlapping
    // (currently-active) allocations count toward the displayed total.
    try {
      const allocations = await list('resource_allocation', { user_id: id });
      const nowTs = Math.floor(Date.now() / 1000);
      const activeAllocations = allocations.filter(a => Number(a.start_date) <= nowTs && nowTs <= Number(a.end_date));
      const allocatedHoursPerWeek = activeAllocations.reduce((sum, a) => sum + (Number(a.allocated_hours_per_week) || 0), 0);
      resolvedItem = { ...resolvedItem, allocated_hours_per_week: allocatedHoursPerWeek, weekly_capacity_hours: 40 };
    } catch { resolvedItem = { ...resolvedItem, allocated_hours_per_week: 0, weekly_capacity_hours: 40 }; }
  }
  // get(...,{user}) above already enforced row/org access for this exact
  // record (a denied/absent record returns null before this point), so
  // fetching its audit trail here is scoped by construction -- there is no
  // separate access check to duplicate for the history view.
  let history = [];
  try {
    const { getEntityAuditTrail } = await import('@/lib/busybase/audit-reads.js');
    const { permissionService } = await import('@/services/permission.service.js');
    const rawHistory = await getEntityAuditTrail(entityName, id);
    // Field-level RBAC must hold for audit diffs too -- a viewer who can't see
    // a restricted field on the live record must not see it in a before/after
    // snapshot either, or field-level RBAC would be trivially bypassed via history.
    history = rawHistory.map(h => ({
      ...h,
      beforeState: h.beforeState ? permissionService.filterFields(user, spec, h.beforeState) : null,
      afterState: h.afterState ? permissionService.filterFields(user, spec, h.afterState) : null,
    }));
  } catch {}
  const { renderEntityDetail: lazyEntityDetail } = await lazyRenderer('entity-renderer.js');
  return lazyEntityDetail(entityName, resolvedItem, spec, user, history);
}
async function handleClientSubRoute(user, clientId, subRoute) {
  if (!canView(user, 'client')) return renderAccessDenied(user, 'client', 'view');
  const client = await get('client', clientId, { user }); if (!client) return null;
  if (isClientUser(user) && user.client_id && user.client_id !== clientId) return renderAccessDenied(user, 'client', 'view');
  if (subRoute === 'dashboard' || subRoute === 'users') return renderClientDashboard(user, client, await getClientDashboardStats(clientId));
  if (subRoute === 'progress') {
    let engagements = []; try { engagements = (await list('engagement', {}, { user })).filter(e => e.client_id === clientId); } catch {}
    const spec = getSpec('engagement'); if (spec) engagements = resolveRefFields(engagements, spec);
    let rfiStats = { total: 0, responded: 0, overdue: 0 };
    try { const allRfis = (await list('rfi', {}, { user })).filter(r => engagements.some(e => e.id === r.engagement_id)); const now = Math.floor(Date.now() / 1000); rfiStats = { total: allRfis.length, responded: allRfis.filter(r => r.status === 'responded' || r.status === 'completed').length, overdue: allRfis.filter(r => r.due_date && r.due_date < now && r.status !== 'closed').length }; } catch {}
    return renderClientProgress(user, client, engagements, rfiStats);
  }
  return null;
}
async function handleGenericEntityEdit(user, entityName, id) {
  const spec = getSpec(entityName); if (!spec) return null;
  if (!canEdit(user, entityName)) return renderAccessDenied(user, entityName, 'edit');
  const item = await get(entityName, id, { user }); if (!item) return null;
  if (item.team_id && user.team_id && item.team_id !== user.team_id && !isPartner(user)) return renderAccessDenied(user, entityName, 'edit');
  const resolvedSpec = resolveEnumOptions(spec);
  const { renderEntityForm: lazyEntityForm } = await lazyRenderer('entity-renderer.js');
  return lazyEntityForm(entityName, item, resolvedSpec, user, false, await getRefOptions(resolvedSpec));
}
export async function handlePage(pathname, req, res) {
  setCurrentRequest(req);
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const segments = normalized.split('/').filter(Boolean);

  if (normalized === '/login') {
    const user = await getUser();
    if (user) { res.writeHead(302, { Location: '/' }); res.end(); return REDIRECT; }
    return renderLogin(null, hasGoogleAuth());
  }
  if (normalized === '/password-reset') return renderPasswordReset();
  if (normalized === '/password-reset/confirm') {
    const token = reqUrl(req).searchParams.get('token') || '';
    return renderPasswordResetConfirm(token);
  }

  const user = await getUser();
  if (!user) { res.writeHead(302, { Location: '/login' }); res.end(); return REDIRECT; }
  if (normalized === '/unauthorized') return renderAccessDenied(user, 'system', 'access');
  if (normalized === '/notifications') { let notifs=[]; try{notifs=await list('notification',{user_id:user.id},{sort:{field:'created_at',dir:'DESC'},limit:100,user})}catch{} const{renderNotificationsPage}=await lazyRenderer('notifications-renderer.js'); return renderNotificationsPage(user,notifs); }
  if (normalized === '/' || normalized === '/dashboard') return renderDashboard(user, await getDashboardStats(user));
  if (normalized.startsWith('/admin/') || normalized === '/admin/jobs') return handleAdminPage(normalized, segments, user, req);
  if (segments[0] === 'client' && segments.length === 3 && ['dashboard', 'users', 'progress'].includes(segments[2])) return handleClientSubRoute(user, segments[1], segments[2]);
  if (isClerk(user) && segments.length >= 1 && ['user', 'team'].includes(segments[0])) return renderAccessDenied(user, segments[0], 'list');
  if (normalized === '/mwr' || normalized === '/mwr/home') {
    if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
    let myReviews = [], sharedReviews = [], recentActivity = [];
    // OR across two columns: busybase eq() is single-column, so fetch + filter in JS.
    try {
      const reviews = await list('review', {}, { sort: { field: 'updated_at', dir: 'DESC' }, user });
      myReviews = reviews.filter(r => r.created_by === user.id || r.assigned_to === user.id).slice(0, 100);
    } catch {}
    // Old JOIN collaborator -> two-step: collaborator rows for this user, then their reviews.
    try {
      const collabs = await list('collaborator', { user_id: user.id });
      const ids = new Set(collabs.map(c => c.review_id));
      if (ids.size) {
        const reviews = await list('review', {}, { sort: { field: 'updated_at', dir: 'DESC' }, user });
        sharedReviews = reviews.filter(r => ids.has(r.id)).slice(0, 100);
      }
    } catch {}
    try {
      recentActivity = (await list('audit_logs', { entity_type: 'review' }, { sort: { field: 'created_at', dir: 'DESC' }, user })).slice(0, 50);
    } catch {}
    const all = [...myReviews, ...sharedReviews];
    const stats = { myReviews, sharedReviews, recentActivity, totalReviews: all.length, activeReviews: all.filter(r => (r.status||'open') !== 'archived' && (r.status||'open') !== 'completed' && (r.status||'open') !== 'closed').length, flaggedReviews: all.filter(r => r.flagged).length, overdueReviews: 0 };
    const { renderMwrHome } = await lazyRenderer('review/mwr.js');
    return renderMwrHome(user, stats);
  }
  const reviewResult = await handleReviewRoutes(normalized, segments, user, req);
  if (reviewResult !== null) return reviewResult;

  if (normalized === '/engagements') return handleEngagementList(user, req);
  if (normalized === '/search') return handleSearch(user, req);
  if (normalized === '/monitoring') {
    if (!isPartner(user)) return renderAccessDenied(user, 'monitoring', 'view');
    const { renderMonitoringDashboard } = await lazyRenderer('monitoring-dashboard.js');
    return renderMonitoringDashboard();
  }
  if (normalized === '/flexup') {
    const { renderFlexUpView } = await lazyRenderer('flexup-view-renderer.js');
    return renderFlexUpView(user);
  }
  if (normalized === '/ml-console') {
    let candidates = []; let reviewMap = {};
    try {
      // Old: highlights with a non-trivial comment (LIKE '%?' OR length>40), newest 50.
      const all = await list('highlight', {}, { sort: { field: 'created_at', dir: 'DESC' }, user });
      candidates = all.filter(c => c.comment && (c.comment.includes('?') || c.comment.length > 40)).slice(0, 50);
      const revIds = [...new Set(candidates.map((c) => c.review_id))];
      if (revIds.length) {
        const reviews = await list('review', {}, { user });
        const byId = new Map(reviews.map(r => [r.id, r.name || '-']));
        reviewMap = Object.fromEntries(revIds.map(id => [id, byId.get(id) || '-']));
      }
    } catch {}
    const { renderMlConsole } = await lazyRenderer('ml-console-renderer.js');
    return renderMlConsole(user, candidates, reviewMap);
  }
  if (segments.length === 2 && (segments[0] === 'engagements' || segments[0] === 'engagement') && segments[1] !== 'new') return handleEngagementDetail(user, segments[1]);
  if (segments[0] === 'engagement' && segments.length === 3 && segments[2] === 'letter') {
    if (!canView(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'view');
    const engagement = await get('engagement', segments[1], { user }); if (!engagement) return null;
    return renderLetterWorkflow(user, engagement);
  }
  if (segments[0] === 'engagement' && segments.length === 3 && segments[2] === 'report') {
    if (!canView(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'view');
    const engId = segments[1]; const engagement = await get('engagement', engId, { user }); if (!engagement) return null;
    let client=null,team=null,rfis=[],reviews=[],highlights=[],activity=[];
    try{client=engagement.client_id?await get('client',engagement.client_id):null}catch{}
    try{team=engagement.team_id?await get('team',engagement.team_id):null}catch{}
    try{rfis=await list('rfi',{engagement_id:engId},{sort:{field:'created_at',dir:'DESC'},user})}catch{}
    try{reviews=await list('review',{engagement_id:engId},{sort:{field:'created_at',dir:'DESC'},user})}catch{}
    try{const rids=new Set(reviews.map(r=>r.id));if(rids.size){const allHl=await list('highlight',{},{user});highlights=allHl.filter(h=>rids.has(h.review_id))}}catch{}
    try{activity=(await list('audit_logs',{entity_type:'engagement',entity_id:engId},{sort:{field:'created_at',dir:'DESC'},user})).slice(0,20)}catch{}
    const{renderFlexupReport}=await lazyRenderer('flexup-report-renderer.js');
    return renderFlexupReport(user,engagement,client,rfis,reviews,highlights,activity,team);
  }
  if (segments.length === 3 && segments[0] === 'rfi' && segments[2] === 'report') return handleRfiReport(user, segments[1], res);
  if (segments.length === 2 && segments[0] === 'rfi' && segments[1] !== 'new') return handleRfiDetail(user, segments[1]);
  if (segments.length === 1 && segments[0] === 'rfi') return handleRfiList(user);
  if (segments.length === 1 && segments[0] === 'client') {
    if (!canList(user, 'client')) return renderAccessDenied(user, 'client', 'list');
    let clients = await list('client', {}, { user });
    if (isClientUser(user) && user.client_id) clients = clients.filter(c => c.id === user.client_id);
    return renderClientList(user, clients);
  }
  if (segments.length === 1) {
    const entityName = segments[0];
    const spec = getSpec(entityName); if (!spec) return null;
    if (isClientUser(user) && !canClientAccessEntity(user, entityName)) return renderAccessDenied(user, entityName, 'list');
    if (!canList(user, entityName)) return renderAccessDenied(user, entityName, 'list');
    let items = await list(entityName, {}, { user });
    if (isClientUser(user) && user.client_id) items = items.filter(item => { if (item.client_id) return item.client_id === user.client_id; if (item.assigned_to) return item.assigned_to === user.id; return true; });
    items = resolveRefFields(items, spec);
    const params = reqUrl(req).searchParams;
    if (params.get('export') === 'csv') {
      const { buildCsv, csvFilename } = await lazyRenderer('csv-export.js');
      const csv = buildCsv(entityName, spec, items);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${csvFilename(entityName)}"`);
      res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf-8'));
      res.writeHead(200); res.end(csv); return 'HANDLED';
    }
    const report = params.get('report');
    if (report === 'count-by-field') {
      const field = params.get('field') || '';
      return renderCountByFieldReport(user, entityName, spec, items, field);
    }
    if (report === 'count-over-time') {
      const dateField = params.get('field') || '';
      const granularity = params.get('granularity') || 'month';
      return renderCountOverTimeReport(user, entityName, spec, items, dateField, granularity);
    }
    if (report === 'sum-by-field') {
      const field = params.get('field') || '';
      const groupBy = params.get('group_by') || '';
      return renderSumByFieldReport(user, entityName, spec, items, field, groupBy);
    }
    if (report === 'rollup') {
      const refField = params.get('ref_field') || '';
      const rollupField = params.get('rollup_field') || '';
      // The rollup groups by a field on the RELATED entity (refField.ref), so
      // that entity's list access must be checked the same way viewing it
      // directly would be -- a cross-entity report must not become a side
      // channel for reading data the user couldn't otherwise view.
      const refFieldDef = spec.fields?.[refField];
      const relatedEntity = refFieldDef?.ref;
      if (!relatedEntity || !canList(user, relatedEntity)) {
        return renderAccessDenied(user, relatedEntity || entityName, 'view');
      }
      const relatedSpec = getSpec(relatedEntity);
      const relatedRecords = await list(relatedEntity, {}, { user });
      return renderRollupReport(user, entityName, spec, items, refField, relatedEntity, relatedSpec, relatedRecords, rollupField);
    }
    const view = params.get('view');
    if (view === 'board') return renderBoardView(user, entityName, spec, items);
    if (view === 'grid') return renderGridView(user, entityName, spec, items);
    if (view === 'calendar') {
      const month = params.has('month') ? Number(params.get('month')) : undefined;
      const year = params.has('year') ? Number(params.get('year')) : undefined;
      return renderCalendarView(user, entityName, spec, items, { month, year });
    }
    if (view === 'timeline') return renderTimelineView(user, entityName, spec, items);
    const { renderEntityList: lazyEntityList } = await lazyRenderer('entity-renderer.js');
    return lazyEntityList(entityName, items, spec, user);
  }
  if (segments.length === 2 && segments[0] === 'client' && segments[1] !== 'new') {
    if (!canView(user, 'client')) return renderAccessDenied(user, 'client', 'view');
    if (isClientUser(user) && user.client_id && user.client_id !== segments[1]) return renderAccessDenied(user, 'client', 'view');
    const client = await get('client', segments[1], { user }); if (!client) return null;
    return renderClientDashboard(user, client, await getClientDashboardStats(segments[1]));
  }
  if (segments.length === 2) return handleGenericEntityView(user, segments[0], segments[1], req);
  if (segments.length === 3 && segments[2] === 'edit') return handleGenericEntityEdit(user, segments[0], segments[1]);

  return null;
}
