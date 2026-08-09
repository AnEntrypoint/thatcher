import { evaluateFormula } from './formula-evaluator.js';

// Formula fields are never stored -- computed at read time from the SAME
// record's own field values so the result can never drift from its inputs
// the way a separately-writable computed column could. Runs right after
// decryption in busybase/store.js's get()/list(), the same choke point
// field-encryption already uses, so it is transparent to every existing
// caller of either function.
export function computeFormulaFields(record, specFields) {
  if (!record || !specFields) return record;
  let result = record;
  for (const [key, fieldDef] of Object.entries(specFields)) {
    if (fieldDef.type !== 'formula' || !fieldDef.formula) continue;
    const allowedFieldNames = new Set(Object.keys(specFields));
    try {
      if (result === record) result = { ...record };
      result[key] = evaluateFormula(fieldDef.formula, record, allowedFieldNames);
    } catch {
      // A malformed/unreferenceable formula must not crash the read path for
      // every other field on the record -- degrade to null for this field
      // only, the same fail-soft pattern current_stock/total_hours already
      // use on their own computation failures in page-handler.js.
      if (result === record) result = { ...record };
      result[key] = null;
    }
  }
  return result;
}
