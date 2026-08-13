/**
 * @fileoverview MovieRepository — CRUD and search for the movies table.
 * Split from MovieFileRepository and GenreRepository per the architecture rules.
 *
 * @module repositories/MovieRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { Movie } from '../models/Movie.js';
import { nowISO } from '../utils/timeUtils.js';
import { mergeCommaValues, normalizeTitle, slugify } from '../utils/stringUtils.js';

const LIKE_PATTERN_MAX_LENGTH = 120;
const LIKE_TOKEN_LIMIT = 3;

function buildSafeLikePattern(value) {
	const normalized = normalizeTitle(value || '');
	if (!normalized) return '%';

	const tokens = normalized.split(/\s+/).filter(Boolean);
	if (!tokens.length) return '%';

	const candidate = tokens.slice(0, LIKE_TOKEN_LIMIT).join('%');
	const maxInner = LIKE_PATTERN_MAX_LENGTH - 2; // account for surrounding %
	const inner = candidate.length <= maxInner ? candidate : candidate.slice(0, maxInner);
	return `%${inner}%`;
}

export class MovieRepository extends BaseRepository {
	// ─────────────────────────────────────────────────────────
	// READ
	// ─────────────────────────────────────────────────────────

	/**
	 * Find a movie by D1 primary key.
	 * @param {number} id
	 * @returns {Promise<Movie|null>}
	 */
	async findById(id) {
		const row = await this.first('SELECT * FROM movies WHERE id = ?', [id]);
		return row ? Movie.fromRow(row) : null;
	}

	/**
	 * Find a movie by its URL slug.
	 * @param {string} slug
	 * @returns {Promise<Movie|null>}
	 */
	async findBySlug(slug) {
		const row = await this.first('SELECT * FROM movies WHERE slug = ?', [slug]);
		return row ? Movie.fromRow(row) : null;
	}

	// ─────────────────────────────────────────────────────────
	// SEARCH METHODS
	// ─────────────────────────────────────────────────────────

	/**
	 * Exact case-insensitive title match.
	 *
	 * @param {string} query
	 * @param {object} [opts]
	 * @returns {Promise<{ rows: object[], total: number }>}
	 */
	async searchExact(query, opts = {}) {
		const { limit = 10, offset = 0 } = opts;
		const sql = `
      SELECT m.*, COUNT(*) OVER() as _total
      FROM movies m
      WHERE LOWER(m.title) = LOWER(?)
      ORDER BY m.popularity_score DESC
      LIMIT ? OFFSET ?
    `;
		const rows = await this.all(sql, [query, limit, offset]);
		const total = rows[0]?._total ?? 0;
		return {
			rows: rows.map((r) => {
				const { _total, ...rest } = r;
				return rest;
			}),
			total,
		};
	}

	/**
	 * LIKE contains search — title includes the query string.
	 *
	 * @param {string} query
	 * @param {object} [opts]
	 * @returns {Promise<{ rows: object[], total: number }>}
	 */
	async searchContains(query, opts = {}) {
		const { limit = 10, offset = 0 } = opts;
		const sql = `
      SELECT m.*, COUNT(*) OVER() as _total
      FROM movies m
      WHERE LOWER(m.title) LIKE LOWER(?)
         OR LOWER(m.original_title) LIKE LOWER(?)
      ORDER BY m.popularity_score DESC, m.updated_at DESC
      LIMIT ? OFFSET ?
    `;
		const pattern = buildSafeLikePattern(query);
		const rows = await this.all(sql, [pattern, pattern, limit, offset]);
		const total = rows[0]?._total ?? 0;
		return {
			rows: rows.map((r) => {
				const { _total, ...rest } = r;
				return rest;
			}),
			total,
		};
	}

	/**
	 * Multi-token AND search — all tokens must be present in title.
	 *
	 * @param {string[]} tokens
	 * @param {object}   [opts]
	 * @returns {Promise<{ rows: object[], total: number }>}
	 */
	async searchByTokens(tokens, opts = {}) {
		const { limit = 10, offset = 0 } = opts;
		if (!tokens.length) return { rows: [], total: 0 };

		const safeTokens = tokens.slice(0, 5);
		const conditions = safeTokens.map(() => 'LOWER(m.title) LIKE ?').join(' AND ');
		const bindings = safeTokens.map((t) => `%${t}%`);

		const sql = `
      SELECT m.*, COUNT(*) OVER() as _total
      FROM movies m
      WHERE ${conditions}
      ORDER BY m.popularity_score DESC
      LIMIT ? OFFSET ?
    `;
		const rows = await this.all(sql, [...bindings, limit, offset]);
		const total = rows[0]?._total ?? 0;
		return {
			rows: rows.map((r) => {
				const { _total, ...rest } = r;
				return rest;
			}),
			total,
		};
	}

	/**
	 * Load candidates for fuzzy/regex in-memory filtering.
	 * Returns lightweight rows (id, title, original_title, popularity_score, etc.)
	 *
	 * @param {number} limit
	 * @returns {Promise<object[]>}
	 */
	async getCandidates(limit = 200) {
		return this.all(
			`SELECT id, slug, title, original_title, year, type, language,
              imdb_rating, poster_url, popularity_score, search_count, updated_at
       FROM movies
       ORDER BY popularity_score DESC, updated_at DESC
       LIMIT ?`,
			[limit],
		);
	}

	/**
	 * Get trending movies (highest search_count recently).
	 * @param {number} limit
	 * @returns {Promise<Movie[]>}
	 */
	async getTrending(limit = 10) {
		const rows = await this.all(`SELECT * FROM movies ORDER BY search_count DESC, popularity_score DESC LIMIT ?`, [limit]);
		return Movie.fromRows(rows);
	}

	/**
	 * Get recently added movies.
	 * @param {number} limit
	 * @returns {Promise<Movie[]>}
	 */
	async getRecent(limit = 10) {
		const rows = await this.all(`SELECT * FROM movies ORDER BY created_at DESC LIMIT ?`, [limit]);
		return Movie.fromRows(rows);
	}

	/**
	 * List movies with pagination, search, and genre filtering for Admin dashboard.
	 * @param {object} [opts]
	 * @returns {Promise<{ movies: Movie[], total: number }>}
	 */
	async listPaginated(opts = {}) {
		const { limit = 10, offset = 0, search = '', genre = '' } = opts;
		const whereClauses = [];
		const params = [];

		if (search) {
			whereClauses.push('(LOWER(title) LIKE ? OR LOWER(original_title) LIKE ? OR LOWER(slug) LIKE ?)');
			const p = buildSafeLikePattern(search);
			params.push(p, p, p);
		}

		if (genre) {
			whereClauses.push('LOWER(genre) LIKE ?');
			params.push(`%${genre.toLowerCase()}%`);
		}

		const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
		const sql = `
      SELECT m.*, COUNT(*) OVER() as _total
      FROM movies m
      ${where}
      ORDER BY m.id DESC
      LIMIT ? OFFSET ?
    `;

		const rows = await this.all(sql, [...params, limit, offset]);
		const total = rows[0]?._total ?? 0;
		return {
			movies: Movie.fromRows(
				rows.map((r) => {
					const { _total, ...rest } = r;
					return rest;
				}),
			),
			total,
		};
	}

	/**
	 * Count total movies.
	 * @returns {Promise<number>}
	 */
	async countAll() {
		return this.count('movies');
	}

	// ─────────────────────────────────────────────────────────
	// WRITE
	// ─────────────────────────────────────────────────────────

	/**
	 * Insert a new movie or update if slug already exists.
	 * Returns the movie's D1 id.
	 *
	 * @param {object} data  - Plain row object (from Movie.toRow())
	 * @returns {Promise<number>} movie id
	 */
	async upsert(data) {
		const now = nowISO();
		await this.run(
			`INSERT INTO movies (slug, title, original_title, year, type, language, genre, description,
         director, cast, country, runtime, content_rating,
         poster_url, popularity_score, search_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         title          = COALESCE(excluded.title, movies.title),
         poster_url     = COALESCE(excluded.poster_url, movies.poster_url),
         language       = COALESCE(excluded.language, movies.language),
         genre          = COALESCE(excluded.genre, movies.genre),
         description    = COALESCE(excluded.description, movies.description),
         director       = COALESCE(excluded.director, movies.director),
         cast           = COALESCE(excluded.cast, movies.cast),
         runtime        = COALESCE(excluded.runtime, movies.runtime),
         content_rating = COALESCE(excluded.content_rating, movies.content_rating),
         updated_at     = excluded.updated_at`,
			[
				data.slug,
				data.title,
				data.original_title ?? null,
				data.year ?? null,
				data.type ?? 'movie',
				data.language ?? null,
				data.genre ?? null,
				data.description ?? null,
				data.director ?? null,
				data.cast ?? null,
				data.country ?? null,
				data.runtime ?? null,
				data.content_rating ?? null,
				data.poster_url ?? null,
				data.popularity_score ?? 0,
				data.search_count ?? 0,
				now,
				now,
			],
		);
		const existing = await this.findBySlug(data.slug);
		return existing?.id;
	}

	/**
	 * Increment search count and popularity score for a movie.
	 * Called every time a user gets results for this movie.
	 *
	 * @param {number} movieId
	 * @returns {Promise<void>}
	 */
	async incrementPopularity(movieId) {
		await this.run(
			`UPDATE movies SET
         search_count     = search_count + 1,
         popularity_score = popularity_score + 1,
         updated_at       = ?
       WHERE id = ?`,
			[nowISO(), movieId],
		);
	}

	/**
	 * Delete a movie and all associated files (cascade).
	 * @param {number} movieId
	 * @returns {Promise<void>}
	 */
	async delete(movieId) {
		await this.run('DELETE FROM movies WHERE id = ?', [movieId]);
	}

	/**
	 * Update movie metadata (from OMDB / IMDb enrichment or Admin edit).
	 * Automatically strips imdb_id from update if another movie record already has it to prevent UNIQUE constraint errors.
	 * @param {number} movieId
	 * @param {object} data
	 * @returns {Promise<void>}
	 */
	async updateMetadata(movieId, data) {
		if (!data || Object.keys(data).length === 0) return;

		// Delegate to updateAndPropagate for consistent transactional behavior
		await this.updateAndPropagate(movieId, data, { simulate: false });
	}

	/**
	 * Update a movie and propagate selected fields to matching movies atomically.
	 * Returns an object with affectedIds array.
	 * @param {number} movieId
	 * @param {object} data
	 * @param {object} [options]
	 * @returns {Promise<{ affectedIds: number[] }>}
	 */
	async updateAndPropagate(movieId, data, options = {}) {
		const simulate = Boolean(options.simulate);
		if (!data || Object.keys(data).length === 0) return { affectedIds: [] };

		const propagateFields =
			options.propagateFields === null
				? []
				: options.propagateFields || [
						'poster_url',
						'trailer_url',
						'description',
						'imdb_rating',
						'imdb_votes',
						'director',
						'cast',
						'year',
						'type',
						'genre',
						'language',
						// Do NOT propagate imdb_id to other rows — unique constraint prevents the same imdb_id being assigned to multiple records.
						// 'imdb_id',
						'slug',
						'title',
					];

		// Load target row
		const target = await this.findById(movieId);
		if (!target) throw new Error('Movie not found');

		let copyData = { ...data };

		// Normalize camelCase -> snake_case for incoming imdbId to be safe if callers use camelCase
		if (copyData.imdbId !== undefined) {
			copyData.imdb_id = copyData.imdbId;
			delete copyData.imdbId;
		}

		// Note: duplicate imdb_id values are allowed in this deployment (migration removes UNIQUE constraint).
		// For backward-compatibility, normalize camelCase already done above; no further stripping is required.

		const statements = [];
		const previewChanges = [];

		// Prepare update for the target row
		const { clause: targetClause, values: targetValues } = this.buildSetClause({ ...copyData, updated_at: nowISO() });
		if (targetClause) {
			if (simulate) {
				// preview: compute target change
				const previewUpdate = { ...copyData, updated_at: nowISO() };
				// if (imdbIdStripped) previewUpdate._note = 'imdb_id stripped due to existing record';
				previewChanges.push({ id: movieId, updates: previewUpdate });
			} else {
				statements.push({ sql: `UPDATE movies SET ${targetClause} WHERE id = ?`, bindings: [...targetValues, movieId] });
			}
		}

		// Build matching query — look for imdb_id match OR slug/title similarity
		const matchClauses = ['id != ?'];
		const matchBindings = [movieId];

		const titleForMatch = copyData.title || target.title || '';
		const slugForMatch = copyData.slug || slugify(titleForMatch || '');

		// Build a safe LIKE pattern — D1/SQLite can error on overly complex patterns.
		const safeLikePattern = buildSafeLikePattern(titleForMatch || target.title || '');

		if (copyData.imdb_id) {
			matchClauses.push('imdb_id = ?');
			matchBindings.push(copyData.imdb_id);
		}

		matchClauses.push('(LOWER(slug) = LOWER(?) OR LOWER(title) LIKE ?)');
		matchBindings.push(slugForMatch, safeLikePattern);

		const matchSql = `SELECT * FROM movies WHERE ${matchClauses.join(' AND ')}`;
		const matches = await this.all(matchSql, matchBindings);

		for (const row of matches) {
			const updateData = {};
			for (const f of propagateFields) {
				if (f === 'genre') {
					if (copyData.genre) {
						const merged = mergeCommaValues(row.genre, copyData.genre);
						if (merged && merged !== row.genre) updateData.genre = merged;
					}
				} else if (f === 'language') {
					if (copyData.language) {
						const merged = mergeCommaValues(row.language, copyData.language);
						if (merged && merged !== row.language) updateData.language = merged;
					}
				} else if (copyData[f] !== undefined && copyData[f] !== null && copyData[f] !== row[f]) {
					updateData[f] = copyData[f];
				}
			}

			if (Object.keys(updateData).length > 0) {
				updateData.updated_at = nowISO();
				if (simulate) {
					previewChanges.push({ id: row.id, updates: updateData });
				} else {
					const { clause, values } = this.buildSetClause(updateData);
					statements.push({ sql: `UPDATE movies SET ${clause} WHERE id = ?`, bindings: [...values, row.id] });
				}
			}
		}

		if (!simulate && statements.length > 0) {
			await this.batch(statements);
		}

		const affectedIds = [movieId, ...matches.map((m) => m.id)];
		return { affectedIds, preview: simulate ? previewChanges : undefined };
	}

	/**
	 * Propagate poster URL, trailer URL, description, ratings, cast, director, merged genres, and merged languages
	 * to all movies/series sharing the same base title.
	 * Ensures same-name movies, seasons, and web-series share verified metadata.
	 *
	 * @param {string} baseTitle - Movie or Series title
	 * @param {object|string|null} sharedData - Shared metadata object or poster URL string
	 * @param {string|null} [genre]
	 * @param {string|null} [language]
	 * @returns {Promise<void>}
	 */
	async propagateSharedMetadata(baseTitle, sharedData = {}, genre = null, language = null) {
		if (!baseTitle) return;

		const data = typeof sharedData === 'object' && sharedData !== null ? sharedData : { poster_url: sharedData, genre, language };

		const pattern = buildSafeLikePattern(baseTitle);
		const rows = await this.all(`SELECT * FROM movies WHERE LOWER(title) LIKE ? OR LOWER(slug) LIKE ?`, [pattern, pattern]);

		for (const row of rows) {
			const mergedGenre = mergeCommaValues(row.genre, data.genre);
			const mergedLang = mergeCommaValues(row.language, data.language);

			const updateData = {};
			if (mergedGenre && mergedGenre !== row.genre) updateData.genre = mergedGenre;
			if (mergedLang && mergedLang !== row.language) updateData.language = mergedLang;

			if (data.poster_url && data.poster_url !== row.poster_url) updateData.poster_url = data.poster_url;
			if (data.trailer_url && data.trailer_url !== row.trailer_url) updateData.trailer_url = data.trailer_url;
			if (data.description && data.description !== row.description) updateData.description = data.description;
			if (data.imdb_rating && data.imdb_rating !== row.imdb_rating) updateData.imdb_rating = data.imdb_rating;
			if (data.imdb_votes && data.imdb_votes !== row.imdb_votes) updateData.imdb_votes = data.imdb_votes;
			if (data.director && data.director !== row.director) updateData.director = data.director;
			if (data.cast && data.cast !== row.cast) updateData.cast = data.cast;
			if (data.year && data.year !== row.year) updateData.year = data.year;
			if (data.type && data.type !== row.type) updateData.type = data.type;
			if (data.content_rating && data.content_rating !== row.content_rating) updateData.content_rating = data.content_rating;

			if (Object.keys(updateData).length > 0) {
				await this.updateMetadata(row.id, updateData);
			}
		}
	}
}
