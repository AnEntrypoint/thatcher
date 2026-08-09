import { list, get } from '@/lib/busybase/store.js';
import { renderAuditDashboard, renderSystemHealth, renderAccessDenied, generateHtml } from '@/ui/renderer.js';
import { renderSettingsHome, renderSettingsSystem, renderSettingsUsers } from '@/ui/settings/home.js';
import { renderSettingsRfiSections } from '@/ui/settings/teams.js';
import { renderSettingsTemplates, renderSettingsChecklists, renderSettingsEntityTypes, renderSettingsEngagementTypes, renderSettingsTemplateManage } from '@/ui/settings/templates.js';
import { renderSettingsNotifications, renderSettingsIntegrations, renderSettingsRecreation, renderSettingsReviewSettings, renderSettingsFileReview, renderSettingsMwrPermissions } from '@/ui/settings/review.js';
import { renderChecklistsManagement } from '@/ui/checklist-renderer.js';
import { renderJobManagement } from '@/ui/job-management-renderer.js';
import { renderWorkflowList, renderWorkflowEditor } from '@/ui/workflow-builder-renderer.js';
import { renderRolesList, renderTemplateList, renderPermissionMatrix } from '@/ui/rbac-renderer.js';
import { renderWebhookList, renderWebhookDetail } from '@/ui/webhook-renderer.js';
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
    try {
      const config = await getSystemConfig();
      const counts = await getSettingsCounts();
      return renderSettingsHome(user, config, counts);
    } catch (err) {
      console.error('Failed to load admin settings:', err);
      return generateHtml('Settings', '<div class="empty-state"><div class="empty-state-title">Failed to load. Refresh.</div><div class="empty-state-desc">The settings could not be loaded. Please refresh the page to try again.</div></div>', []);
    }
  }
  if (normalized === '/admin/settings/system') { const config = await getSystemConfig(); return renderSettingsSystem(user, config); }
  if (normalized === '/admin/settings/users') { return renderSettingsUsers(user, await list('user', {})); }
  if (normalized === '/admin/settings/teams') {
    const { renderSettingsTeams: _rt } = await lazyRenderer('settings/teams.js');
    return _rt(user, await list('team', {}), await list('user', {}));
  }
  if (normalized === '/admin/settings/rfi-sections') {
    let sections = []; try { sections = await list('rfi_section', {}); } catch {}
    return renderSettingsRfiSections(user, sections);
  }
  if (normalized === '/admin/settings/rfi-templates') {
    const { renderSettingsRfiTemplates } = await lazyRenderer('settings-renderer-rfi-templates.js');
    let templates = []; try { templates = await list('rfi_template', {}); } catch {}
    return renderSettingsRfiTemplates(user, templates);
  }
  if (normalized === '/admin/settings/templates') {
    let templates = []; try { templates = await list('review_template', {}); } catch {}
    return renderSettingsTemplates(user, templates);
  }
  if (normalized === '/admin/settings/notifications') { return renderSettingsNotifications(user, await getSystemConfig()); }
  if (normalized === '/admin/settings/integrations') {
    let intSettings = {};
    try { const row = await get('system_settings', 'integration_settings'); intSettings = row?.value ? JSON.parse(row.value) : {}; } catch {}
    return renderSettingsIntegrations(user, intSettings);
  }
  if (normalized === '/admin/settings/checklists') {
    let checklists = []; try { checklists = await list('checklist', {}); } catch {}
    return renderSettingsChecklists(user, checklists);
  }
  if (normalized === '/admin/settings/recreation') {
    return renderSettingsRecreation(user);
  }
  if (normalized === '/admin/settings/entity-types') {
    let items = []; try { items = await list('entity_type', {}); } catch {}
    return renderSettingsEntityTypes(user, items);
  }
  if (normalized === '/admin/settings/engagement-types') {
    let items = []; try { items = await list('engagement_type', {}); } catch {}
    return renderSettingsEngagementTypes(user, items);
  }
  if (normalized === '/admin/settings/permissions') {
    let permissions = []; try { permissions = await list('permission', {}); } catch {}
    return renderSettingsMwrPermissions(user, permissions);
  }
  if (normalized === '/admin/settings/review') { return renderSettingsReviewSettings(user, await getSystemConfig()); }
  if (normalized === '/admin/settings/file-review') {
    let frSettings = {};
    try { const row = await get('system_settings', 'file_review_settings'); frSettings = row?.value ? JSON.parse(row.value) : {}; } catch {}
    return renderSettingsFileReview(user, await getSystemConfig(), frSettings);
  }
  if (normalized.startsWith('/admin/settings/templates/') && segments.length === 4) {
    const templateId = segments[3];
    let template = {}, sections = [];
    try { template = await get('review_template', templateId) || {}; sections = (await list('review_template_section', {})).filter(s => s.review_template_id === templateId); } catch {}
    return renderSettingsTemplateManage(user, template, sections);
  }
  if (normalized === '/admin/settings/checklists/manage') {
    let checklists = [];
    try {
      const cls = await list('checklist', {});
      const allItems = await list('checklist_item', {});
      checklists = cls.map(c => ({ ...c, total_items: allItems.filter(i => i.checklist_id === c.id).length }));
    } catch {}
    return renderChecklistsManagement(user, checklists);
  }
  if (normalized === '/admin/build-logs') {
    let logs = []; try { logs = await list('build_log', {}); } catch {}
    const content = renderBuildLogsContent(logs);
    return generateHtml('Build Logs', content, []);
  }
  if (normalized === '/admin/health') { return renderSystemHealth(user, await getSystemHealth()); }
  if (normalized === '/admin/settings/users/new') {
    const { renderSettingsUserDetail } = await lazyRenderer('settings-user-team-renderer.js');
    return renderSettingsUserDetail(user, {}, await list('team', {}));
  }
  if (segments.length === 4 && segments[2] === 'users' && segments[3] !== 'new') {
    const { renderSettingsUserDetail: _rUD } = await lazyRenderer('settings-user-team-renderer.js');
    return _rUD(user, await get('user', segments[3]) || {}, await list('team', {}));
  }
  if (normalized === '/admin/settings/teams/new') {
    const { renderSettingsTeamDetail } = await lazyRenderer('settings-user-team-renderer.js');
    return renderSettingsTeamDetail(user, {}, await list('user', {}));
  }
  if (segments.length === 4 && segments[2] === 'teams' && segments[3] !== 'new') {
    const { renderSettingsTeamDetail: _rTD } = await lazyRenderer('settings-user-team-renderer.js');
    return _rTD(user, await get('team', segments[3]) || {}, await list('user', {}));
  }
  if (normalized === '/admin/jobs') {
    let jobs = [];
    try { const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js'); const engine = getConfigEngineSync(); const config = engine.getConfig(); jobs = (config.jobs || []).map(j => ({ ...j, status: j.enabled === false ? 'disabled' : 'scheduled' })); } catch {}
    let logs = []; try { logs = (await list('job_log', {})).slice(0, 20); } catch {}
    return renderJobManagement(user, jobs, logs);
  }
  if (normalized === '/admin/workflows') {
    const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
    const engine = getConfigEngineSync();
    const config = engine.getConfig();
    return renderWorkflowList(user, Object.keys(config.workflows || {}));
  }
  if (segments.length === 3 && segments[1] === 'workflows') {
    const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
    const engine = getConfigEngineSync();
    const config = engine.getConfig();
    const workflowDef = config.workflows?.[segments[2]];
    if (!workflowDef) return null;
    return renderWorkflowEditor(user, segments[2], workflowDef);
  }
  if (normalized === '/admin/roles') {
    const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
    const engine = getConfigEngineSync();
    return renderRolesList(user, engine.getRoles());
  }
  if (normalized === '/admin/permissions') {
    const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
    const engine = getConfigEngineSync();
    const config = engine.getConfig();
    return renderTemplateList(user, Object.keys(config.permission_templates || {}));
  }
  if (segments.length === 3 && segments[1] === 'permissions') {
    const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
    const engine = getConfigEngineSync();
    const config = engine.getConfig();
    const roleActionsMap = config.permission_templates?.[segments[2]];
    if (!roleActionsMap) return null;
    const roleNames = Object.keys(engine.getRoles());
    return renderPermissionMatrix(user, segments[2], roleNames, roleActionsMap);
  }
  if (normalized === '/admin/webhooks') {
    let webhooks = []; try { webhooks = await list('webhook', {}); } catch {}
    const { getConfigEngineSync } = await import('@/lib/config-generator-engine.js');
    const engine = getConfigEngineSync();
    const entityNames = engine.getAllEntities().filter(e => e !== 'webhook' && e !== 'webhook_delivery');
    return renderWebhookList(user, webhooks, entityNames);
  }
  if (segments.length === 3 && segments[1] === 'webhooks') {
    const webhook = await get('webhook', segments[2]);
    if (!webhook) return null;
    let deliveries = [];
    try { deliveries = (await list('webhook_delivery', { webhook_id: segments[2] }, { sort: { field: 'created_at', dir: 'DESC' } })).slice(0, 20); } catch {}
    return renderWebhookDetail(user, webhook, deliveries);
  }
  return null;
}
