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

// ---------------------------------------------------------------------------
// Additive helpers ported from moonlanding (adapted to Unix-seconds model)
// ---------------------------------------------------------------------------

/**
 * Whether a timestamp falls on a working day (Mon–Fri).
 * @param {number} timestamp - Unix seconds
 * @returns {boolean}
 */
export function isWorkingDay(timestamp) {
  if (!timestamp) return false;
  const day = new Date(timestamp * 1000).getDay();
  return day !== 0 && day !== 6;
}

/**
 * Count working days (inclusive) between two Unix-seconds timestamps.
 * @param {number} startTs - Unix seconds
 * @param {number} endTs - Unix seconds
 * @returns {number}
 */
export function getWorkingDaysDiff(startTs, endTs) {
  if (!startTs || !endTs) return 0;
  const end = new Date(endTs * 1000);
  const current = new Date(startTs * 1000);
  let count = 0;
  while (current <= end) {
    if (current.getDay() !== 0 && current.getDay() !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Add a number of working days (Mon–Fri) to a Unix-seconds timestamp.
 * @param {number} startTs - Unix seconds
 * @param {number} numDays
 * @returns {number} Unix seconds
 */
export function addWorkingDays(startTs, numDays) {
  if (!startTs || numDays <= 0) return startTs;
  const date = new Date(startTs * 1000);
  let added = 0;
  while (added < numDays) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) added++;
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Financial year (Mar 1 – Feb end) for a Unix-seconds timestamp.
 * @param {number} [timestamp] - Unix seconds (defaults to now)
 * @returns {number|null}
 */
export function getFinancialYear(timestamp) {
  const ms = timestamp ? timestamp * 1000 : Date.now();
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 2 ? year : year - 1;
}

/**
 * Start/end Unix-seconds bounds for a financial year (Mar 1 – Feb end).
 * @param {number} year
 * @returns {{ start: number, end: number }}
 */
export function getFinancialYearRange(year) {
  const start = new Date(year, 2, 1);
  const lastDay = new Date(year + 1, 2, 0).getDate();
  const end = new Date(year + 1, 1, lastDay);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

/**
 * Format an amount as currency.
 * @param {number|string} amount
 * @param {string} [currency='ZAR']
 * @param {string} [locale='en-ZA']
 * @returns {string|null}
 */
export function formatCurrency(amount, currency = 'ZAR', locale = 'en-ZA') {
  if (amount === null || amount === undefined) return null;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return null;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(num);
}

/**
 * Format a number with fixed decimals.
 * @param {number|string} value
 * @param {number} [decimals=0]
 * @param {string} [locale='en-ZA']
 * @returns {string|null}
 */
export function formatNumber(value, decimals = 0, locale = 'en-ZA') {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return null;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Human-readable file size.
 * @param {number} bytes
 * @returns {string|null}
 */
export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes < 0) return null;
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Truncate text to a maximum length, appending a suffix.
 * @param {*} text
 * @param {number} [maxLength=100]
 * @param {string} [suffix='...']
 * @returns {string}
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + suffix;
}

/**
 * Convert a Unix-seconds timestamp to a UTC ISO-8601 string.
 * @param {number} timestamp - Unix seconds
 * @returns {string|null}
 */
export function toUtcIso(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Normalize a Firestore timestamp (or number/date) to Unix seconds.
 * @param {*} ts
 * @returns {number|null}
 */
export function fromFirestoreTimestamp(ts) {
  if (!ts) return null;
  if (ts._seconds !== undefined) return ts._seconds;
  if (ts.seconds !== undefined) return ts.seconds;
  if (typeof ts === 'number') return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}
