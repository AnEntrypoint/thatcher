import { hookEngine } from './hook-engine.js';
import { update as updateRecord, create as createRecord } from './busybase/store.js';
import { getConfigEngineSync } from './config-generator-engine.js';
import { createLogger } from './logger.js';

const log = createLogger('[AutomationEngine]');

const OPERATORS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  in: (a, b) => Array.isArray(b) && b.includes(a),
  changed: (a, b, prev, field) => prev && prev[field] !== a,
  present: (a) => a !== null && a !== undefined && a !== '',
};

function evalCondition(cond, data, prev) {
  const { field, op = 'eq', value } = cond;
  const actual = data[field];
  const fn = OPERATORS[op];
  if (!fn) { log.error(`unknown automation operator: ${op}`); return false; }
  return fn(actual, value, prev, field);
}

function evalConditions(conditions, data, prev) {
  if (!conditions || !conditions.length) return true;
  return conditions.every(c => evalCondition(c, data, prev));
}

async function runAction(action, context) {
  const { entity, id, data, user } = context;
  switch (action.type) {
    case 'set_field': {
      const patch = { [action.field]: action.value };
      await updateRecord(entity, id, patch, user);
      return;
    }
    case 'create_entity': {
      const payload = { ...(action.data || {}) };
      for (const [k, v] of Object.entries(payload)) {
        if (typeof v === 'string' && v.startsWith('$')) payload[k] = data[v.slice(1)];
      }
      await createRecord(action.entity, payload, user);
      return;
    }
    case 'notify': {
      await hookEngine.execute('automation:notify', { entity, id, data, user, message: action.message, target: action.target });
      return;
    }
    default:
      log.error(`unknown automation action type: ${action.type}`);
  }
}

function normalizeContext(context) {
  const data = context.data || context.record || {};
  const prev = context.before || context.prev || null;
  return { ...context, data, prev, entity: context.entity, id: context.id ?? data.id };
}

async function runRule(rule, rawContext) {
  const context = normalizeContext(rawContext);
  if (!evalConditions(rule.when, context.data, context.prev)) return;
  for (const action of rule.then || []) {
    try {
      await runAction(action, context);
    } catch (error) {
      log.error(`automation rule "${rule.id || rule.name}" action failed:`, { message: error.message });
    }
  }
}

function getRules(entityName, trigger) {
  let config;
  try {
    config = getConfigEngineSync().getConfig();
  } catch {
    return [];
  }
  const rules = config?.automation?.rules || [];
  return rules.filter(r => (!r.entity || r.entity === entityName) && (!r.trigger || r.trigger === trigger));
}

let registered = false;

export function registerAutomationEngine() {
  if (registered) return;
  registered = true;

  const config = getConfigEngineSync().getConfig();
  const entityNames = Object.keys(config?.entities || {});

  for (const entityName of entityNames) {
    for (const trigger of ['create', 'update', 'delete']) {
      hookEngine.register(`${trigger}:${entityName}:after`, async (context) => {
        for (const rule of getRules(entityName, trigger)) await runRule(rule, context);
        return context;
      });
    }
    hookEngine.register(`transition:${entityName}`, async (context) => {
      for (const rule of getRules(entityName, 'transition')) await runRule(rule, context);
      return context;
    });
  }
}

export function dispatchAutomation(trigger, entity, context) {
  const rules = getRules(entity, trigger);
  return Promise.all(rules.map(rule => runRule(rule, context)));
}
