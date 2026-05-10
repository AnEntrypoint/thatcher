/**
 * Config Generator Engine - Resolves entity specs from YAML config
 * Core of Thatcher's configuration-driven architecture
 * Adapted from moonlanding/src/lib/config-generator-engine.js
 */

import yaml from 'js-yaml';
import { LRUCache, deepFreeze, deepClone, recursiveResolve } from './config-helpers.js';
import { generateFieldsFromOverrides, ensureFieldLabels } from './config-field-helpers.js';

export class ConfigGeneratorEngine {
  constructor(masterConfig) {
    if (!masterConfig) throw new Error('[ConfigGeneratorEngine] masterConfig is required');
    this.masterConfig = deepFreeze(masterConfig);
    this.specCache = new LRUCache(100);
    this._plugins = new Map();
  }

  /**
   * Register a plugin to extend an entity
   */
  registerPlugin(entityName, plugin = {}) {
    if (!entityName || typeof entityName !== 'string') {
      throw new Error('[ConfigGeneratorEngine] registerPlugin: entityName required');
    }

    const existing = this._plugins.get(entityName) || { fields: {}, hooks: [], validators: [] };

    this._plugins.set(entityName, {
      fields: { ...existing.fields, ...(plugin.fields || {}) },
      hooks: [...existing.hooks, ...(plugin.hooks || [])],
      validators: [...existing.validators, ...(plugin.validators || [])],
    });

    this.specCache.clear();

    // Register hooks with global hook engine if available
    for (const { event, handler } of (plugin.hooks || [])) {
      if (event && handler && globalThis.__hookEngine) {
        globalThis.__hookEngine.register(event, handler);
      }
    }

    if (globalThis.__debug__) {
      globalThis.__debug__.expose('plugins', Object.fromEntries(this._plugins.entries()), 'Plugin registry');
    }

    return this;
  }

  getPlugins(entityName) {
    return this._plugins.get(entityName) || null;
  }

  getConfig() {
    return deepFreeze(deepClone(this.masterConfig));
  }

  getRoles() {
    return this._cached('roles:all', () => deepFreeze(deepClone(this.masterConfig.roles || {})));
  }

  getRole(roleName) {
    return this._cached(`role:${roleName}`, () => deepFreeze(deepClone(this._require('roles', roleName))));
  }

  getDomains() {
    return deepFreeze(deepClone(this.masterConfig.domains || {}));
  }

  getHighlightPalette() {
    return deepFreeze(deepClone(this.masterConfig.highlights?.palette || []));
  }

  getSystemConfig() {
    return deepFreeze(deepClone(this.masterConfig.system || {}));
  }

  getRepeatIntervals() {
    return deepFreeze(deepClone(this.masterConfig.repeat_intervals || { once: 'once', monthly: 'monthly', yearly: 'yearly' }));
  }

  getAllEntities() {
    return Object.keys(this.masterConfig.entities || {}).sort();
  }

  getAllAutomations() {
    return deepClone(this.masterConfig.automation?.schedules || []);
  }

  getTheme() {
    return this._cached('theme:all', () => deepFreeze(deepClone(this.masterConfig.theme || {})));
  }

  getIcons() {
    return this._cached('icons:all', () => deepFreeze(deepClone(this.masterConfig.icons || {})));
  }

  getIcon(iconType, iconName) {
    return this.masterConfig.icons?.[iconType]?.[iconName] || null;
  }

  getWorkflow(name) {
    return this._resolved('workflow', 'workflows', name);
  }

  getPermissionTemplate(name) {
    return deepFreeze(deepClone(this._require('permission_templates', name)));
  }

  getStatusEnum(name) {
    return deepFreeze(deepClone(this._require('status_enums', name)));
  }

  getStatuses(name) {
    return this._cached(`statuses:${name}`, () => deepFreeze(deepClone(this._require('status_enums', name))));
  }

  getStatus(entity, status) {
    return this._cached(`status:${entity}:${status}`, () => deepFreeze(deepClone(this._require(`status_enums.${entity}_status`, status))));
  }

  getEntity(name) {
    return this._cached(`entity:${name}`, () => deepFreeze(deepClone(this._require('entities', name))));
  }

  getValidationRule(name) {
    return this._resolved('validation rule', 'validation', name);
  }

  getDocumentTemplate(name) {
    return this._resolved('document template', 'document_generation.templates', name);
  }

  getIntegration(name) {
    return deepFreeze(deepClone(this._require('integrations', name)));
  }

  getThreshold(dotPath) {
    const segments = dotPath.split('.');
    let cur = this.masterConfig.thresholds;
    for (const s of segments) {
      if (cur == null) throw new Error(`[config] Threshold "${dotPath}" not found`);
      cur = cur[s];
    }
    if (cur === undefined) throw new Error(`[config] Threshold "${dotPath}" not found`);
    return typeof cur === 'object' ? deepFreeze(deepClone(cur)) : cur;
  }

  getTimingConfig() {
    return this._cached('thresholds:timing', () => deepFreeze(deepClone(this.getThreshold('timing'))));
  }

  getSystemLimitsConfig() {
    return this._cached('thresholds:system', () => deepFreeze(deepClone(this.getThreshold('system'))));
  }

  getUIConfig() {
    return this._cached('thresholds:ui', () => deepFreeze(deepClone(this.getThreshold('ui'))));
  }

  getPollingConfig() {
    return this._cached('thresholds:polling', () => deepFreeze(deepClone(this.getThreshold('polling'))));
  }

  getWorkflowStages(wfName) {
    return (this.masterConfig.workflows?.[wfName]?.stages || []).map(s => typeof s === 'string' ? s : s.name);
  }

  getStageConfig(wfName, stageName) {
    const stage = (this.masterConfig.workflows?.[wfName]?.stages || []).find(
      s => (typeof s === 'string' ? s : s.name) === stageName
    );
    if (!stage) return null;
    return deepFreeze(recursiveResolve(deepClone(typeof stage === 'string' ? { name: stage } : stage), this.masterConfig));
  }

  getEntitiesForDomain(domain) {
    return [...(this._require('domains', domain).entities || [])];
  }

  isFeatureEnabled(name, ctx = {}) {
    const f = this.masterConfig.features?.[name];
    if (!f || f.enabled === false || f.deprecated) return false;
    if (f.domain && ctx.domain && f.domain !== ctx.domain) return false;
    if (f.workflow_stage && ctx.stage && f.workflow_stage !== ctx.stage) return false;
    if (f.roles && ctx.role && !f.roles.includes(ctx.role)) return false;
    if (f.requires && ctx.features && f.requires.some(r => !ctx.features.includes(r))) return false;
    return true;
  }

  getFieldValue(entity, field) {
    const spec = this.generateEntitySpec(entity);
    if (!spec.fields?.[field]) throw new Error(`[config] Field "${field}" not found for entity "${entity}"`);
    return deepFreeze(deepClone(spec.fields[field]));
  }

  getRolePermissions(role, entity) {
    return [...(this.generateEntitySpec(entity).permissions?.[role] || [])];
  }

  canRoleDoAction(role, entity, action) {
    const p = this.getRolePermissions(role, entity);
    return p.includes(action) || p.includes('all');
  }

  generateNotificationHandler(name) {
    return deepFreeze(recursiveResolve(deepClone(this._require('notifications', name)), this.masterConfig));
  }

  generateAutomationJob(name) {
    const s = (this.masterConfig.automation?.schedules || []).find(s => s.name === name);
    if (!s) throw new Error(`[config] Automation schedule "${name}" not found`);
    return deepFreeze(recursiveResolve(deepClone(s), this.masterConfig));
  }

  cacheSpec(entityName, spec) {
    if (!entityName || !spec) throw new Error('[config] cacheSpec requires entityName and spec');
    this.specCache.set(`spec:${entityName}`, deepFreeze(spec));
    return true;
  }

  invalidateCache() {
    this.specCache.clear();
    this.masterConfig = null;
    return true;
  }

  enableDebug(enabled = true) {
    this.debugMode = enabled;
    return this;
  }

  /**
   * Generate complete entity specification from config
   * This is the main method that builds the spec used by CRUD, UI, etc.
   */
  generateEntitySpec(entityName) {
    if (!entityName) throw new Error('[config] generateEntitySpec: entityName required');

    const cacheKey = `spec:${entityName}`;
    const cached = this.specCache.get(cacheKey);
    if (cached) return deepFreeze(deepClone(cached));

    const config = this.masterConfig;
    let name = entityName;
    let entityDef = config.entities?.[entityName] || (() => {
      const match = Object.keys(config.entities || {}).find(k => {
        const d = config.entities[k];
        return (d.label_plural || d.label || k).toLowerCase() === entityName.toLowerCase();
      });
      if (match) {
        name = match;
        return config.entities[match];
      }
    })();

    if (!entityDef) throw new Error(`[config] Entity "${entityName}" not found`);

    entityDef = deepClone(entityDef);
    const childrenObj = {};
    (entityDef.children || []).forEach(c => { childrenObj[c] = { entity: c }; });

    const spec = {
      name,
      label: entityDef.label || name,
      labelPlural: entityDef.label_plural || entityDef.label || entityName,
      icon: entityDef.icon || 'Circle',
      order: entityDef.order || 999,
      parent: entityDef.parent || null,
      children: childrenObj,
      computed_fields: entityDef.computed_fields || [],
      has_timeline: entityDef.has_timeline || false,
      has_roles: entityDef.has_roles || [],
      has_pdf_viewer: entityDef.has_pdf_viewer || false,
      has_collaboration: entityDef.has_collaboration || false,
      has_tender_tracking: entityDef.has_tender_tracking || false,
      has_notifications: entityDef.has_notifications || false,
      has_authentication: entityDef.has_authentication || false,
      has_google_sync: entityDef.has_google_sync || false,
      recreation_enabled: entityDef.recreation_enabled || false,
      recreation_intervals: entityDef.recreation_intervals || [],
      immutable: entityDef.immutable || false,
      immutable_strategy: entityDef.immutable_strategy || null,
      state_machine: entityDef.state_machine || false,
      row_access: entityDef.row_access || null,
      embedded: entityDef.embedded || false,
      system_entity: entityDef.system_entity || false,
      fields: {},
      options: {},
    };

    // Merge field overrides
    if (entityDef.field_overrides) {
      spec.field_overrides = recursiveResolve(entityDef.field_overrides, config);
    }

    // Build fields from definition + overrides + plugin additions
    const baseFields = entityDef.fields || {};
    const plugin = this._plugins.get(entityName);
    const pluginFields = plugin?.fields || {};

    // Combine and process fields
    const allFields = {
      ...baseFields,
      ...spec.field_overrides,
      ...pluginFields,
    };

    // Ensure required metadata (label, type defaults)
    for (const [key, field] of Object.entries(allFields)) {
      spec.fields[key] = {
        type: field.type || 'text',
        label: field.label || key,
        required: field.required || false,
        unique: field.unique || false,
        readonly: field.readonly || field.readOnly || false,
        hidden: field.hidden || false,
        searchable: field.search || field.searchable || false,
        sortable: field.sortable || field.sort || false,
        default: field.default !== undefined ? field.default : null,
        options: field.options || [],
        ref: field.ref || null,
        display: field.display || null,
        auto: field.auto || null,
        min: field.min,
        max: field.max,
        ...field,
      };
    }

    // Permission matrix
    if (entityDef.permission_template) {
      const matrix = this.getPermissionTemplate(entityDef.permission_template);
      const access = {};
      const roleActions = {};

      for (const [role, actions] of Object.entries(matrix)) {
        if (!Array.isArray(actions)) continue;
        roleActions[role] = [...actions];
        actions.forEach(a => {
          if (!access[a]) access[a] = [];
          access[a].push(role);
        });
      }

      spec.access = access;
      spec.permissions = roleActions;
    }

    // Workflow binding
    if (entityDef.workflow) {
      const wf = this.getWorkflow(entityDef.workflow);
      spec.workflow = wf;
      spec.workflowDef = wf;
      if (wf?.stages && Array.isArray(wf.stages)) {
        const stagesObj = {};
        wf.stages.forEach(s => {
          stagesObj[typeof s === 'string' ? s : s.name] = s;
        });
        entityDef.stages = stagesObj;
      }
    }

    // List options
    if (entityDef.list) {
      spec.list = {
        defaultSort: entityDef.list.defaultSort || { field: 'created_at', dir: 'desc' },
        pageSize: entityDef.list.pageSize || 50,
        filters: entityDef.list.filters || [],
        ...entityDef.list,
      };
    }

    this.specCache.set(cacheKey, deepFreeze(spec));
    return spec;
  }

  // Internal helpers

  _cached(key, fn) {
    const cached = this.specCache.get(key);
    if (cached) return deepFreeze(deepClone(cached));
    const value = fn();
    this.specCache.set(key, value);
    return value;
  }

  _require(section, key) {
    const sectionData = this.masterConfig[section];
    if (!sectionData) throw new Error(`[config] Missing section: ${section}`);
    const value = sectionData[key];
    if (value === undefined) throw new Error(`[config] Key "${key}" not found in ${section}`);
    return value;
  }

  _resolved(type, section, key) {
    const value = this._require(section, key);
    return deepFreeze(recursiveResolve(deepClone(value), this.masterConfig));
  }
}

/**
 * Get or create singleton config engine
 */
let _singleton = null;

export function getConfigEngineSync() {
  if (!_singleton) {
    throw new Error('ConfigEngine not initialized. Call initConfig() first.');
  }
  return _singleton;
}

export async function getConfigEngine() {
  return getConfigEngineSync();
}

/**
 * Initialize config engine from config source
 * @param {string|object} configSource
 * @returns {ConfigGeneratorEngine}
 */
export async function initConfig(configSource) {
  const { loadConfig } = await import('../config/config-loader.js');
  const { validateConfig, getConfigWithDefaults } = await import('../config/config-loader.js');

  const rawConfig = await loadConfig(configSource);
  const config = getConfigWithDefaults(rawConfig);
  const errors = validateConfig(config);

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n- ${errors.join('\n- ')}`);
  }

  _singleton = new ConfigGeneratorEngine(config);
  return _singleton;
}

/**
 * Reset singleton (for hot reload)
 */
export function resetConfigEngine() {
  _singleton = null;
}
