import { list, get } from '@/lib/query-engine.js';
import { renderAuditDashboard, renderSystemHealth, renderAccessDenied, generateHtml, REDIRECT } from '@/ui/renderer.js';
import { renderSettingsHome, renderSettingsSystem, renderSettingsUsers, renderSettingsTeams, renderSettingsRfiSections } from '@/ui/settings-renderer.js';
import { renderSettingsTemplates, renderSettingsNotifications, renderSettingsIntegrations, renderSettingsChecklists, renderSettingsRecreation, renderSettingsEntityTypes, renderSettingsEngagementTypes } from '@/ui/settings-renderer-advanced.js';
import { renderSettingsReviewSettings, renderSettingsFileReview, renderSettingsTemplateManage, renderSettingsMwrPermissions } from '@/ui/settings-renderer-advanced2.js';
import { renderChecklistsManagement } from '@/ui/checklist-renderer.js';
import { renderJobManagement } from '@/ui/job-management-renderer.js';
import { isPartner, isManager } from '@/ui/permissions-ui.js';
import { getSystemConfig, getSettingsCounts, getAuditData, getSystemHealth, renderBuildLogsContent } from '@/ui/page-handler-helpers.js';
import { fileURLToPath } from 'url';
const __dirname_adm = fileURLToPath(new URL('.', import.meta.url));

async function lazyRenderer(name) {
  const t = globalThis.__reloadTs__ || Date.now();
  return import(`file://${__dirname_adm}${name}?t=${t}`);
}

export async function handleAdminPage(normalized, segments, user) {
  if (normalized === '/admin/audit') {
    if (!isPartner(user) && !isManager(user)) return renderAccessDenied(user, 'admin', 'view');
    const auditData = await getAuditData();
    return renderAuditDashboard(user, auditData);
  }
  if (!isPartner(user)) return renderAccessDenied(user, 'admin', 'view');

  if (normalized === '/admin/settings') {
    const config = await getSystemConfig();
    const counts = await getSettingsCounts();
    return renderSettingsHome(user, config, counts);
  }
  if (normalized === '/admin/settings/system') { const config = await getSystemConfig(); return renderSettingsSystem(user, config); }
  if (normalized === '/admin/settings/users') { return renderSettingsUsers(user, list('user', {})); }
  if (normalized === '/admin/settings/teams') {
    const { renderSettingsTeams: _rt } = await lazyRenderer('settings-renderer.js');
    return _rt(user, list('team', {}), list('user', {}));
  }
  if (normalized === '/admin/settings/rfi-sections') {
    let sections = []; try { sections = list('rfi_section', {}); } catch {}
    return renderSettingsRfiSections(user, sections);
  }
  if (normalized === '/admin/settings/rfi-templates') {
    const { renderSettingsRfiTemplates } = await lazyRenderer('settings-renderer-rfi-templates.js');
    let templates = []; try { templates = list('rfi_template', {}); } catch {}
    return renderSettingsRfiTemplates(user, templates);
  }
  if (normalized === '/admin/settings/templates') {
    let templates = []; try { templates = list('review_template', {}); } catch {}
    return renderSettingsTemplates(user, templates);
  }
  if (normalized === '/admin/settings/notifications') { return renderSettingsNotifications(user, await getSystemConfig()); }
  if (normalized === '/admin/settings/integrations') {
    let intSettings = {};
    try { const { getDatabase } = await import('@/lib/database-core.js'); const row = getDatabase().prepare('SELECT value FROM system_settings WHERE key = ?').get('integration_settings'); intSettings = row ? JSON.parse(row.value) : {}; } catch {}
    return renderSettingsIntegrations(user, intSettings);
  }
  if (normalized === '/admin/settings/checklists') {
    let checklists = []; try { checklists = list('checklist', {}); } catch {}
    return renderSettingsChecklists(user, checklists);
  }
  if (normalized === '/admin/settings/recreation') {
    return renderSettingsRecreation(user);
  }
  if (normalized === '/admin/settings/entity-types') {
    let items = []; try { items = list('entity_type', {}); } catch {}
    return renderSettingsEntityTypes(user, items);
  }
  if (normalized === '/admin/settings/engagement-types') {
    let items = []; try { items = list('engagement_type', {}); } catch {}
    return renderSettingsEngagementTypes(user, items);
  }
  if (normalized === '/admin/settings/permissions') {
    let permissions = []; try { permissions = list('permission', {}); } catch {}
    return renderSettingsMwrPermissions(user, permissions);
  }
  if (normalized === '/admin/settings/review') { return renderSettingsReviewSettings(user, await getSystemConfig()); }
  if (normalized === '/admin/settings/file-review') {
    let frSettings = {};
    try { const { getDatabase } = await import('@/lib/database-core.js'); const row = getDatabase().prepare('SELECT value FROM system_settings WHERE key = ?').get('file_review_settings'); frSettings = row ? JSON.parse(row.value) : {}; } catch {}
    return renderSettingsFileReview(user, await getSystemConfig(), frSettings);
  }
  if (normalized.startsWith('/admin/settings/templates/') && segments.length === 4) {
    const templateId = segments[3];
    let template = {}, sections = [];
    try { template = get('review_template', templateId) || {}; sections = list('review_template_section', {}).filter(s => s.review_template_id === templateId); } catch {}
    return renderSettingsTemplateManage(user, template, sections);
  }
  if (normalized === '/admin/settings/checklists/manage') {
    let checklists = [];
    try { checklists = list('checklist', {}).map(c => { let items = []; try { items = list('checklist_item', {}).filter(i => i.checklist_id === c.id); } catch {} return { ...c, total_items: items.length }; }); } catch {}
    return renderChecklistsManagement(user, checklists);
  }
  if (normalized === '/admin/build-logs') {
    let logs = []; try { logs = list('build_log', {}); } catch {}
    const content = renderBuildLogsContent(logs);
    return generateHtml('Build Logs', content, []);
  }
  if (normalized === '/admin/health') { return renderSystemHealth(user, await getSystemHealth()); }
  if (normalized === '/admin/settings/users/new') {
    const { renderSettingsUserDetail } = await lazyRenderer('settings-user-team-renderer.js');
    return renderSettingsUserDetail(user, {}, list('team', {}));
  }
  if (segments.length === 4 && segments[2] === 'users' && segments[3] !== 'new') {
    const { renderSettingsUserDetail: _rUD } = await lazyRenderer('settings-user-team-renderer.js');
    return _rUD(user, get('user', segments[3]) || {}, list('team', {}));
  }
  if (normalized === '/admin/settings/teams/new') {
    const { renderSettingsTeamDetail } = await lazyRenderer('settings-user-team-renderer.js');
    return renderSettingsTeamDetail(user, {}, list('user', {}));
  }
  if (segments.length === 4 && segments[2] === 'teams' && segments[3] !== 'new') {
    const { renderSettingsTeamDetail: _rTD } = await lazyRenderer('settings-user-team-renderer.js');
    return _rTD(user, get('team', segments[3]) || {}, list('user', {}));
  }
  if (normalized === '/admin/jobs') {
    let jobs = [];
    try { const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js'); const engine = getConfigEngineSync(); const config = engine.getConfig(); jobs = (config.jobs || []).map(j => ({ ...j, status: j.enabled === false ? 'disabled' : 'scheduled' })); } catch {}
    let logs = []; try { logs = list('job_log', {}).slice(0, 20); } catch {}
    return renderJobManagement(user, jobs, logs);
  }
  return null;
}
