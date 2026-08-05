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

	// One button per file — show the actual filename so users know exactly what they're downloading
	const rows = files.map((file) => {
		const size = file.size ? `[${file.size}] ` : '';
		const rawName = file.fileName || file.qualityLabel || 'Unknown File';
		// Telegram button text max is ~200 chars; cap at 80 to keep UI clean
		const label = `${size}${rawName}`.slice(0, 80);
		return [{ text: label, callback_data: `${CALLBACK.GET_FILE}:${file.id}` }];
	});

	// Single close button (no Movie Info)
	rows.push([{ text: `${EMOJI.CROSS} Close`, callback_data: CALLBACK.CLOSE }]);

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
	if (imdbUrl) row1.push({ text: '⭐ IMDb', url: imdbUrl });
	if (row1.length) rows.push(row1);

	rows.push([
		{ text: `${EMOJI.DOWNLOAD} Get Files`, callback_data: `${CALLBACK.GET_QUALITY}:${movieId}` },
		{ text: `${EMOJI.BOOKMARK} Watchlist`, callback_data: `${CALLBACK.WATCHLIST_ADD}:${movieId}` },
		{ text: `${EMOJI.HEART} Favorite`, callback_data: `${CALLBACK.FAVORITE_ADD}:${movieId}` },
	]);

	rows.push([{ text: `${EMOJI.CROSS} Close`, callback_data: CALLBACK.CLOSE }]);

	return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────────────────────
// SEARCH RESULT KEYBOARD
// ─────────────────────────────────────────────────────────────

/**
 * Build a search results list keyboard — one button per movie result.
 * Each button shows "[size] Title (year)" and pagination shows PAGE | 1/12 | NEXT ⇒.
 *
 * @param {import('../models/Movie.js').Movie[]} movies
 * @param {string}  query
 * @param {number}  page
 * @param {number}  totalPages
 * @returns {object}
 */
export function buildSearchResultsKeyboard(movies, query, page, totalPages) {
	const safeQuery = String(query || '').slice(0, 40);
	const rows = movies.map((movie) => {
		// Build label: show file size if available, then title + year
		const sizeLabel = movie.totalSize ? `[${movie.totalSize}] ` : '';
		const yearLabel = movie.year ? ` (${movie.year})` : '';
		return [
			{
				text: `${sizeLabel}${movie.title}${yearLabel}`,
				callback_data: `${CALLBACK.MOVIE_INFO}:${movie.id}`,
			},
		];
	});

	// Pagination row: PAGE | 1/12 | NEXT ⇒
	const navRow = [];
	if (totalPages > 1) {
		navRow.push({ text: 'PAGE', callback_data: CALLBACK.NOOP });
		navRow.push({ text: `${page}/${totalPages}`, callback_data: CALLBACK.NOOP });
		if (page < totalPages) {
			navRow.push({
				text: 'NEXT ⇒',
				callback_data: `${CALLBACK.PAGE}:${page + 1}:${safeQuery}`,
			});
		} else {
			navRow.push({ text: '—', callback_data: CALLBACK.NOOP });
		}
		rows.push(navRow);
	} else if (page > 1) {
		// Only back navigation
		rows.push([
			{ text: '⇐ PREV', callback_data: `${CALLBACK.PAGE}:${page - 1}:${safeQuery}` },
			{ text: `${page}/${totalPages}`, callback_data: CALLBACK.NOOP },
			{ text: '—', callback_data: CALLBACK.NOOP },
		]);
	}

	// On non-first pages we also want a PREV slot in the row
	if (page > 1 && totalPages > 1) {
		// Replace nav row to include ⇐ PREV
		rows[rows.length - 1] = [
			{ text: '⇐ PREV', callback_data: `${CALLBACK.PAGE}:${page - 1}:${safeQuery}` },
			{ text: `${page}/${totalPages}`, callback_data: CALLBACK.NOOP },
			page < totalPages
				? { text: 'NEXT ⇒', callback_data: `${CALLBACK.PAGE}:${page + 1}:${safeQuery}` }
				: { text: '—', callback_data: CALLBACK.NOOP },
		];
	}

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
				{ text: '📊 Stats', callback_data: 'admin:stats' },
				{ text: '👥 Users', callback_data: 'admin:users' },
			],
			[
				{ text: '🎬 Movies', callback_data: 'admin:movies' },
				{ text: '📢 Broadcast', callback_data: 'admin:broadcast' },
			],
			[
				{ text: '⚙️ Settings', callback_data: 'admin:settings' },
				{ text: '🔧 Channels', callback_data: 'admin:channels' },
			],
			[
				{ text: '📋 Logs', callback_data: 'admin:logs' },
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
		inline_keyboard: [
			[
				{ text: '✅ Yes', callback_data: `${CALLBACK.CONFIRM_YES}:${action}` },
				{ text: '❌ No', callback_data: CALLBACK.CONFIRM_NO },
			],
		],
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
	const rows = channels.filter((c) => c.channel_url).map((c) => [{ text: `📢 Join ${c.title ?? 'Channel'}`, url: c.channel_url }]);

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
		inline_keyboard: [
			[
				{
					text: `${EMOJI.ROBOT} Open Bot`,
					url: `https://t.me/${botUsername}?start=movie_${movieId}`,
				},
			],
		],
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
		inline_keyboard: [
			[
				{ text: `${EMOJI.DOWNLOAD} Get Files`, callback_data: `${CALLBACK.GET_QUALITY}:${movieId}` },
				{ text: '🗑 Remove', callback_data: `${CALLBACK.WATCHLIST_RM}:${movieId}` },
			],
		],
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
	const normalized = String(query ?? '').trim();
	if (!normalized) return '';
	const encoded = encodeURIComponent(normalized);
	return encoded.length > 56 ? encoded.slice(0, 56) : encoded;
}
