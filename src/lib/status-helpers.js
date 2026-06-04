/**
 * Status Helpers - Status enumerations and transition maps
 * These are the standard status values used by moonlanding parity entities
 */

import { getConfigEngineSync } from './config-generator-engine.js';

// Engagement statuses
export const ENGAGEMENT_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

export const ENGAGEMENT_STAGE = {
  DRAFT: 'draft',
  SCOPE: 'scope',
  KICKOFF: 'kickoff',
  RFI: 'rfi',
  REVIEW: 'review',
  CLOSEOUT: 'closeout',
  CLOSED: 'closed',
};

// RFI statuses
export const RFI_STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  DEFERRED: 'deferred',
  ANSWERED: 'answered',
  CLARIFICATION: 'clarification',
  CLOSED: 'closed',
};

export const RFI_CLIENT_STATUS = {
  PENDING: 'pending',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
};

export const RFI_AUDITOR_STATUS = {
  REVIEW: 'review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Review statuses
export const REVIEW_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  COMPLETED: 'completed',
};

// Highlight statuses
export const HIGHLIGHT_STATUS = {
  OPEN: 'open',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
};

// Standard stage transitions
export const STAGE_TRANSITIONS = {
  draft: 'scope',
  scope: 'kickoff',
  kickoff: 'rfi',
  rfi: 'review',
  review: 'closeout',
  closeout: 'closed',
};

/**
 * Get next stage in standard lifecycle
 * @param {string} currentStage
 * @returns {string|null}
 */
export function getNextStage(currentStage) {
  return STAGE_TRANSITIONS[currentStage] || null;
}

/**
 * Get all valid transitions for an engagement
 * @param {string} currentStage
 * @returns {Array<string>}
 */
export function getValidTransitions(currentStage) {
  const transitions = [];
  for (const [from, to] of Object.entries(STAGE_TRANSITIONS)) {
    if (from === currentStage) transitions.push(to);
  }
  // Also allow backward steps
  for (const [from, to] of Object.entries(STAGE_TRANSITIONS)) {
    if (to === currentStage) transitions.push(from);
  }
  return [...new Set(transitions)];
}

// ---------------------------------------------------------------------------
// Config-driven enrichment (ported from moonlanding status-helpers).
// These are ADDITIVE: each falls back to thatcher's static enums / transition
// maps above when no config engine is initialized, so thatcher's architecture
// and enum model remain authoritative.
// ---------------------------------------------------------------------------

let _cachedConfig = null;

function getCachedConfig() {
  if (!_cachedConfig) {
    try {
      const engine = getConfigEngineSync();
      _cachedConfig = engine.getConfig();
    } catch {
      return null;
    }
  }
  return _cachedConfig;
}

function buildEnumFromWorkflow(workflowName) {
  const stages = getCachedConfig()?.workflows?.[workflowName]?.stages;
  if (!stages) return null;
  const result = {};
  for (const stage of stages) {
    const name = typeof stage === 'string' ? stage : stage.name;
    result[name.toUpperCase()] = name;
  }
  return result;
}

/**
 * Human-readable labels for status/stage values.
 * Built from thatcher's own enums so labels track thatcher's enum model.
 */
function titleCase(v) {
  return String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const STATUS_LABELS = {
  ...Object.fromEntries(Object.values(ENGAGEMENT_STATUS).map((v) => [v, titleCase(v)])),
  ...Object.fromEntries(Object.values(ENGAGEMENT_STAGE).map((v) => [v, titleCase(v)])),
  ...Object.fromEntries(Object.values(RFI_STATUS).map((v) => [v, titleCase(v)])),
  ...Object.fromEntries(Object.values(RFI_CLIENT_STATUS).map((v) => [v, titleCase(v)])),
  ...Object.fromEntries(Object.values(RFI_AUDITOR_STATUS).map((v) => [v, titleCase(v)])),
  ...Object.fromEntries(Object.values(REVIEW_STATUS).map((v) => [v, titleCase(v)])),
  ...Object.fromEntries(Object.values(HIGHLIGHT_STATUS).map((v) => [v, titleCase(v)])),
};

/**
 * Get the display label for a status/stage value.
 * @param {string} value
 * @returns {string}
 */
export function getStatusLabel(value) {
  return STATUS_LABELS[value] || value;
}

/**
 * Resolve engagement stages from config workflow, falling back to ENGAGEMENT_STAGE.
 * @returns {Object}
 */
export function getEngagementStages() {
  return buildEnumFromWorkflow('engagement_lifecycle') || ENGAGEMENT_STAGE;
}

/**
 * Resolve RFI states from config workflow, falling back to RFI_STATUS.
 * @returns {Object}
 */
export function getRfiStates() {
  return buildEnumFromWorkflow('rfi_type_standard') || RFI_STATUS;
}

/**
 * Resolve review stages from config workflow, falling back to REVIEW_STATUS.
 * @returns {Object}
 */
export function getReviewStages() {
  return buildEnumFromWorkflow('review_lifecycle') || REVIEW_STATUS;
}

/**
 * Resolve the engagement stage transition map from config, falling back to
 * thatcher's static STAGE_TRANSITIONS.
 * @returns {Object<string,string>}
 */
export function getStageTransitions() {
  const stages = getCachedConfig()?.workflows?.engagement_lifecycle?.stages;
  if (!stages) return STAGE_TRANSITIONS;
  const result = {};
  for (let i = 0; i < stages.length - 1; i++) {
    const cur = typeof stages[i] === 'string' ? stages[i] : stages[i].name;
    const nxt = typeof stages[i + 1] === 'string' ? stages[i + 1] : stages[i + 1].name;
    result[cur] = nxt;
  }
  return result;
}

/**
 * Check whether a transition between two states is valid for an entity type.
 * @param {string} entityType
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidTransition(entityType, from, to) {
  if (entityType === 'engagement') {
    const transitions = getStageTransitions();
    return transitions[from] === to;
  }
  if (entityType === 'review') {
    const allowed = getValidTransitions(from) || [];
    return allowed.includes(to);
  }
  return false;
}

/**
 * Clear the cached config snapshot (call after a config hot-reload).
 */
export function clearCachedConfig() {
  _cachedConfig = null;
}
