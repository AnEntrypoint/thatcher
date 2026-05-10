/**
 * Date/Time Utilities - Common date operations
 */

import { now } from './database-core.js';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

/**
 * Format Unix timestamp to human-readable date
 * @param {number} timestamp - Unix seconds
 * @param {string} [format='short']
 * @returns {string}
 */
export function formatDate(timestamp, format = 'short') {
  if (!timestamp) return '—';
  const date = new Date(timestamp * 1000);

  if (format === 'short') {
    return date.toLocaleDateString();
  }
  if (format === 'long') {
    return date.toLocaleString();
  }
  if (format === 'relative') {
    return formatRelative(timestamp);
  }
  if (format === 'iso') {
    return date.toISOString();
  }
  return date.toLocaleDateString();
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {number} timestamp - Unix seconds
 * @returns {string}
 */
export function formatRelative(timestamp) {
  const nowSec = now();
  const diff = nowSec - timestamp;

  if (diff < 60) return 'just now';
  if (diff < SECONDS_PER_HOUR) {
    const mins = Math.floor(diff / SECONDS_PER_MINUTE);
    return `${mins}m ago`;
  }
  if (diff < SECONDS_PER_DAY) {
    const hrs = Math.floor(diff / SECONDS_PER_HOUR);
    return `${hrs}h ago`;
  }
  if (diff < 7 * SECONDS_PER_DAY) {
    const days = Math.floor(diff / SECONDS_PER_DAY);
    return `${days}d ago`;
  }
  return formatDate(timestamp, 'short');
}

/**
 * Check if timestamp is within allowed year range
 * @param {number} timestamp
 * @param {number} minYearsAgo
 * @param {number} maxYearsAhead
 * @returns {boolean}
 */
export function isWithinYears(timestamp, minYearsAgo = 10, maxYearsAhead = 5) {
  const nowSec = now();
  return (
    timestamp > nowSec - (minYearsAgo * SECONDS_PER_YEAR) &&
    timestamp < nowSec + (maxYearsAhead * SECONDS_PER_YEAR)
  );
}

/**
 * Check if date1 is before date2
 * @param {number} date1 - Unix timestamp
 * @param {number} date2 - Unix timestamp
 * @returns {boolean}
 */
export function isBeforeDate(date1, date2) {
  return date1 < date2;
}

/**
 * Add days to current timestamp
 * @param {number} days
 * @returns {number}
 */
export function addDays(days) {
  return now() + (days * SECONDS_PER_DAY);
}

/**
 * Add hours to current timestamp
 * @param {number} hours
 * @returns {number}
 */
export function addHours(hours) {
  return now() + (hours * SECONDS_PER_HOUR);
}

/**
 * Start of day (midnight) for timestamp
 * @param {number} [timestamp]
 * @returns {number}
 */
export function startOfDay(timestamp = now()) {
  const date = new Date(timestamp * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * End of day (23:59:59) for timestamp
 * @param {number} [timestamp]
 * @returns {number}
 */
export function endOfDay(timestamp = now()) {
  return startOfDay(timestamp) + SECONDS_PER_DAY - 1;
}

/**
 * Get days remaining until deadline
 * @param {number} deadlineTs - Unix timestamp
 * @returns {number} - negative if past due
 */
export function daysRemaining(deadlineTs) {
  const nowSec = now();
  const startOfNextDay = startOfDay(nowSec) + SECONDS_PER_DAY;
  const remaining = deadlineTs - startOfNextDay;
  return Math.ceil(remaining / SECONDS_PER_DAY);
}

/**
 * Check if timestamp is in the past
 * @param {number} timestamp
 * @returns {boolean}
 */
export function isPast(timestamp) {
  return now() > timestamp;
}

/**
 * Format duration in seconds to human-readable
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
