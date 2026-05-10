/**
 * Configuration loading and management
 * Adapted from moonlanding/src/config/
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Load configuration from YAML file or object
 */
export async function loadConfig(configSource) {
  let config;

  if (typeof configSource === 'string') {
    // File path
    const configPath = path.resolve(process.cwd(), configSource);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    config = yaml.load(content);
  } else if (typeof configSource === 'object') {
    // Raw object
    config = configSource;
  } else {
    throw new Error('Config must be a file path or object');
  }

  return config;
}

/**
 * Validate required configuration sections
 */
export function validateConfig(config) {
  const errors = [];

  if (!config) {
    errors.push('Configuration is empty');
    return errors;
  }

  // Check required sections
  const requiredSections = ['entities', 'roles', 'permission_templates'];
  for (const section of requiredSections) {
    if (!config[section]) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  // Validate roles
  if (config.roles) {
    const roleNames = Object.keys(config.roles);
    if (roleNames.length === 0) {
      errors.push('At least one role must be defined');
    }
  }

  // Validate entities
  if (config.entities) {
    for (const [entityName, entityDef] of Object.entries(config.entities)) {
      if (!entityDef.fields && !entityDef.children) {
        errors.push(`Entity '${entityName}' must have fields or children defined`);
      }
    }
  }

  return errors;
}

/**
 * Get configuration with defaults applied
 */
export function getConfigWithDefaults(userConfig) {
  const defaults = {
    system: {
      pagination: { default_page_size: 50, max_page_size: 500 },
      limits: { max_upload_size: 10485760, max_query_results: 10000 },
    },
    thresholds: {
      timing: { lockout_seconds: 300 },
      ui: { skeleton_count: 3 },
      polling: { chat_ms: 3000, staleness_days: 8 },
    },
    features: {},
    notifications: {},
    automation: { schedules: [] },
    domains: {},
    highlights: { palette: [] },
    icons: {},
    theme: {},
  };

  return deepMerge(defaults, userConfig);
}

/**
 * Deep merge utility
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
