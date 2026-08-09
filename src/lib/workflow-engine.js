// Plain-function entity lifecycle/workflow engine: reads a `config.workflows[name]`
// definition (stages with forward/backward/requires_role/entry/readonly/order/
// locks/actions) and validates+applies transitions against a busybase-backed
// entity record. THIS IS THE LIVE PATH: its `validateTransition` is called from
// src/lib/events-engine.js to gate an `engagement_lifecycle` stage change, a real
// production call site. It is also re-exported from src/lib/index.js (the top-level
// Thatcher class delegates `thatcher.transition()`/`thatcher.getAvailableTransitions()`
// here -- see src/index.js).
//
// xstate-workflow-engine.js implements the SAME job (same config shape, same
// validateTransition/getAvailableTransitions/transition/getStateField/
// getStageLabels/getStateLocks/getStateActions exports, nearly line-for-line
// duplicated validation branches) PLUS a real xstate machine + live per-entity
// actors on top. Despite the more capable implementation, as of this writing its
// only importers repo-wide are a debug route (src/app/api/debug/[[...path]]/route.js,
// which hard-disables itself when NODE_ENV=production) and a root-level manual
// test.js script -- neither is a production call site. So xstate-workflow-engine.js
// does NOT currently supersede this file; if anything the reverse holds (this file
// is live, that one is dormant/debug-only). Re-check import sites before treating
// either as the "old" one.
import { get } from './busybase/store.js';
import { getConfigEngineSync } from './config-generator-engine.js';
import { executeHook } from './hook-engine.js';
import { AppError } from './errors/index.js';
import { HTTP } from '../config/constants.js';
import { createLogger } from './logger.js';

const log = createLogger('[WorkflowEngine]');

const LOCKOUT_SECONDS = 300; // 5 minutes default
const workflowCache = new Map();

export function clearWorkflowCache(workflowName) {
  if (workflowName) workflowCache.delete(workflowName);
  else workflowCache.clear();
}

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

  const requiresRole = toCfg.requires_role || [];
  if (requiresRole.length > 0 && user && !requiresRole.includes(user.role)) {
    throw new AppError(`Role "${user.role}" cannot enter state "${toState}"`, 'INSUFFICIENT_PERMISSIONS', HTTP.FORBIDDEN);
  }

  if (toCfg.entry === 'partner_only' && user?.role !== 'partner') {
    throw new AppError(`Only partners can enter "${toState}"`, 'ENTRY_CONSTRAINT', HTTP.FORBIDDEN);
  }

  if (toCfg.readonly) {
    throw new AppError(`State "${toState}" is read-only`, 'STATE_READONLY', HTTP.FORBIDDEN);
  }

  return {
    forward: forward.includes(toState),
    backward: backward.includes(toState),
  };
}

export function getAvailableTransitions(workflowName, currentState, user, record = null) {
  const def = getWorkflowDef(workflowName);
  const currentCfg = def.stageMap[currentState];
  if (!currentCfg) return [];

  const available = [];
  const candidates = [...(currentCfg.forward || []), ...(currentCfg.backward || [])];
  const currentOrder = currentCfg.order || 0;

  for (const stateName of candidates) {
    try {
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
      // skip
    }
  }

  return available;
}

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

export async function transition(entityType, entityId, workflowName, toState, user, reason = '') {
  // get(...,{user}) enforces the same row/org access scoping every other read
  // path applies -- without it, a transition could read and act on a record
  // outside the caller's org/row-access simply because this is a state-machine
  // write rather than a plain field update, the exact bypass class bulk-ops'
  // delete/set_field actions already close via the same call shape.
  const record = await get(entityType, entityId, { user });
  if (!record) throw new AppError('Record not found', 'NOT_FOUND', HTTP.NOT_FOUND);

  validateTransition(workflowName, record.status || record.stage, toState, user);

  const updates = {
    status: toState,
    updated_at: Math.floor(Date.now() / 1000),
  };

  if (reason) {
    updates.transition_reason = reason;
  }

  // Dynamically import write engine to avoid circular dependency
  const { update: updateRecord } = await import('./busybase/store.js');
  const updated = await updateRecord(entityType, entityId, updates, user);

  executeHook(`transition:${entityType}`, {
    entity: entityType,
    id: entityId,
    from: record.status,
    to: toState,
    user,
    record: updated,
  }).catch(err => log.error('transition hook error:', { message: err?.message || String(err) }));

  return updated;
}

export function getStateField(workflowName) {
  const def = getWorkflowDef(workflowName);
  return def.state_field || 'status';
}

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

export function getStateLocks(workflowName, state) {
  const def = getWorkflowDef(workflowName);
  const stage = def.stageMap[state];
  if (!stage) return [];
  return stage.locks || [];
}

export function getStateActions(workflowName, state) {
  const def = getWorkflowDef(workflowName);
  const stage = def.stageMap[state];
  if (!stage) return [];
  return stage.actions || [];
}
