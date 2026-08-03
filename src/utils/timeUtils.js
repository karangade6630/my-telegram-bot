/**
 * @fileoverview Time utilities.
 * ISO timestamps, human-readable durations, relative time.
 *
 * @module utils/timeUtils
 */

/**
 * Return the current UTC time as an ISO-8601 string.
 * Compatible with D1/SQLite TEXT timestamp columns.
 *
 * @returns {string}
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Add seconds to a Date and return the ISO string.
 *
 * @param {number} seconds
 * @param {Date}   [from=new Date()]
 * @returns {string}
 */
export function addSecondsISO(seconds, from = new Date()) {
  return new Date(from.getTime() + seconds * 1000).toISOString();
}

/**
 * Check if an ISO timestamp string is in the past (expired).
 *
 * @param {string} isoString
 * @returns {boolean}
 */
export function isExpired(isoString) {
  if (!isoString) return true;
  return new Date(isoString).getTime() < Date.now();
}

/**
 * Convert milliseconds to a human-readable duration string.
 * e.g. 75_000 → "1m 15s"
 *
 * @param {number} ms
 * @returns {string}
 */
export function msToHuman(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/**
 * Convert seconds to a human-readable duration.
 *
 * @param {number} sec
 * @returns {string}
 */
export function secToHuman(sec) {
  return msToHuman(sec * 1000);
}

/**
 * Relative time from now (e.g. "3 hours ago").
 *
 * @param {string|Date} dateOrISO
 * @returns {string}
 */
export function relativeTime(dateOrISO) {
  const then = new Date(dateOrISO).getTime();
  const diff = Date.now() - then;

  if (diff < 0) return 'in the future';

  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)  return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/**
 * Format a Date as "YYYY-MM-DD".
 *
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Unix timestamp in seconds.
 * @returns {number}
 */
export function unixNow() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Sleep for a given number of milliseconds.
 * Use sparingly in Workers — only in queue jobs.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
