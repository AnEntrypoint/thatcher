/**
 * XState Workflow Engine - State machine-based workflow management for Thatcher
 * Replaces the legacy workflow engine with xstate v5 state machines and actors
 */

import { createMachine, createActor, assign, fromPromise, sendParent } from 'xstate';
import { getConfigEngineSync } from './config-generator-engine.js';
import { hookEngine } from './hook-engine.js';
import { AppError } from './error-handler.js';
import { HTTP } from '../config/constants.js';
import { createLogger } from './logger.js';

const logger = createLogger('[XStateWorkflow]');

const _actors = new Map();
const _transitionHistory = [];
const MAX_HISTORY = 1000;
const LOCKOUT_MS = 300000;

export class XStateWorkflowEngine {
  constructor() {
    this._machineCache = new Map();
    this._inspector = null;
    this._inspectionEvents = [];
  }

  async init() {
    this._setupInspector();

    if (globalThis.__debug__) {
      globalThis.__debug__.expose('xstate', {
        actors: () => this.getActiveActors(),
        machines: () => this.getCachedMachines(),
        history: () => [..._transitionHistory],
        inspector: () => this._inspector,
        stats: () => this.getStats(),
      }, 'XState Workflow Engine');
    }

    logger.info('XState Workflow Engine initialized');
    return this;
  }

  _setupInspector() {
    this._inspector = {
      inspect: (inspectionEvent) => {
        this._inspectionEvents.push({
          type: inspectionEvent.type,
          timestamp: Date.now(),
          actorId: inspectionEvent.actorRef?.id,
          snapshot: inspectionEvent.snapshot?.value,
          event: inspectionEvent.event?.type,
        });

        while (this._inspectionEvents.length > MAX_HISTORY) {
          this._inspectionEvents.shift();
        }
      },
    };
  }

  compileWorkflow(workflowName) {
    if (this._machineCache.has(workflowName)) {
      return this._machineCache.get(workflowName);
    }

    const config = getConfigEngineSync().getConfig();
    const wf = config?.workflows?.[workflowName];
    if (!wf) throw new Error(`Workflow "${workflowName}" not found`);

    const stages = wf.stages || wf.states || [];
    const stageMap = {};
    for (const stage of stages) {
      stageMap[stage.name] = stage;
    }

    const states = {};
    for (const stage of stages) {
      const on = {};

      const forward = stage.forward || [];
      const backward = stage.backward || [];
      const allTransitions = [...forward, ...backward];

      for (const target of allTransitions) {
        const targetCfg = stageMap[target];
        const isForward = forward.includes(target);

        on[`TRANSITION_TO_${target.toUpperCase()}`] = {
          target,
          guard: ({ context }) => {
            if (targetCfg?.requires_role?.length > 0 && context.user?.role) {
              return targetCfg.requires_role.includes(context.user.role);
            }
            if (targetCfg?.entry === 'partner_only' && context.user?.role !== 'partner') {
              return false;
            }
            if (targetCfg?.readonly) return false;
            if (context.lastTransitionAt) {
              const elapsed = Date.now() - context.lastTransitionAt;
              if (elapsed < LOCKOUT_MS) return false;
            }
            return true;
          },
          actions: [
            assign({
              status: () => target,
              previousStatus: ({ context }) => context.status,
              lastTransitionAt: () => Date.now(),
              transitionHistory: ({ context }) => [
                ...context.transitionHistory,
                {
                  from: context.status,
                  to: target,
                  at: Date.now(),
                  user: context.user?.email || 'system',
                  direction: isForward ? 'forward' : 'backward',
                },
              ],
            }),
            ({ context }) => {
              hookEngine.execute(`workflow:${workflowName}:transition`, {
                workflow: workflowName,
                entityId: context.entityId,
                from: context.previousStatus,
                to: target,
                user: context.user,
                direction: isForward ? 'forward' : 'backward',
              }).catch(err => logger.error('Transition hook error', { error: err.message }));

              hookEngine.execute(`transition:${context.entityType}`, {
                entity: context.entityType,
                id: context.entityId,
                from: context.previousStatus,
                to: target,
                user: context.user,
              }).catch(err => logger.error('Entity transition hook error', { error: err.message }));
            },
          ],
        };
      }

      states[stage.name] = {
        on,
        entry: ({ context }) => {
          hookEngine.execute(`workflow:${workflowName}:enter:${stage.name}`, {
            workflow: workflowName,
            entityId: context.entityId,
            stage: stage.name,
            user: context.user,
          }).catch(err => logger.error('Stage entry hook error', { error: err.message }));
        },
        exit: ({ context }) => {
          hookEngine.execute(`workflow:${workflowName}:exit:${stage.name}`, {
            workflow: workflowName,
            entityId: context.entityId,
            stage: stage.name,
            user: context.user,
          }).catch(err => logger.error('Stage exit hook error', { error: err.message }));
        },
      };
    }

    const initialStage = wf.initial || wf.initial_stage || stages[0]?.name;

    const machine = createMachine({
      id: workflowName,
      initial: initialStage,
      context: {
        entityId: null,
        entityType: null,
        user: null,
        status: initialStage,
        previousStatus: null,
        lastTransitionAt: null,
        transitionHistory: [],
        ...wf.context,
      },
      states,
    });

    this._machineCache.set(workflowName, { machine, stageMap, wf });
    return { machine, stageMap, wf };
  }

  createActorForEntity(workflowName, entityId, initialState, user = null, entityType = null) {
    const { machine } = this.compileWorkflow(workflowName);

    const actor = createActor(machine, {
      input: {
        entityId,
        entityType,
        user,
        status: initialState,
      },
      inspect: this._inspector,
    });

    actor.start();

    if (initialState) {
      actor.send({ type: 'SNAPSHOT', status: initialState });
    }

    const actorKey = `${workflowName}:${entityId}`;
    _actors.set(actorKey, {
      actor,
      workflowName,
      entityId,
      entityType,
      createdAt: Date.now(),
    });

    logger.info('Actor created', { workflowName, entityId, actorId: actor.id });
    return actor;
  }

  getActor(workflowName, entityId) {
    const key = `${workflowName}:${entityId}`;
    return _actors.get(key)?.actor;
  }

  getActiveActors() {
    return Array.from(_actors.entries()).map(([key, { actor, workflowName, entityId, entityType, createdAt }]) => ({
      key,
      actorId: actor.id,
      workflowName,
      entityId,
      entityType,
      status: actor.getSnapshot().value,
      createdAt,
      isActive: !actor.getSnapshot().done,
    }));
  }

  stopActor(workflowName, entityId) {
    const key = `${workflowName}:${entityId}`;
    const entry = _actors.get(key);
    if (entry) {
      entry.actor.stop();
      _actors.delete(key);
      logger.info('Actor stopped', { workflowName, entityId });
    }
  }

  sendEvent(workflowName, entityId, eventType, eventData = {}) {
    const actor = this.getActor(workflowName, entityId);
    if (!actor) {
      throw new AppError(`No active actor for ${workflowName}:${entityId}`, 'NO_ACTOR', HTTP.NOT_FOUND);
    }

    actor.send({ type: eventType, ...eventData });
    return actor.getSnapshot();
  }

  getSnapshot(workflowName, entityId) {
    const actor = this.getActor(workflowName, entityId);
    if (!actor) return null;
    return actor.getSnapshot();
  }

  getCachedMachines() {
    return Array.from(this._machineCache.entries()).map(([name, { wf, stageMap }]) => ({
      name,
      stages: Object.keys(stageMap),
      initial: wf.initial || wf.initial_stage,
    }));
  }

  getStats() {
    return {
      activeActors: _actors.size,
      cachedMachines: this._machineCache.size,
      inspectionEvents: this._inspectionEvents.length,
      transitionHistory: _transitionHistory.length,
    };
  }

  async close() {
    for (const [, { actor }] of _actors.entries()) {
      actor.stop();
    }
    _actors.clear();
    this._machineCache.clear();
    this._inspectionEvents.length = 0;
    _transitionHistory.length = 0;
  }
}

let _xstateEngine = null;

export async function createXStateWorkflowEngine() {
  if (!_xstateEngine) {
    _xstateEngine = new XStateWorkflowEngine();
    await _xstateEngine.init();
  }
  return _xstateEngine;
}

export function getXStateWorkflowEngine() {
  return _xstateEngine;
}

export function validateTransition(workflowName, fromState, toState, user) {
  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  if (!wf) throw new Error(`Workflow "${workflowName}" not found`);

  const stages = wf.stages || wf.states || [];
  const stageMap = {};
  for (const stage of stages) {
    stageMap[stage.name] = stage;
  }

  const fromCfg = stageMap[fromState];
  const toCfg = stageMap[toState];

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
  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  if (!wf) return [];

  const stages = wf.stages || wf.states || [];
  const stageMap = {};
  for (const stage of stages) {
    stageMap[stage.name] = stage;
  }

  const currentCfg = stageMap[currentState];
  if (!currentCfg) return [];

  const available = [];
  const candidates = [...(currentCfg.forward || []), ...(currentCfg.backward || [])];
  const currentOrder = currentCfg.order || 0;

  for (const stateName of candidates) {
    try {
      if (record?.last_transition_at) {
        const elapsed = Date.now() / 1000 - record.last_transition_at;
        if (elapsed < LOCKOUT_MS / 1000) continue;
      }

      validateTransition(workflowName, currentState, stateName, user);
      const cfg = stageMap[stateName];
      available.push({
        stage: stateName,
        label: cfg.label || stateName,
        forward: (cfg.order || 0) > currentOrder,
        backward: (cfg.order || 0) < currentOrder,
      });
    } catch {
      // Skip invalid
    }
  }

  return available;
}

export async function transition(entityType, entityId, workflowName, toState, user, reason = '') {
  const { get } = await import('./query-engine.js');
  const { update: updateRecord } = await import('./query-engine-write.js');

  const record = get(entityType, entityId);
  if (!record) throw new AppError('Record not found', 'NOT_FOUND', HTTP.NOT_FOUND);

  validateTransition(workflowName, record.status || record.stage, toState, user);

  const updates = {
    status: toState,
    updated_at: Math.floor(Date.now() / 1000),
  };

  if (reason) {
    updates.transition_reason = reason;
  }

  const updated = updateRecord(entityType, entityId, updates, user);

  _transitionHistory.push({
    entityType,
    entityId,
    workflowName,
    from: record.status,
    to: toState,
    user: user?.email || 'system',
    reason,
    timestamp: Date.now(),
  });

  while (_transitionHistory.length > MAX_HISTORY) {
    _transitionHistory.shift();
  }

  hookEngine.execute(`transition:${entityType}`, {
    entity: entityType,
    id: entityId,
    from: record.status,
    to: toState,
    user,
    record: updated,
  }).catch(err => logger.error('Transition hook error', { error: err.message }));

  return updated;
}

export function getStateField(workflowName) {
  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  return wf?.state_field || 'status';
}

export function getStageLabels(workflowName) {
  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  if (!wf) return {};

  const stages = wf.stages || wf.states || [];
  const labels = {};
  for (const stage of stages) {
    labels[stage.name] = stage.label || stage.name;
  }
  return labels;
}

export function getStateLocks(workflowName, state) {
  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  if (!wf) return [];

  const stages = wf.stages || wf.states || [];
  const stage = stages.find(s => s.name === state);
  return stage?.locks || [];
}

export function getStateActions(workflowName, state) {
  const config = getConfigEngineSync().getConfig();
  const wf = config?.workflows?.[workflowName];
  if (!wf) return [];

  const stages = wf.stages || wf.states || [];
  const stage = stages.find(s => s.name === state);
  return stage?.actions || [];
}

export default XStateWorkflowEngine;