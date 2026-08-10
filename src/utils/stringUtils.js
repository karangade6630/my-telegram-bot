/**
 * @fileoverview String utilities.
 * Fuzzy matching, Levenshtein distance, slugify, normalization.
 * Pure functions — no side effects, fully testable.
 *
 * @module utils/stringUtils
 */

// ─────────────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a movie title for consistent comparison.
 * Lowercases, strips punctuation, collapses whitespace.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizeTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // punctuation → space
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim();
}

/**
 * Convert a string to a URL-safe slug.
 * "Avengers: Endgame (2019)" → "avengers-endgame-2019"
 *
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Strip common noise words from a movie title to improve matching.
 *
 * @param {string} title
 * @returns {string}
 */
export function stripNoise(title) {
  const NOISE = /\b(the|a|an|and|of|in|for|on|with|is|at|by|from)\b/gi;
  return title.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate a string to a max length, appending ellipsis.
 *
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
export function truncate(str, max = 200) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

/**
 * Capitalize the first letter of each word.
 *
 * @param {string} str
 * @returns {string}
 */
export function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Escape HTML special characters.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
// FUZZY / LEVENSHTEIN
// ─────────────────────────────────────────────────────────────

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * O(n*m) dynamic programming — acceptable for short movie titles.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} edit distance (0 = identical)
 */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;

  // Shortcut for identical strings
  if (a === b) return 0;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use two-row DP to save memory
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Compute similarity between two strings as a ratio 0.0–1.0.
 * 1.0 = identical, 0.0 = completely different.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Returns true if two strings are similar enough (above threshold).
 *
 * @param {string} a
 * @param {string} b
 * @param {number} [threshold=0.6]
 * @returns {boolean}
 */
export function isFuzzyMatch(a, b, threshold = 0.6) {
  return similarity(normalizeTitle(a), normalizeTitle(b)) >= threshold;
}

// ─────────────────────────────────────────────────────────────
// TOKENIZATION
// ─────────────────────────────────────────────────────────────

/**
 * Split a movie title into meaningful tokens.
 * Removes stop words and short tokens.
 *
 * @param {string} title
 * @returns {string[]}
 */
export function tokenize(title) {
  const STOP = new Set(['the','a','an','and','of','in','for','on','with','is','at','by','from','to']);
  return normalizeTitle(title)
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

/**
 * Generate search variants of a title (for OMDB multi-stage fallback).
 * Returns unique, non-empty strings.
 *
 * @param {string} title
 * @returns {string[]}
 */
export function generateTitleVariants(title) {
  const variants = new Set();
  const lower = title.toLowerCase().trim();

  variants.add(title);
  variants.add(lower);
  variants.add(stripNoise(lower));
  variants.add(lower.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim());

  // Remove trailing year e.g. "Title 2024" or "Title (2024)"
  const noYear = lower.replace(/\s+\(\d{4}\)|\s+\d{4}$/, '').trim();
  if (noYear) variants.add(noYear);

  // First two words
  const words = lower.split(/[\s-]+/);
  if (words.length >= 2) variants.add(words.slice(0, 2).join(' '));

  return [...variants].filter(v => v.length > 2);
}

/**
 * Decode common HTML entities.
 *
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim();
}

/**
 * Merge multiple comma-separated string inputs into a single, deduplicated, clean comma-separated string.
 * e.g., mergeCommaValues("Action, Drama", "Dual Audio, Hindi", "Action, English")
 * => "Action, Drama, Dual Audio, Hindi, English"
 *
 * @param {...(string|null|undefined)} inputs
 * @returns {string|null}
 */
export function mergeCommaValues(...inputs) {
  const items = new Set();
  for (const input of inputs) {
    if (!input || typeof input !== 'string') continue;
    const parts = input.split(/[,|/]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        // Capitalize nicely if lowercase single word
        const cleanItem = trimmed.length > 2 ? titleCase(trimmed) : trimmed;
        items.add(cleanItem);
      }
    }
  }
  return items.size > 0 ? Array.from(items).join(', ') : null;
}

