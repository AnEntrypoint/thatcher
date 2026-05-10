import { getUser, setCurrentRequest } from '@/engine.server.js';
import { hasGoogleAuth } from '@/config/env.js';
import { getSpec } from '@/config/spec-helpers.js';
import { list, get } from '@/lib/query-engine.js';
import { getDatabase } from '@/lib/database-core.js';
import { renderLogin, renderDashboard, renderEntityList, renderEntityDetail, renderEntityForm, renderAccessDenied, renderPasswordReset, renderPasswordResetConfirm, REDIRECT } from '@/ui/renderer.js';
import { renderClientDashboard, renderClientList } from '@/ui/client-renderer.js';
import { canList, canView, canCreate, canEdit, isPartner, isClerk, isClientUser, canClientAccessEntity } from '@/ui/permissions-ui.js';
import { renderEngagementGrid } from '@/ui/engagement-grid-renderer.js';
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
  const db = getDatabase();
  const engagement = get('engagement', engId) || db.prepare('SELECT * FROM engagement WHERE id=?').get(engId);
  if (!engagement) return null;
  let client = null; try { client = engagement.client_id ? get('client', engagement.client_id) : null; } catch {}
  let rfis = []; try { rfis = db.prepare('SELECT * FROM rfis WHERE engagement_id=?').all(engId); } catch { try { rfis = list('rfi', {}).filter(r => r.engagement_id === engId); } catch {} }
  let sections = []; try { sections = db.prepare('SELECT * FROM rfi_section WHERE engagement_id=? ORDER BY sort_order ASC').all(engId); } catch {}
  let team = null; try { team = engagement.team_id ? get('team', engagement.team_id) : null; } catch {}
  let assignedUsers = [];
  try { const ids = JSON.parse(engagement.users || '[]'); const um = Object.fromEntries(db.prepare('SELECT id, name, email FROM users').all().map(u => [u.id, u.name || u.email])); assignedUsers = ids.map(id => ({ id, name: um[id] || null })).filter(u => u.name); } catch {}
  const { renderEngagementDetail } = await lazyRenderer('engagement-detail-renderer.js');
  return renderEngagementDetail(user, { ...engagement, team_name: team?.name || engagement.team_name, client_name: client?.name || engagement.client_name, assigned_users_resolved: assignedUsers }, client, rfis, sections);
}
async function handleEngagementList(user, req) {
  if (!canList(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'list');
  let engagements = list('engagement', {});
  const clientMap = Object.fromEntries(list('client', {}).map(c => [c.id, c.name]));
  engagements = engagements.map(e => ({ ...e, client_name: clientMap[e.client_id] || e.client_name || '-' }));
  const spec = getSpec('engagement'); if (spec) engagements = resolveRefFields(engagements, spec);
  let teams = []; try { teams = list('team', {}); } catch {}
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
  engagements = engagements.map(e => ({ ...e, team_name: teamMap[e.team_id] || e.team_name || '-' }));
  const years = [...new Set(engagements.map(e => { if (!e.year) return null; const m = String(e.year).match(/\b(20\d{2}|19\d{2})\b/); return m ? m[1] : null; }).filter(Boolean))].sort().reverse();
  const filter = reqUrl(req).searchParams.get('filter') || 'all';
  return renderEngagementGrid(user, engagements, { filter, teams, years });
}
async function handleSearch(user, req) {
  const url = reqUrl(req);
  const q = url.searchParams.get('q') || '', entityFilter = url.searchParams.get('entity') || '', statusFilter = url.searchParams.get('status') || '';
  let teams = []; try { teams = list('team', {}); } catch {}
  const results = {};
  for (const eName of (entityFilter ? [entityFilter] : ['engagement', 'client', 'rfi', 'review'])) {
    try { let items = list(eName, {}); if (q) items = items.filter(i => JSON.stringify(i).toLowerCase().includes(q.toLowerCase())); if (statusFilter) items = items.filter(i => i.status === statusFilter); const spec = getSpec(eName); if (spec) items = resolveRefFields(items, spec); results[eName] = items.slice(0, 50); } catch {}
  }
  return renderAdvancedSearch(user, results, { teams, stages: ['info_gathering', 'commencement', 'team_execution', 'partner_review', 'finalization', 'closeout'] });
}
async function handleGenericEntityView(user, entityName, id) {
  const spec = getSpec(entityName); if (!spec) return null;
  if (isClientUser(user) && !canClientAccessEntity(user, entityName)) return renderAccessDenied(user, entityName, 'view');
  if (id === 'new') {
    if (!canCreate(user, entityName)) return renderAccessDenied(user, entityName, 'create');
    const resolvedSpec = resolveEnumOptions(spec);
    const { renderEntityForm: lazyEntityForm } = await lazyRenderer('entity-renderer.js');
    return lazyEntityForm(entityName, null, resolvedSpec, user, true, getRefOptions(resolvedSpec));
  }
  if (!canView(user, entityName)) return renderAccessDenied(user, entityName, 'view');
  const item = get(entityName, id); if (!item) return null;
  if (item.team_id && user.team_id && item.team_id !== user.team_id && !isPartner(user)) return renderAccessDenied(user, entityName, 'view');
  if (isClientUser(user) && user.client_id && item.client_id && item.client_id !== user.client_id) return renderAccessDenied(user, entityName, 'view');
  const [resolvedItem] = resolveRefFields([item], spec);
  const { renderEntityDetail: lazyEntityDetail } = await lazyRenderer('entity-renderer.js');
  return lazyEntityDetail(entityName, resolvedItem, spec, user);
}
async function handleClientSubRoute(user, clientId, subRoute) {
  if (!canView(user, 'client')) return renderAccessDenied(user, 'client', 'view');
  const client = get('client', clientId); if (!client) return null;
  if (isClientUser(user) && user.client_id && user.client_id !== clientId) return renderAccessDenied(user, 'client', 'view');
  if (subRoute === 'dashboard' || subRoute === 'users') return renderClientDashboard(user, client, getClientDashboardStats(clientId));
  if (subRoute === 'progress') {
    let engagements = []; try { engagements = list('engagement', {}).filter(e => e.client_id === clientId); } catch {}
    const spec = getSpec('engagement'); if (spec) engagements = resolveRefFields(engagements, spec);
    let rfiStats = { total: 0, responded: 0, overdue: 0 };
    try { const allRfis = list('rfi', {}).filter(r => engagements.some(e => e.id === r.engagement_id)); const now = Math.floor(Date.now() / 1000); rfiStats = { total: allRfis.length, responded: allRfis.filter(r => r.status === 'responded' || r.status === 'completed').length, overdue: allRfis.filter(r => r.due_date && r.due_date < now && r.status !== 'closed').length }; } catch {}
    return renderClientProgress(user, client, engagements, rfiStats);
  }
  return null;
}
async function handleGenericEntityEdit(user, entityName, id) {
  const spec = getSpec(entityName); if (!spec) return null;
  if (!canEdit(user, entityName)) return renderAccessDenied(user, entityName, 'edit');
  const item = get(entityName, id); if (!item) return null;
  if (item.team_id && user.team_id && item.team_id !== user.team_id && !isPartner(user)) return renderAccessDenied(user, entityName, 'edit');
  const resolvedSpec = resolveEnumOptions(spec);
  const { renderEntityForm: lazyEntityForm } = await lazyRenderer('entity-renderer.js');
  return lazyEntityForm(entityName, item, resolvedSpec, user, false, getRefOptions(resolvedSpec));
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
  if (normalized === '/notifications') { let notifs=[]; try{notifs=getDatabase().prepare('SELECT * FROM notification WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(user.id)}catch{} const{renderNotificationsPage}=await lazyRenderer('notifications-renderer.js'); return renderNotificationsPage(user,notifs); }
  if (normalized === '/' || normalized === '/dashboard') return renderDashboard(user, await getDashboardStats(user));
  if (normalized.startsWith('/admin/') || normalized === '/admin/jobs') return handleAdminPage(normalized, segments, user);
  if (segments[0] === 'client' && segments.length === 3 && ['dashboard', 'users', 'progress'].includes(segments[2])) return handleClientSubRoute(user, segments[1], segments[2]);
  if (isClerk(user) && segments.length >= 1 && ['user', 'team'].includes(segments[0])) return renderAccessDenied(user, segments[0], 'list');
  if (normalized === '/mwr' || normalized === '/mwr/home') {
    if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
    const db = getDatabase();
    let myReviews = [], sharedReviews = [], recentActivity = [];
    try { myReviews = db.prepare('SELECT * FROM review WHERE created_by=? OR assigned_to=? ORDER BY updated_at DESC LIMIT 100').all(user.id, user.id); } catch { try { myReviews = list('review', {}).filter(r => r.created_by === user.id || r.assigned_to === user.id); } catch {} }
    try { sharedReviews = db.prepare('SELECT r.* FROM review r JOIN collaborator c ON c.review_id=r.id WHERE c.user_id=? ORDER BY r.updated_at DESC LIMIT 100').all(user.id); } catch {}
    try { recentActivity = db.prepare("SELECT * FROM audit_logs WHERE entity_type='review' ORDER BY timestamp DESC LIMIT 50").all(); } catch {}
    const all = [...myReviews, ...sharedReviews];
    const stats = { myReviews, sharedReviews, recentActivity, totalReviews: all.length, activeReviews: all.filter(r => (r.status||'open') !== 'archived' && (r.status||'open') !== 'completed' && (r.status||'open') !== 'closed').length, flaggedReviews: all.filter(r => r.flagged).length, overdueReviews: 0 };
    const { renderMwrHome } = await lazyRenderer('review-mwr-renderer.js');
    return renderMwrHome(user, stats);
  }
  const reviewResult = await handleReviewRoutes(normalized, segments, user, req);
  if (reviewResult !== null) return reviewResult;

  if (normalized === '/engagements') return handleEngagementList(user, req);
  if (normalized === '/search') return handleSearch(user, req);
  if (normalized === '/ml-console') {
    const db = getDatabase();
    let candidates = []; let reviewMap = {};
    try {
      candidates = db.prepare(`SELECT * FROM highlight
        WHERE (comment IS NOT NULL AND comment != '')
        AND (comment LIKE '%?' OR length(comment) > 40)
        ORDER BY created_at DESC LIMIT 50`).all();
      const revIds = [...new Set(candidates.map((c) => c.review_id))];
      if (revIds.length) {
        const ph = revIds.map(() => '?').join(',');
        const rows = db.prepare(`SELECT id, name FROM review WHERE id IN (${ph})`).all(...revIds);
        reviewMap = Object.fromEntries(rows.map((r) => [r.id, r.name || '-']));
      }
    } catch {}
    const { renderMlConsole } = await lazyRenderer('ml-console-renderer.js');
    return renderMlConsole(user, candidates, reviewMap);
  }
  if (segments.length === 2 && (segments[0] === 'engagements' || segments[0] === 'engagement') && segments[1] !== 'new') return handleEngagementDetail(user, segments[1]);
  if (segments[0] === 'engagement' && segments.length === 3 && segments[2] === 'letter') {
    if (!canView(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'view');
    const engagement = get('engagement', segments[1]); if (!engagement) return null;
    return renderLetterWorkflow(user, engagement);
  }
  if (segments[0] === 'engagement' && segments.length === 3 && segments[2] === 'report') {
    if (!canView(user, 'engagement')) return renderAccessDenied(user, 'engagement', 'view');
    const engId = segments[1]; const engagement = get('engagement', engId); if (!engagement) return null;
    const db = getDatabase(); let client=null,team=null,rfis=[],reviews=[],highlights=[],activity=[];
    try{client=engagement.client_id?get('client',engagement.client_id):null}catch{}
    try{team=engagement.team_id?get('team',engagement.team_id):null}catch{}
    try{rfis=db.prepare('SELECT * FROM rfi WHERE engagement_id=? ORDER BY created_at DESC').all(engId)}catch{}
    try{reviews=db.prepare('SELECT * FROM review WHERE engagement_id=? ORDER BY created_at DESC').all(engId)}catch{}
    try{const rids=reviews.map(r=>r.id);if(rids.length){const ph=rids.map(()=>'?').join(',');highlights=db.prepare(`SELECT * FROM highlight WHERE review_id IN (${ph})`).all(...rids)}}catch{}
    try{activity=db.prepare("SELECT * FROM audit_logs WHERE entity_type='engagement' AND entity_id=? ORDER BY timestamp DESC LIMIT 20").all(engId)}catch{}
    const{renderFlexupReport}=await lazyRenderer('flexup-report-renderer.js');
    return renderFlexupReport(user,engagement,client,rfis,reviews,highlights,activity,team);
  }
  if (segments.length === 3 && segments[0] === 'rfi' && segments[2] === 'report') return handleRfiReport(user, segments[1], res);
  if (segments.length === 2 && segments[0] === 'rfi' && segments[1] !== 'new') return handleRfiDetail(user, segments[1]);
  if (segments.length === 1 && segments[0] === 'rfi') return handleRfiList(user);
  if (segments.length === 1 && segments[0] === 'client') {
    if (!canList(user, 'client')) return renderAccessDenied(user, 'client', 'list');
    let clients = list('client', {});
    if (isClientUser(user) && user.client_id) clients = clients.filter(c => c.id === user.client_id);
    return renderClientList(user, clients);
  }
  if (segments.length === 1) {
    const entityName = segments[0];
    const spec = getSpec(entityName); if (!spec) return null;
    if (isClientUser(user) && !canClientAccessEntity(user, entityName)) return renderAccessDenied(user, entityName, 'list');
    if (!canList(user, entityName)) return renderAccessDenied(user, entityName, 'list');
    let items = list(entityName, {});
    if (isClientUser(user) && user.client_id) items = items.filter(item => { if (item.client_id) return item.client_id === user.client_id; if (item.assigned_to) return item.assigned_to === user.id; return true; });
    const { renderEntityList: lazyEntityList } = await lazyRenderer('entity-renderer.js');
    return lazyEntityList(entityName, resolveRefFields(items, spec), spec, user);
  }
  if (segments.length === 2 && segments[0] === 'client' && segments[1] !== 'new') {
    if (!canView(user, 'client')) return renderAccessDenied(user, 'client', 'view');
    if (isClientUser(user) && user.client_id && user.client_id !== segments[1]) return renderAccessDenied(user, 'client', 'view');
    const client = get('client', segments[1]); if (!client) return null;
    return renderClientDashboard(user, client, getClientDashboardStats(segments[1]));
  }
  if (segments.length === 2) return handleGenericEntityView(user, segments[0], segments[1]);
  if (segments.length === 3 && segments[2] === 'edit') return handleGenericEntityEdit(user, segments[0], segments[1]);

  return null;
}
