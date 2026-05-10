/**
 * Workflow Engine - State machine management for entity lifecycle transitions
 * Handles validation of state transitions and available actions
 */

import { get, update, create } from './query-engine.js';
import { getConfigEngineSync } from './config-generator-engine.js';
import { AppError } from './error-handler.js';
import { HTTP } from '../config/constants.js';

const LOCKOUT_SECONDS = 300; // 5 minutes default
const workflowCache = new Map();

/**
 * Get workflow definition from config
 * @param {string} workflowName
 * @returns {object}
 */
function getWorkflowDef(workflowName) {
  if (workflowCache.has(workflowName)) {
    return workflowCache.get(workflowName);
  }

  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  if (!wf) throw new Error(`Workflow "${workflowName}" not found in config`);

  const stageMap = {};
  if (wf.stages) {
    for (const stage of wf.stages) {
      stageMap[stage.name] = stage;
    }
  }
  if (wf.states) {
    for (const state of wf.states) {
      stageMap[state.name] = state;
    }
  }

  const def = { ...wf, stageMap };
  workflowCache.set(workflowName, def);
  return def;
}

/**
 * Validate a state transition
 * @param {string} workflowName
 * @param {string} fromState
 * @param {string} toState
 * @param {object} user
 * @returns {{forward: boolean, backward: boolean}}
 * @throws {AppError} if transition invalid
 */
export function validateTransition(workflowName, fromState, toState, user) {
  const def = getWorkflowDef(workflowName);
  const fromCfg = def.stageMap[fromState];
  const toCfg = def.stageMap[toState];

  if (!fromCfg) throw new AppError(`Invalid current state: ${fromState}`, 'INVALID_STATE', HTTP.BAD_REQUEST);
  if (!toCfg) throw new AppError(`Invalid target state: ${toState}`, 'INVALID_STATE', HTTP.BAD_REQUEST);

  const forward = fromCfg.forward || [];
  const backward = fromCfg.backward || [];

  if (!forward.includes(toState) && !backward.includes(toState)) {
    throw new AppError(
      `Cannot transition from "${fromState}" to "${toState}". Allowed: ${[...forward, ...backward].join(', ') || 'none'}`,
      'TRANSITION_INVALID',
      HTTP.BAD_REQUEST
    );
  }

  // Role requirement check
  const requiresRole = toCfg.requires_role || [];
  if (requiresRole.length > 0 && user && !requiresRole.includes(user.role)) {
    throw new AppError(`Role "${user.role}" cannot enter state "${toState}"`, 'INSUFFICIENT_PERMISSIONS', HTTP.FORBIDDEN);
  }

  // Entry constraint (e.g., partner_only)
  if (toCfg.entry === 'partner_only' && user?.role !== 'partner') {
    throw new AppError(`Only partners can enter "${toState}"`, 'ENTRY_CONSTRAINT', HTTP.FORBIDDEN);
  }

  // Readonly check
  if (toCfg.readonly) {
    throw new AppError(`State "${toState}" is read-only`, 'STATE_READONLY', HTTP.FORBIDDEN);
  }

  return {
    forward: forward.includes(toState),
    backward: backward.includes(toState),
  };
}

/**
 * Get available transitions for current state
 * @param {string} workflowName
 * @param {string} currentState
 * @param {object} user
 * @param {object} [record]
 * @returns {Array<{stage: string, label: string, forward: boolean, backward: boolean}>}
 */
export function getAvailableTransitions(workflowName, currentState, user, record = null) {
  const def = getWorkflowDef(workflowName);
  const currentCfg = def.stageMap[currentState];
  if (!currentCfg) return [];

  const available = [];
  const candidates = [...(currentCfg.forward || []), ...(currentCfg.backward || [])];
  const currentOrder = currentCfg.order || 0;

  for (const stateName of candidates) {
    try {
      // Lockout check based on last_transition_at
      if (record?.last_transition_at) {
        const elapsed = (Date.now() / 1000) - record.last_transition_at;
        if (elapsed < LOCKOUT_SECONDS) continue;
      }

      validateTransition(workflowName, currentState, stateName, user);
      const cfg = def.stageMap[stateName];
      available.push({
        stage: stateName,
        label: cfg.label || stateName,
        forward: (cfg.order || 0) > currentOrder,
        backward: (cfg.order || 0) < currentOrder,
      });
    } catch {
      // Skip invalid transitions
    }
  }

  return available;
}

/**
 * Get transition lockout status
 * @param {object} record
 * @returns {{inLockout: boolean, minutesRemaining: number, failedGates: Array}}
 */
export function getTransitionStatus(record) {
  let inLockout = false;
  let minutesRemaining = 0;

  if (record?.last_transition_at) {
    const elapsed = (Date.now() / 1000) - record.last_transition_at;
    if (elapsed < LOCKOUT_SECONDS) {
      inLockout = true;
      minutesRemaining = Math.ceil((LOCKOUT_SECONDS - elapsed) / 60);
    }
  }

  return { inLockout, minutesRemaining, failedGates: [] };
}

/**
 * Execute a state transition
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} workflowName
 * @param {string} toState
 * @param {object} user
 * @param {string} [reason='']
 * @returns {Promise<object>} Updated record
 */
export async function transition(entityType, entityId, workflowName, toState, user, reason = '') {
  // Validate transition
  const record = get(entityType, entityId);
  if (!record) throw new AppError('Record not found', 'NOT_FOUND', HTTP.NOT_FOUND);

  validateTransition(workflowName, record.status || record.stage, toState, user);

  // Update record
  const updates = {
    status: toState,
    updated_at: Math.floor(Date.now() / 1000),
  };

  if (reason) {
    updates.transition_reason = reason;
  }

  // Dynamically import write engine to avoid circular dependency
  const { update: updateRecord } = await import('./query-engine-write.js');
  const updated = updateRecord(entityType, entityId, updates, user);

  // Execute hooks
  executeHook(`transition:${entityType}`, {
    entity: entityType,
    id: entityId,
    from: record.status,
    to: toState,
    user,
    record: updated,
  }).catch(err => console.error('transition hook error:', err));

  return updated;
}

/**
 * Get state field name for workflow (usually 'status' or 'stage')
 * @param {string} workflowName
 * @returns {string}
 */
export function getStateField(workflowName) {
  const def = getWorkflowDef(workflowName);
  return def.state_field || 'status';
}

/**
 * Get stage labels mapping
 * @param {string} workflowName
 * @returns {object}
 */
export function getStageLabels(workflowName) {
  const def = getWorkflowDef(workflowName);
  const labels = {};
  if (def.stages) {
    for (const stage of def.stages) {
      labels[stage.name] = stage.label || stage.name;
    }
  }
  return labels;
}

/**
 * Get locked fields for a state (readonly fields)
 * @param {string} workflowName
 * @param {string} state
 * @returns {string[]}
 */
export function getStateLocks(workflowName, state) {
  const def = getWorkflowDef(workflowName);
  const stage = def.stageMap[state];
  if (!stage) return [];
  return stage.locks || [];
}

/**
 * Get actions available in a state
 * @param {string} workflowName
 * @param {string} state
 * @returns {string[]}
 */
export function getStateActions(workflowName, state) {
  const def = getWorkflowDef(workflowName);
  const stage = def.stageMap[state];
  if (!stage) return [];
  return stage.actions || [];
}
