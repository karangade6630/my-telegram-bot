/**
 * @fileoverview General validation helpers.
 * Lightweight guards used throughout the codebase.
 * Domain-specific validators live in src/validation/.
 *
 * @module utils/validation
 */

import { SEARCH } from '../config/constants.js';

/**
 * Check if a value is a non-empty string.
 * @param {*} val
 * @returns {boolean}
 */
export function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Check if a value is a positive integer.
 * @param {*} val
 * @returns {boolean}
 */
export function isPositiveInt(val) {
  return Number.isInteger(val) && val > 0;
}

/**
 * Validate a Telegram user ID (positive integer string).
 * @param {*} id
 * @returns {boolean}
 */
export function isValidTelegramId(id) {
  return /^\d+$/.test(String(id ?? ''));
}

/**
 * Validate a movie search query.
 * Returns an error string or null if valid.
 *
 * @param {string} query
 * @returns {string|null} error message or null
 */
export function validateSearchQuery(query) {
  if (!isNonEmptyString(query)) return 'Search query cannot be empty.';
  const trimmed = query.trim();
  if (trimmed.length < SEARCH.MIN_QUERY_LENGTH)
    return `Query too short. Minimum ${SEARCH.MIN_QUERY_LENGTH} characters.`;
  if (trimmed.length > SEARCH.MAX_QUERY_LENGTH)
    return `Query too long. Maximum ${SEARCH.MAX_QUERY_LENGTH} characters.`;
  return null;
}

/**
 * Sanitize a search query — trim, collapse whitespace, remove control chars.
 *
 * @param {string} query
 * @returns {string}
 */
export function sanitizeQuery(query) {
  if (!query) return '';
  return query
    .replace(/[\x00-\x1F\x7F]/g, '')   // strip control characters
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim()
    .slice(0, SEARCH.MAX_QUERY_LENGTH);
}

/**
 * Check if a string looks like a bot command (/start, /help, etc.).
 * @param {string} text
 * @returns {boolean}
 */
export function isBotCommand(text) {
  return /^\/[a-z_]+(@\w+)?(\s|$)/i.test(text ?? '');
}

/**
 * Extract the command name from a message text.
 * "/start@MyBot args" → "/start"
 *
 * @param {string} text
 * @returns {string}
 */
export function extractCommand(text) {
  if (!text) return '';
  const match = text.match(/^(\/[a-z_]+)(?:@\w+)?/i);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Extract arguments after a bot command.
 * "/ban 123456 spam" → "123456 spam"
 *
 * @param {string} text
 * @returns {string}
 */
export function extractCommandArgs(text) {
  if (!text) return '';
  return text.replace(/^\/[a-z_]+(?:@\w+)?\s*/i, '').trim();
}

/**
 * Safely parse JSON, returning null on failure.
 * @param {string} str
 * @returns {*}
 */
export function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Normalize a movie title: trim, collapse whitespace.
 * (Alias kept for backward compat with existing code.)
 *
 * @param {string} title
 * @returns {string}
 */
export function normalizeMovieTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title.replace(/\s+/g, ' ').trim();
}
