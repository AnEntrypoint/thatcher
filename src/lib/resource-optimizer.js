import { userCommittedHours, DEFAULT_WEEKLY_CAPACITY_HOURS } from './resource-capacity.js';

// Ranks a pool of REAL users (queried from the user list, never an arbitrary
// id range) by remaining weekly capacity in the given date range, using the
// exact same overlap-based load calculation checkResourceCapacity already
// enforces -- so a "best fit" suggestion and the prevention check it feeds
// into can never disagree about how loaded a candidate actually is.
// Excludes anyone already at or over capacity entirely (not just ranked
// last), since they are not a valid suggestion regardless of rank.
export async function suggestBestFitUsers(candidateUserIds, startDate, endDate, hoursNeeded, capacityHours = DEFAULT_WEEKLY_CAPACITY_HOURS) {
  const results = [];
  for (const userId of candidateUserIds) {
    const committedHours = await userCommittedHours(userId, startDate, endDate);
    const remainingCapacity = capacityHours - committedHours;
    if (remainingCapacity < hoursNeeded) continue;
    results.push({ user_id: userId, committed_hours: committedHours, remaining_capacity: remainingCapacity });
  }
  results.sort((a, b) => b.remaining_capacity - a.remaining_capacity);
  return results;
}
