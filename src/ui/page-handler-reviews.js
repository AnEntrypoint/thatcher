import { list, get } from '@/lib/busybase-store.js';
import { createLogger } from '@/lib/logger.js';
import { getSpec } from '@/config/spec-helpers.js';

const log = createLogger('[PageHandlerReviews]');
import { renderEntityList, renderAccessDenied } from '@/ui/renderer.js';
import { renderSectionReport, renderReviewListTabbed } from '@/ui/review-renderer.js';
import { renderChecklistDetails, renderChecklistsHome } from '@/ui/checklist-renderer.js';
import { renderPdfViewer, renderPdfEditorPlaceholder } from '@/ui/pdf-viewer-renderer.js';
import { renderReviewAnalytics } from '@/ui/review-analytics-renderer.js';
import { renderHighlightThreading } from '@/ui/highlight-threading-renderer.js';
import { renderSectionResolution } from '@/ui/section-resolution-renderer.js';
import { renderReviewComparison, renderComparisonPicker } from '@/ui/review-comparison-renderer.js';
import { renderTenderDashboard } from '@/ui/tender-dashboard-renderer.js';
import { renderBatchOperations } from '@/ui/batch-review-renderer.js';
import { canList, canView, canEdit } from '@/ui/permissions-ui.js';
import { resolveRefFields } from '@/ui/page-handler-helpers.js';
import { fileURLToPath } from 'url';
const __dirname_rv = fileURLToPath(new URL('.', import.meta.url));

async function lazyRenderer(name) {
  const t = globalThis.__reloadTs__ || Date.now();
  return import(`file://${__dirname_rv}${name}?t=${t}`);
}

export async function handleFilteredReviewList(user, filter) {
  if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
  const spec = getSpec('review'); if (!spec) return null;
  const where = filter === 'archive' ? { status: 'archived' } : {};
  let items = await list('review', where);
  if (filter === 'active') items = items.filter(r => r.status === 'active' || r.status === 'open');
  else if (filter === 'priority') { const pids = user.priority_reviews || []; items = items.filter(r => pids.includes(r.id)); }
  else if (filter === 'history') items = items.filter(r => r.status === 'closed' || r.status === 'completed');
  return renderEntityList('review', resolveRefFields(items, spec), spec, user);
}

export async function handleReviewRoutes(normalized, segments, user, req) {
  if (normalized === '/reviews/active' || normalized === '/review/active') return handleFilteredReviewList(user, 'active');
  if (normalized === '/reviews/priority' || normalized === '/review/priority') return handleFilteredReviewList(user, 'priority');
  if (normalized === '/reviews/history' || normalized === '/review/history') return handleFilteredReviewList(user, 'history');
  if (normalized === '/reviews/archive' || normalized === '/review/archive') return handleFilteredReviewList(user, 'archive');

  if (normalized === '/reviews' || normalized === '/review') {
    if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
    let reviews = []; try { reviews = await list('review', {}, { sort: { field: 'updated_at', dir: 'DESC' } }); } catch {}
    const engMap = {}; try { (await list('engagement', {})).forEach(e => { engMap[e.id] = e.name; }); } catch {}
    return renderReviewListTabbed(user, reviews.map(r => ({ ...r, engagement_name: engMap[r.engagement_id] || r.engagement_name || null })));
  }

  if (segments[0] === 'review' && segments.length === 3 && segments[2] === 'sections') {
    const reviewId = segments[1];
    if (!canView(user, 'review')) return renderAccessDenied(user, 'review', 'view');
    const review = await get('review', reviewId);
    if (!review) return null;
    let sections = [];
    try { sections = (await list('review_section', { review_id: reviewId })); } catch (e) { log.error('Failed to fetch sections', { reviewId, message: e?.message || String(e) }); }
    return renderSectionReport(user, review, sections);
  }

  if (normalized === '/reviews/analytics' || normalized === '/review/analytics') {
    if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
    let reviews = [], highlights = [], activity = [];
    try { reviews = await list('review', {}); } catch {}
    try { highlights = await list('highlight', {}); } catch {}
    try { activity = (await list('activity_log', {})).slice(0, 50); } catch {}
    return renderReviewAnalytics(user, { reviews, highlights, recentActivity: activity });
  }

  if (normalized === '/reviews/compare' || normalized === '/review/compare') {
    if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
    const url = new URL(req.url, `http://${req.headers.host||'localhost'}`);
    const leftId = url.searchParams.get('left'), rightId = url.searchParams.get('right');
    if (leftId && rightId) {
      const leftReview = await get('review', leftId), rightReview = await get('review', rightId);
      if (!leftReview || !rightReview) return null;
      let leftH = [], rightH = [];
      try { const all = await list('highlight', {}); leftH = all.filter(h => h.review_id === leftId); rightH = all.filter(h => h.review_id === rightId); } catch {}
      return renderReviewComparison(user, leftReview, rightReview, leftH, rightH);
    }
    let reviews = []; try { reviews = await list('review', {}); } catch {}
    return renderComparisonPicker(user, reviews);
  }

  if (normalized === '/reviews/tenders' || normalized === '/review/tenders') {
    if (!canList(user, 'review')) return renderAccessDenied(user, 'review', 'list');
    let tenders = [], reviews = [];
    try { tenders = await list('tender', {}); } catch {}
    try { reviews = await list('review', {}); } catch {}
    return renderTenderDashboard(user, tenders.map(t => { const r = reviews.find(rev => rev.id === t.review_id); return { ...t, review_name: r?.name || r?.title || '' }; }), reviews);
  }

  if (normalized === '/reviews/batch' || normalized === '/review/batch') {
    if (!canEdit(user, 'review')) return renderAccessDenied(user, 'review', 'edit');
    let reviews = []; try { reviews = await list('review', {}); } catch {}
    const spec = getSpec('review'); if (spec) reviews = resolveRefFields(reviews, spec);
    return renderBatchOperations(user, reviews);
  }

  if (segments[0] === 'review' && segments.length === 3) {
    const reviewId = segments[1], action = segments[2];
    const getReview = (id) => get('review', id);
    if (action === 'pdf') {
      if (!canView(user, 'review')) return renderAccessDenied(user, 'review', 'view');
      const review = await getReview(reviewId); if (!review) return null;
      let h = [], s = [];
      try { h = (await list('highlight', {})).filter(x => x.review_id === reviewId); } catch {}
      try { s = (await list('review_section', {})).filter(x => x.review_id === reviewId); } catch {}
      // Flatten bounding_rect JSON -> x/y/width/height for the overlay renderer.
      h = h.map((x) => {
        let br = null; try { br = typeof x.bounding_rect === 'string' ? JSON.parse(x.bounding_rect) : x.bounding_rect; } catch {}
        let rects = []; try { rects = typeof x.rects === 'string' ? JSON.parse(x.rects) : (x.rects || []); } catch {}
        return {
          ...x,
          x: br?.x1 ?? 0,
          y: br?.y1 ?? 0,
          width: br?.width ?? 0,
          height: br?.height ?? 0,
          rects,
          page_number: Number(x.page_number) || 1,
        };
      });
      return renderPdfViewer(user, review, h, s);
    }
    if (action === 'editor') { if (!canEdit(user, 'review')) return renderAccessDenied(user, 'review', 'edit'); const review = await getReview(reviewId); if (!review) return null; return renderPdfEditorPlaceholder(user, review); }
    if (action === 'highlights') {
      if (!canView(user, 'review')) return renderAccessDenied(user, 'review', 'view');
      const review = await getReview(reviewId); if (!review) return null;
      let h = []; try { h = (await list('highlight', {})).filter(x => x.review_id === reviewId); } catch {}
      const rm = {}; const allResp = await list('highlight_response', {}).catch(() => []);
      for (const x of h) rm[x.id] = allResp.filter(r => r.highlight_id === x.id);
      return renderHighlightThreading(user, review, h, rm);
    }
    if (action === 'resolution') {
      if (!canView(user, 'review')) return renderAccessDenied(user, 'review', 'view');
      const review = await getReview(reviewId); if (!review) return null;
      let s = []; try { s = (await list('review_section', {})).filter(x => x.review_id === reviewId); } catch {}
      const allH = await list('highlight', {}).catch(() => []);
      const hbs = {};
      for (const sec of s) hbs[sec.id] = allH.filter(h => h.review_id === reviewId && h.section_id === sec.id);
      return renderSectionResolution(user, review, s, hbs);
    }
    if (action === 'edit') {
      if (!canEdit(user, 'review')) return renderAccessDenied(user, 'review', 'edit');
      const review = await get('review', reviewId);
      if (!review) return null;
      let engagements = [], teams = [];
      try { engagements = await list('engagement', {}); } catch {}
      try { teams = await list('team', {}); } catch {}
      const { renderReviewEdit } = await lazyRenderer('review-edit-renderer.js');
      return renderReviewEdit(user, review, engagements, teams);
    }
    return null;
  }

  if (segments.length === 2 && segments[0] === 'review' && segments[1] !== 'new') {
    const reviewId = segments[1];
    if (!canView(user, 'review')) return renderAccessDenied(user, 'review', 'view');
    const review = await get('review', reviewId); if (!review) return null;
    let highlights = [], collaborators = [], checklists = [], sections = [], tenders = [];
    try { highlights = (await list('highlight', {})).filter(h => h.review_id === reviewId); } catch {}
    try { collaborators = (await list('collaborator', {})).filter(c => c.review_id === reviewId); } catch {}
    try {
      const allItems = await list('checklist_item', {});
      checklists = (await list('checklist', {})).filter(c => c.review_id === reviewId).map(c => {
        const items = allItems.filter(i => i.checklist_id === c.id);
        return { ...c, total_items: items.length, completed_items: items.filter(i => i.completed).length };
      });
    } catch {}
    try { sections = (await list('review_section', {})).filter(s => s.review_id === reviewId); } catch {}
    try { tenders = (await list('tender', {})).filter(t => t.review_id === reviewId); } catch {}
    const { renderReviewDetail } = await lazyRenderer('review-detail-renderer.js');
    return renderReviewDetail(user, review, highlights, collaborators, checklists, sections, tenders);
  }

  if (segments[0] === 'checklist' && segments.length === 2 && segments[1] !== 'new') {
    const checklistId = segments[1];
    if (!canView(user, 'checklist')) return renderAccessDenied(user, 'checklist', 'view');
    const checklist = await get('checklist', checklistId); if (!checklist) return null;
    let items = [];
    try { items = (await list('checklist_item', { checklist_id: checklistId })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.created_at ?? 0) - (b.created_at ?? 0)); } catch {}
    return renderChecklistDetails(user, checklist, items);
  }

  if (normalized === '/checklists' || normalized === '/checklist') {
    if (!canList(user, 'checklist')) return renderAccessDenied(user, 'checklist', 'list');
    let checklists = [];
    try {
      // Old GROUP BY checklist_id (total + done) -> client-side aggregate.
      const allItems = await list('checklist_item', {});
      const statsMap = {};
      for (const it of allItems) {
        const s = statsMap[it.checklist_id] || (statsMap[it.checklist_id] = { total: 0, done: 0 });
        s.total++; if (it.is_done === 1 || it.is_done === true || it.completed) s.done++;
      }
      checklists = (await list('checklist', {})).map(c => ({ ...c, total_items: statsMap[c.id]?.total || 0, completed_items: statsMap[c.id]?.done || 0 }));
    } catch {}
    return renderChecklistsHome(user, checklists);
  }

  return null;
}
