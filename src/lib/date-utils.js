import { now } from './id-helpers.js';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

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

export function isWithinYears(timestamp, minYearsAgo = 10, maxYearsAhead = 5) {
  const nowSec = now();
  return (
    timestamp > nowSec - (minYearsAgo * SECONDS_PER_YEAR) &&
    timestamp < nowSec + (maxYearsAhead * SECONDS_PER_YEAR)
  );
}

export function isBeforeDate(date1, date2) {
  return date1 < date2;
}

export function addDays(days) {
  return now() + (days * SECONDS_PER_DAY);
}

export function addHours(hours) {
  return now() + (hours * SECONDS_PER_HOUR);
}

export function startOfDay(timestamp = now()) {
  const date = new Date(timestamp * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

export function endOfDay(timestamp = now()) {
  return startOfDay(timestamp) + SECONDS_PER_DAY - 1;
}

export function daysRemaining(deadlineTs) {
  const nowSec = now();
  const startOfNextDay = startOfDay(nowSec) + SECONDS_PER_DAY;
  const remaining = deadlineTs - startOfNextDay;
  return Math.ceil(remaining / SECONDS_PER_DAY);
}

export function isPast(timestamp) {
  return now() > timestamp;
}

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

export function isWorkingDay(timestamp) {
  if (!timestamp) return false;
  const day = new Date(timestamp * 1000).getDay();
  return day !== 0 && day !== 6;
}

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

// Financial year runs March 1 to end of February (South African fiscal convention).
export function getFinancialYear(timestamp) {
  const ms = timestamp ? timestamp * 1000 : Date.now();
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 2 ? year : year - 1;
}

export function getFinancialYearRange(year) {
  const start = new Date(year, 2, 1);
  const lastDay = new Date(year + 1, 2, 0).getDate();
  const end = new Date(year + 1, 1, lastDay);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

export function formatCurrency(amount, currency = 'ZAR', locale = 'en-ZA') {
  if (amount === null || amount === undefined) return null;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return null;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(num);
}

export function formatNumber(value, decimals = 0, locale = 'en-ZA') {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return null;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes < 0) return null;
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + suffix;
}

export function toUtcIso(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

// Firestore Timestamp objects expose ._seconds (newer SDK) or .seconds (older); plain numbers and date strings are also accepted.
export function fromFirestoreTimestamp(ts) {
  if (!ts) return null;
  if (ts._seconds !== undefined) return ts._seconds;
  if (ts.seconds !== undefined) return ts.seconds;
  if (typeof ts === 'number') return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}
