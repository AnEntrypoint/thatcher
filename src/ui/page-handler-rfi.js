import { list, get } from '@/lib/query-engine.js';
import { getDatabase } from '@/lib/database-core.js';
import { canView, canList, isClerk, isPartner } from '@/ui/permissions-ui.js';
import { renderAccessDenied } from '@/ui/renderer.js';
import { renderRfiList } from '@/ui/rfi-list-renderer.js';
import { fileURLToPath } from 'url';
const __dirname_rfi = fileURLToPath(new URL('.', import.meta.url));
const lazyR = (name) => import(`file://${__dirname_rfi}${name}?t=${globalThis.__reloadTs__ || Date.now()}`);

export async function handleRfiDetail(user, rfiId) {
  if (!canView(user, 'rfi')) return renderAccessDenied(user, 'rfi', 'view');
  const db = getDatabase();
  const rfi = db.prepare('SELECT * FROM rfis WHERE id=?').get(rfiId) || get('rfi', rfiId); if (!rfi) return null;
  let questions = []; try { questions = db.prepare('SELECT q.*, (SELECT COUNT(*) FROM rfi_responses r WHERE r.question_id=q.id) as response_count FROM rfi_questions q WHERE q.rfi_id=?').all(rfiId); } catch { try { questions = list('rfi_question', {}).filter(q => q.rfi_id === rfiId); } catch {} }
  let sections = []; try { sections = list('rfi_section', {}).filter(s => s.rfi_id === rfiId || s.engagement_id === rfi.engagement_id); } catch {}
  let engagement = null; try { if (rfi.engagement_id) engagement = get('engagement', rfi.engagement_id); } catch {}
  const { renderRfiDetail } = await lazyR('rfi-detail-renderer.js');
  return renderRfiDetail(user, rfi, questions, sections, engagement);
}

export async function handleRfiList(user) {
  if (!canList(user, 'rfi')) return renderAccessDenied(user, 'rfi', 'list');
  let rfis = []; try { rfis = getDatabase().prepare('SELECT * FROM rfis ORDER BY created_at ASC').all(); } catch {}
  let engagements = []; try { engagements = list('engagement', {}); } catch {}
  if (isClerk(user)) rfis = rfis.filter(r => engagements.filter(e => e.assigned_to === user.id || e.team_id === user.team_id).some(e => e.id === r.engagement_id));
  return renderRfiList(user, rfis.map((r, i) => ({ ...r, display_name: 'RFI #' + (i + 1) })), engagements);
}

export async function handleRfiReport(user, rfiId, res) {
  const db = getDatabase();
  let rfi = null, questions = [], responses = [], engagement = null;
  try { rfi = get('rfi', rfiId) || db.prepare('SELECT * FROM rfis WHERE id=?').get(rfiId); } catch {}
  if (!rfi) return null;
  try { questions = db.prepare('SELECT * FROM rfi_questions WHERE rfi_id=? ORDER BY created_at ASC').all(rfiId); } catch {}
  try { const qIds = questions.map(q => q.id); if (qIds.length) { const ph = qIds.map(() => '?').join(','); responses = db.prepare(`SELECT * FROM rfi_responses WHERE question_id IN (${ph})`).all(...qIds); } } catch {}
  try { engagement = rfi.engagement_id ? (get('engagement', rfi.engagement_id) || db.prepare('SELECT * FROM engagement WHERE id=?').get(rfi.engagement_id)) : null; } catch {}
  const { renderRfiReport } = await lazyR('rfi-report-renderer.js');
  const html = renderRfiReport(user, rfi, engagement, questions, responses);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
  res.writeHead(200); res.end(html); return 'HANDLED';
}
