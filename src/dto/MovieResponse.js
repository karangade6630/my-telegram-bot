/**
 * @fileoverview MovieResponse DTO.
 * Shapes the data returned from search/movie endpoints to handlers.
 * Decouples the DB schema from the Telegram message layer.
 *
 * @module dto/MovieResponse
 */

import { EMOJI } from '../config/constants.js';

export class MovieResponse {
	/**
	 * @param {import('../models/Movie.js').Movie} movie
	 * @param {import('../models/File.js').File[]} files
	 */
	constructor(movie, files = []) {
		this.id = movie.id;
		this.slug = movie.slug;
		this.title = movie.title;
		this.year = movie.year;
		this.type = movie.type;
		this.language = movie.language;
		this.genre = movie.genre;
		this.description = movie.description;
		this.director = movie.director;
		this.cast = movie.cast;
		this.runtime = movie.runtime;
		this.contentRating = movie.contentRating;
		this.imdbId = movie.imdbId;
		this.imdbRating = movie.imdbRating;
		this.imdbVotes = movie.imdbVotes;
		this.imdbUrl = movie.imdbUrl;
		this.posterUrl = movie.posterUrl;
		this.trailerUrl = movie.trailerUrl;
		this.files = files;
	}

	/**
	 * Format the main movie info message as Telegram HTML.
	 * @returns {string}
	 */
	toTelegramHTML() {
		const lines = [];

		lines.push(`${EMOJI.MOVIE} <b>${escapeHtml(this.title)}</b>${this.year ? ` (${this.year})` : ''}`);

		if (this.imdbRating)
			lines.push(`${EMOJI.STAR} <b>IMDb:</b> ${this.imdbRating}/10${this.imdbVotes ? ` (${this.imdbVotes} votes)` : ''}`);
		if (this.language) lines.push(`${EMOJI.LANGUAGE} <b>Language:</b> ${escapeHtml(this.language)}`);
		if (this.genre) lines.push(`${EMOJI.GENRE} <b>Genre:</b> ${escapeHtml(this.genre)}`);
		if (this.runtime) lines.push(`${EMOJI.RUNTIME} <b>Runtime:</b> ${escapeHtml(this.runtime)}`);
		if (this.director) lines.push(`${EMOJI.DIRECTOR} <b>Director:</b> ${escapeHtml(this.director)}`);
		if (this.cast) lines.push(`${EMOJI.CAST} <b>Cast:</b> ${escapeHtml(this.cast)}`);
		if (this.contentRating) lines.push(`${EMOJI.INFO} <b>Rated:</b> ${escapeHtml(this.contentRating)}`);
		if (this.country) lines.push(`${EMOJI.COUNTRY} <b>Country:</b> ${escapeHtml(this.country)}`);

		if (this.files.length) {
			const qualities = [...new Set(this.files.map((f) => f.quality).filter(Boolean))];
			if (qualities.length) {
				lines.push(`\n${EMOJI.QUALITY} <b>Available:</b> ${qualities.join(' | ')}`);
			}
		}

		if (this.description) {
			lines.push(`\n📝 ${escapeHtml(this.description.slice(0, 300))}${this.description.length > 300 ? '…' : ''}`);
		}

		return lines.join('\n');
	}

	/**
	 * Build from Movie model + File models.
	 * @param {import('../models/Movie.js').Movie} movie
	 * @param {import('../models/File.js').File[]} files
	 * @returns {MovieResponse}
	 */
	static from(movie, files) {
		return new MovieResponse(movie, files);
	}

	toJSON() {
		return {
			id: this.id,
			title: this.title,
			year: this.year,
			imdbRating: this.imdbRating,
			imdbUrl: this.imdbUrl,
			posterUrl: this.posterUrl,
			files: this.files,
		};
	}
}

/** Escape HTML special chars for safe Telegram HTML messages. */
function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
