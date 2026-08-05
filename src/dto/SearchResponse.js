/**
 * @fileoverview SearchResponse DTO.
 * Wraps a paginated search result set for the message handler.
 *
 * @module dto/SearchResponse
 */

import { EMOJI, PAGINATION } from '../config/constants.js';

export class SearchResponse {
	/**
	 * @param {object} params
	 * @param {string}   params.query
	 * @param {import('../models/Movie.js').Movie[]} params.movies
	 * @param {number}   params.total
	 * @param {number}   params.page
	 * @param {number}   params.perPage
	 * @param {string}   params.strategy   - Search strategy used
	 * @param {number}   params.durationMs
	 */
	constructor({ query, movies, total, page, perPage, strategy, durationMs }) {
		this.query = query;
		this.movies = movies;
		this.total = total;
		this.page = page ?? PAGINATION.DEFAULT_PAGE;
		this.perPage = perPage ?? PAGINATION.RESULTS_PER_PAGE;
		this.strategy = strategy ?? 'exact';
		this.durationMs = durationMs ?? 0;
	}

	// ─── Computed Properties ──────────────────────────────────

	get isEmpty() {
		return this.movies.length === 0;
	}
	get hasResults() {
		return this.movies.length > 0;
	}
	get totalPages() {
		return Math.ceil(this.total / this.perPage);
	}
	get hasNextPage() {
		return this.page < this.totalPages;
	}
	get hasPrevPage() {
		return this.page > 1;
	}

	/**
	 * Format the styled result header for Telegram UI.
	 * Matches the "The Results For ☞" style from the screenshot.
	 *
	 * @param {string} [requesterName] - Display name of the user who searched
	 * @returns {string}
	 */
	toHeaderText(requesterName = null) {
		const sec = (this.durationMs / 1000).toFixed(2);
		const lines = [];

		lines.push(`<b>Tʜᴇ Rᴇsᴜʟᴛs Fᴏʀ</b> ☞ <b>${escapeHtml(this.query)}</b>`);
		lines.push(``);
		if (requesterName) {
			lines.push(`<b>Rᴇǫᴜᴇsᴛᴇᴅ Bʏ</b> ☞ <b>${escapeHtml(requesterName)}</b>`);
			lines.push(``);
		}
		lines.push(`<b>ʀᴇsᴜʟᴛ sʜᴏᴡ ɪɴ</b> ☞ <b>${sec} sᴇᴄᴏɴᴅs</b>`);
		lines.push(``);
		lines.push(`<b>ᴘᴏᴡᴇʀᴇᴅ ʙʏ</b> ☞ : <a href="https://t.me/karangade07">@karangade07</a>`);
		lines.push(``);
		lines.push(`⚠️ <b>ᴀꜰᴛᴇʀ 5 ᴍɪɴᴜᴛᴇs ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b>`);

		return lines.join('\n');
	}

	/**
	 * Factory — create from raw search data.
	 * @param {object} params
	 * @returns {SearchResponse}
	 */
	static from(params) {
		return new SearchResponse(params);
	}

	/**
	 * Empty result set.
	 * @param {string} query
	 * @returns {SearchResponse}
	 */
	static empty(query) {
		return new SearchResponse({ query, movies: [], total: 0, page: 1, perPage: 5, strategy: 'exact', durationMs: 0 });
	}

	toJSON() {
		return {
			query: this.query,
			total: this.total,
			page: this.page,
			totalPages: this.totalPages,
			strategy: this.strategy,
			durationMs: this.durationMs,
			movies: this.movies.map((m) => m.toJSON()),
		};
	}
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
