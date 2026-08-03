/**
 * @fileoverview Keyboard builders for all Telegram inline keyboards.
 * Every UI keyboard is defined here — no keyboard code in handlers/commands.
 *
 * @module telegram/keyboards
 */

import { CALLBACK, EMOJI, PAGINATION } from '../config/constants.js';

// ─────────────────────────────────────────────────────────────
// MOVIE RESULT KEYBOARD
// ─────────────────────────────────────────────────────────────

/**
 * Build quality selection keyboard for a movie.
 * Each button's callback_data encodes the file ID.
 *
 * @param {import('../models/File.js').File[]} files   - Available files
 * @param {number}  movieId
 * @returns {object} Telegram InlineKeyboardMarkup
 */
export function buildQualityKeyboard(files, movieId) {
  if (!files || files.length === 0) {
    return { inline_keyboard: [[{ text: 'No files available', callback_data: CALLBACK.NOOP }]] };
  }

  // Group by quality, deduplicate
  const byQuality = new Map();
  for (const file of files) {
    const key = file.qualityLabel ?? 'UNKNOWN';
    if (!byQuality.has(key)) byQuality.set(key, file);
  }

  // Build one button per quality
  const buttons = [...byQuality.entries()].map(([quality, file]) => ({
    text:          `${file.qualityEmoji} ${quality}${file.isDualAudio ? ' 🔊' : ''}${file.isHdr ? ' HDR' : ''}`,
    callback_data: `${CALLBACK.GET_FILE}:${file.id}`,
  }));

  // Split into rows of 2
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  // Info + close row
  rows.push([
    { text: `${EMOJI.INFO} Movie Info`,  callback_data: `${CALLBACK.MOVIE_INFO}:${movieId}` },
    { text: `${EMOJI.CROSS} Close`,      callback_data: CALLBACK.CLOSE },
  ]);

  return { inline_keyboard: rows };
}

/**
 * Build the movie detail keyboard (info view).
 *
 * @param {number}  movieId
 * @param {string|null} trailerUrl
 * @param {string|null} imdbUrl
 * @returns {object}
 */
export function buildMovieInfoKeyboard(movieId, trailerUrl, imdbUrl) {
  const rows = [];
  const row1 = [];
  if (trailerUrl) row1.push({ text: `${EMOJI.TRAILER} Trailer`, url: trailerUrl });
  if (imdbUrl)    row1.push({ text: '⭐ IMDb', url: imdbUrl });
  if (row1.length) rows.push(row1);

  rows.push([
    { text: `${EMOJI.DOWNLOAD} Get Files`,  callback_data: `${CALLBACK.GET_QUALITY}:${movieId}` },
    { text: `${EMOJI.BOOKMARK} Watchlist`,  callback_data: `${CALLBACK.WATCHLIST_ADD}:${movieId}` },
    { text: `${EMOJI.HEART} Favorite`,      callback_data: `${CALLBACK.FAVORITE_ADD}:${movieId}` },
  ]);

  rows.push([{ text: `${EMOJI.CROSS} Close`, callback_data: CALLBACK.CLOSE }]);

  return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────────────────────
// SEARCH RESULT KEYBOARD
// ─────────────────────────────────────────────────────────────

/**
 * Build a search results list keyboard — one button per movie result.
 *
 * @param {import('../models/Movie.js').Movie[]} movies
 * @param {string}  query
 * @param {number}  page
 * @param {number}  totalPages
 * @returns {object}
 */
export function buildSearchResultsKeyboard(movies, query, page, totalPages) {
  const rows = movies.map(movie => ([{
    text:          `${EMOJI.MOVIE} ${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
    callback_data: `${CALLBACK.MOVIE_INFO}:${movie.id}`,
  }]));

  // Pagination row
  const navRow = [];
  if (page > 1) {
    navRow.push({ text: '◀️ Prev', callback_data: `${CALLBACK.PAGE}:${encodeQuery(query)}:${page - 1}` });
  }
  if (page < totalPages) {
    navRow.push({ text: 'Next ▶️', callback_data: `${CALLBACK.PAGE}:${encodeQuery(query)}:${page + 1}` });
  }
  if (navRow.length) rows.push(navRow);

  rows.push([{ text: `${EMOJI.CROSS} Close`, callback_data: CALLBACK.CLOSE }]);

  return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────────────────────
// ADMIN KEYBOARDS
// ─────────────────────────────────────────────────────────────

/**
 * Build the admin dashboard keyboard.
 * @returns {object}
 */
export function buildAdminKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Stats',       callback_data: 'admin:stats' },
        { text: '👥 Users',       callback_data: 'admin:users' },
      ],
      [
        { text: '🎬 Movies',      callback_data: 'admin:movies' },
        { text: '📢 Broadcast',   callback_data: 'admin:broadcast' },
      ],
      [
        { text: '⚙️ Settings',    callback_data: 'admin:settings' },
        { text: '🔧 Channels',    callback_data: 'admin:channels' },
      ],
      [
        { text: '📋 Logs',        callback_data: 'admin:logs' },
        { text: `${EMOJI.CROSS} Close`, callback_data: CALLBACK.CLOSE },
      ],
    ],
  };
}

/**
 * Build a confirmation keyboard (Yes/No).
 * @param {string} action  - Full callback_data string for the "Yes" button
 * @returns {object}
 */
export function buildConfirmKeyboard(action) {
  return {
    inline_keyboard: [[
      { text: '✅ Yes', callback_data: `${CALLBACK.CONFIRM_YES}:${action}` },
      { text: '❌ No',  callback_data: CALLBACK.CONFIRM_NO },
    ]],
  };
}

// ─────────────────────────────────────────────────────────────
// FORCE SUBSCRIBE KEYBOARD
// ─────────────────────────────────────────────────────────────

/**
 * Build force-subscribe keyboard with channel join buttons.
 *
 * @param {Array<{channel_id: string, channel_url: string, title: string}>} channels
 * @returns {object}
 */
export function buildForceSubKeyboard(channels) {
  const rows = channels
    .filter(c => c.channel_url)
    .map(c => ([{ text: `📢 Join ${c.title ?? 'Channel'}`, url: c.channel_url }]));

  rows.push([{ text: '✅ I Joined — Try Again', callback_data: 'forcesub:check' }]);

  return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────────────────────
// INLINE MODE KEYBOARD
// ─────────────────────────────────────────────────────────────

/**
 * Build inline result keyboard — opens bot in DM.
 *
 * @param {number} movieId
 * @param {string} botUsername
 * @returns {object}
 */
export function buildInlineKeyboard(movieId, botUsername) {
  return {
    inline_keyboard: [[
      {
        text: `${EMOJI.ROBOT} Open Bot`,
        url:  `https://t.me/${botUsername}?start=movie_${movieId}`,
      },
    ]],
  };
}

// ─────────────────────────────────────────────────────────────
// WATCHLIST / FAVORITES
// ─────────────────────────────────────────────────────────────

/**
 * Build watchlist item keyboard.
 * @param {number} movieId
 * @returns {object}
 */
export function buildWatchlistItemKeyboard(movieId) {
  return {
    inline_keyboard: [[
      { text: `${EMOJI.DOWNLOAD} Get Files`, callback_data: `${CALLBACK.GET_QUALITY}:${movieId}` },
      { text: '🗑 Remove',                   callback_data: `${CALLBACK.WATCHLIST_RM}:${movieId}` },
    ]],
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Encode a query string for use in callback_data.
 * Telegram callback_data max is 64 bytes — truncate if needed.
 *
 * @param {string} query
 * @returns {string}
 */
function encodeQuery(query) {
  return encodeURIComponent(query).slice(0, 40);
}
