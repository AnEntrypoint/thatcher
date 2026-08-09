// Single source of truth for resource-allocation load math, extracted from
// entity-validators.js's checkResourceCapacity so the over-allocation
// PREVENTION check and the resource-optimizer's SUGGESTION ranking compute a
// user's committed load identically -- two independently-maintained copies
// of the same overlap/sum formula would inevitably drift.
export const DEFAULT_WEEKLY_CAPACITY_HOURS = 40;

// Two date ranges overlap unless one entirely precedes the other -- the
// standard interval-intersection test, not a same-day/exact-match check.
export function rangesOverlap(startA, endA, startB, endB) {
  return Number(startA) <= Number(endB) && Number(startB) <= Number(endA);
}

// Sum of allocated_hours_per_week across every existing allocation for
// userId whose date range overlaps [startDate, endDate], excluding
// excludeAllocationId (the record being updated, if any, so it doesn't
// double-count itself). Reads via list('resource_allocation', {user_id}),
// the same unscoped-internal lookup pattern every other entity-specific
// check this session (checkStockBalance/checkContractDateOrder) already
// uses -- no user context threaded through this layer.
export async function userCommittedHours(userId, startDate, endDate, excludeAllocationId = null) {
  const { list } = await import('./busybase/store.js');
  const existingAllocations = await list('resource_allocation', { user_id: userId });
  const overlapping = existingAllocations.filter(a =>
    a.id !== excludeAllocationId && rangesOverlap(startDate, endDate, a.start_date, a.end_date)
  );
  return overlapping.reduce((sum, a) => sum + (Number(a.allocated_hours_per_week) || 0), 0);
}
