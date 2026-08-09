import { evaluateFormula } from './formula-evaluator.js';

const AGGREGATE_FUNCTIONS = new Set(['count', 'sum', 'avg']);

// An aggregate formula's list() call re-enters computeFormulaFields for every
// related row, which could itself have an aggregate formula pointing back at
// the original entity -- a config mistake (A aggregates B, B aggregates A)
// would otherwise recurse without bound. A simple depth counter (not
// per-request-scoped -- formula evaluation has no request context threaded
// through it, same as every other computeFormulaFields caller) caps this at
// a depth no legitimate one-hop-or-two-hop aggregate design would ever need.
const MAX_AGGREGATE_DEPTH = 3;
let currentAggregateDepth = 0;

// Cross-entity aggregate formula (task_count-style): join through a field on
// the RELATED entity that points back to THIS record's id -- the reverse
// direction of a normal ref field, since the "one" side of a one-to-many
// relationship never names the "many" side directly. Reuses the exact same
// list(relatedEntity, {[ref_field]: id}) query shape resource_allocation's
// capacity check and the rollup report's ref-join already use, not new join
// logic. Runs WITHOUT a user context in scope -- the same unscoped-internal
// read pattern checkStockBalance/checkResourceCapacity/the same-record
// formula path all already establish for computeFormulaFields' call sites in
// busybase/store.js -- an aggregate is more visibly "reading across
// entities" than the same-record arithmetic case, so this is stated
// explicitly rather than left implicit: it is consistent with, not an
// expansion of, the existing unscoped-lookup contract.
async function evaluateAggregateFormula(aggregate, record, entityName) {
  const { related_entity, ref_field, aggregate_field, fn } = aggregate || {};
  if (typeof related_entity !== 'string' || typeof ref_field !== 'string' || typeof aggregate_field !== 'string') {
    throw new Error('aggregate formula requires related_entity, ref_field, and aggregate_field');
  }
  if (!AGGREGATE_FUNCTIONS.has(fn)) {
    throw new Error(`aggregate formula fn must be one of ${[...AGGREGATE_FUNCTIONS].join(', ')}`);
  }

  const { getSpec } = await import('@/config/spec-helpers');
  const relatedSpec = getSpec(related_entity);
  if (!relatedSpec) throw new Error(`aggregate formula references unknown entity "${related_entity}"`);
  if (!relatedSpec.fields?.[ref_field]) {
    throw new Error(`aggregate formula's ref_field "${ref_field}" does not exist on entity "${related_entity}"`);
  }
  if (aggregate_field !== 'id' && !relatedSpec.fields?.[aggregate_field]) {
    throw new Error(`aggregate formula's aggregate_field "${aggregate_field}" does not exist on entity "${related_entity}"`);
  }

  if (currentAggregateDepth >= MAX_AGGREGATE_DEPTH) {
    throw new Error(`aggregate formula exceeded max nesting depth (${MAX_AGGREGATE_DEPTH}) -- check for a cross-entity aggregate cycle`);
  }

  currentAggregateDepth++;
  let relatedRows;
  try {
    const { list } = await import('./busybase/store');
    relatedRows = await list(related_entity, { [ref_field]: record.id });
  } finally {
    currentAggregateDepth--;
  }

  if (fn === 'count') return relatedRows.length;
  if (!relatedRows.length) return 0;
  const values = relatedRows.map(r => Number(r[aggregate_field]) || 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (fn === 'sum') return total;
  return total / values.length; // avg
}

// Formula fields are never stored -- computed at read time so the result
// can never drift from its inputs the way a separately-writable computed
// column could. Runs right after decryption in busybase/store.js's
// get()/list(), the same choke point field-encryption already uses, so it
// is transparent to every existing caller of either function. Two shapes:
// fieldDef.formula (same-record arithmetic expression) and fieldDef.aggregate
// (cross-entity count/sum/avg) -- mutually exclusive per field, checked here.
export async function computeFormulaFields(record, specFields, entityName) {
  if (!record || !specFields) return record;
  let result = record;
  for (const [key, fieldDef] of Object.entries(specFields)) {
    if (fieldDef.type !== 'formula') continue;
    if (!fieldDef.formula && !fieldDef.aggregate) continue;
    if (result === record) result = { ...record };
    try {
      if (fieldDef.aggregate) {
        result[key] = await evaluateAggregateFormula(fieldDef.aggregate, record, entityName);
      } else {
        const allowedFieldNames = new Set(Object.keys(specFields));
        result[key] = evaluateFormula(fieldDef.formula, record, allowedFieldNames);
      }
    } catch {
      // A malformed/unreferenceable formula must not crash the read path for
      // every other field on the record -- degrade to null for this field
      // only, the same fail-soft pattern current_stock/total_hours already
      // use on their own computation failures in page-handler.js.
      result[key] = null;
    }
  }
  return result;
}
