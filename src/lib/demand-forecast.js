// Single source of truth for CRM demand-planning math, shared with any
// future forecast summary view -- the same small pure-computation module
// shape as contract-expiry.js and inventory-forecast.js. Forward-looking
// (open pipeline -> future revenue), the mirror image of
// inventory-forecast.js's backward-looking (movement history -> stockout).
const OPEN_STAGE_EXCLUSIONS = new Set(['won', 'lost']);

function monthBucketKey(dateSeconds) {
  const d = new Date(dateSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// The stage field alone decides "still open" -- not the presence of a
// weighted_value or any date math, so a caller can't accidentally count a
// won/lost opportunity by omission.
function isOpenStage(opportunity) {
  return !OPEN_STAGE_EXCLUSIONS.has(opportunity.stage);
}

// A record already carries weighted_value if it passed through
// busybase/store.js's list()/get() (which now computes formula fields on
// every read) -- reused directly rather than recomputed, so this module
// never drifts from the same formula the opportunity entity itself defines.
// Falls back to computing value*probability/100 independently only if the
// field is genuinely absent (e.g. a deployment whose opportunity entity
// doesn't define weighted_value), never silently treating a present-but-null
// value as "compute it myself" -- null still means the formula ran and
// legitimately produced nothing.
function weightedValueOf(opportunity) {
  if (opportunity.weighted_value !== undefined) return opportunity.weighted_value ?? 0;
  const value = Number(opportunity.value) || 0;
  const probability = Number(opportunity.probability) || 0;
  return (value * probability) / 100;
}

export function projectDemandByMonth(opportunities, nowSeconds = Math.floor(Date.now() / 1000)) {
  const currentBucketKey = monthBucketKey(nowSeconds);
  const buckets = new Map();

  for (const opp of opportunities) {
    if (!isOpenStage(opp)) continue;
    if (opp.expected_close_date == null) continue;

    const bucketKey = monthBucketKey(Number(opp.expected_close_date));
    // A future bucket sorts >= the current month's key lexicographically
    // (YYYY-MM strings compare correctly as dates); a past-due open
    // opportunity's bucket key is strictly less than the current one and is
    // excluded entirely rather than folded into the nearest future bucket --
    // silently reassigning it would misrepresent when the demand was
    // actually expected.
    if (bucketKey < currentBucketKey) continue;

    const weighted = weightedValueOf(opp);
    buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + weighted);
  }

  return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
