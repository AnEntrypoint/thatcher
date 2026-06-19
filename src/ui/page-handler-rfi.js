import { list, get } from '@/lib/busybase-store.js';
import { canView, canList, isClerk, isPartner } from '@/ui/permissions-ui.js';
import { renderAccessDenied } from '@/ui/renderer.js';
import { renderRfiList } from '@/ui/rfi-list-renderer.js';
import { fileURLToPath } from 'url';
const __dirname_rfi = fileURLToPath(new URL('.', import.meta.url));
const lazyR = (name) => import(`file://${__dirname_rfi}${name}?t=${globalThis.__reloadTs__ || Date.now()}`);

export async function handleRfiDetail(user, rfiId) {
  if (!canView(user, 'rfi')) return renderAccessDenied(user, 'rfi', 'view');
  const rfi = await get('rfi', rfiId); if (!rfi) return null;
  let questions = [];
  try {
    questions = (await list('rfi_question', { rfi_id: rfiId }));
    // Old correlated subquery (response_count per question) -> client-side aggregate.
    const responses = await list('rfi_response', {});
    const counts = {};
    for (const r of responses) counts[r.question_id] = (counts[r.question_id] || 0) + 1;
    questions = questions.map(q => ({ ...q, response_count: counts[q.id] || 0 }));
  } catch {}
  let sections = []; try {
    const [bySectionId, byEngId] = await Promise.all([
      list('rfi_section', { rfi_id: rfiId }),
      list('rfi_section', { engagement_id: rfi.engagement_id }),
    ]);
    const seen = new Set(); sections = [...bySectionId, ...byEngId].filter(s => seen.has(s.id) ? false : seen.add(s.id));
  } catch {}
  let engagement = null; try { if (rfi.engagement_id) engagement = await get('engagement', rfi.engagement_id); } catch {}
  const { renderRfiDetail } = await lazyR('rfi-detail-renderer.js');
  return renderRfiDetail(user, rfi, questions, sections, engagement);
}

export async function handleRfiList(user) {
  if (!canList(user, 'rfi')) return renderAccessDenied(user, 'rfi', 'list');
  let rfis = []; try { rfis = await list('rfi', {}, { sort: { field: 'created_at', dir: 'ASC' } }); } catch {}
  let engagements = []; try { engagements = await list('engagement', {}); } catch {}
  if (isClerk(user)) rfis = rfis.filter(r => engagements.filter(e => e.assigned_to === user.id || e.team_id === user.team_id).some(e => e.id === r.engagement_id));
  return renderRfiList(user, rfis.map((r, i) => ({ ...r, display_name: 'RFI #' + (i + 1) })), engagements);
}

export async function handleRfiReport(user, rfiId, res) {
  let rfi = null, questions = [], responses = [], engagement = null;
  try { rfi = await get('rfi', rfiId); } catch {}
  if (!rfi) return null;
  try { questions = await list('rfi_question', { rfi_id: rfiId }, { sort: { field: 'created_at', dir: 'ASC' } }); } catch {}
  try {
    const qIds = new Set(questions.map(q => q.id));
    if (qIds.size) responses = (await list('rfi_response', {})).filter(r => qIds.has(r.question_id));
  } catch {}
  try { engagement = rfi.engagement_id ? await get('engagement', rfi.engagement_id) : null; } catch {}
  const { renderRfiReport } = await lazyR('rfi-report-renderer.js');
  const html = renderRfiReport(user, rfi, engagement, questions, responses);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
  res.writeHead(200); res.end(html); return 'HANDLED';
}
