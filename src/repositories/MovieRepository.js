/**
 * @fileoverview MovieRepository — CRUD and search for the movies table.
 * Split from MovieFileRepository and GenreRepository per the architecture rules.
 *
 * @module repositories/MovieRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { Movie }          from '../models/Movie.js';
import { nowISO }         from '../utils/timeUtils.js';

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
    return { rows: rows.map(r => { const { _total, ...rest } = r; return rest; }), total };
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
    const pattern = `%${query}%`;
    const rows    = await this.all(sql, [pattern, pattern, limit, offset]);
    const total   = rows[0]?._total ?? 0;
    return { rows: rows.map(r => { const { _total, ...rest } = r; return rest; }), total };
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

    const conditions = tokens.map(() => 'LOWER(m.title) LIKE ?').join(' AND ');
    const bindings   = tokens.map(t => `%${t}%`);

    const sql = `
      SELECT m.*, COUNT(*) OVER() as _total
      FROM movies m
      WHERE ${conditions}
      ORDER BY m.popularity_score DESC
      LIMIT ? OFFSET ?
    `;
    const rows  = await this.all(sql, [...bindings, limit, offset]);
    const total = rows[0]?._total ?? 0;
    return { rows: rows.map(r => { const { _total, ...rest } = r; return rest; }), total };
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
      [limit]
    );
  }

  /**
   * Get trending movies (highest search_count recently).
   * @param {number} limit
   * @returns {Promise<Movie[]>}
   */
  async getTrending(limit = 10) {
    const rows = await this.all(
      `SELECT * FROM movies ORDER BY search_count DESC, popularity_score DESC LIMIT ?`,
      [limit]
    );
    return Movie.fromRows(rows);
  }

  /**
   * Get recently added movies.
   * @param {number} limit
   * @returns {Promise<Movie[]>}
   */
  async getRecent(limit = 10) {
    const rows = await this.all(
      `SELECT * FROM movies ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return Movie.fromRows(rows);
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
         updated_at     = excluded.updated_at`,
      [
        data.slug, data.title, data.original_title ?? null, data.year ?? null,
        data.type ?? 'movie', data.language ?? null, data.genre ?? null,
        data.description ?? null, data.director ?? null, data.cast ?? null,
        data.country ?? null, data.runtime ?? null, data.content_rating ?? null,
        data.poster_url ?? null, data.popularity_score ?? 0, data.search_count ?? 0,
        now, now,
      ]
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
      [nowISO(), movieId]
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
   * Update movie metadata (from OMDB enrichment).
   * @param {number} movieId
   * @param {object} data
   * @returns {Promise<void>}
   */
  async updateMetadata(movieId, data) {
    const { clause, values } = this.buildSetClause({
      ...data,
      updated_at: nowISO(),
    });
    await this.run(`UPDATE movies SET ${clause} WHERE id = ?`, [...values, movieId]);
  }
}
