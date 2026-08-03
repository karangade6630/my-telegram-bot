/**
 * @fileoverview GenreRepository — CRUD for genres + movie_genres join.
 *
 * @module repositories/GenreRepository
 */

import { BaseRepository } from './base/BaseRepository.js';

export class GenreRepository extends BaseRepository {

  /**
   * Find or create a genre by name.
   * @param {string} name
   * @returns {Promise<number>} genre id
   */
  async findOrCreate(name) {
    const normalized = name.trim();
    let row = await this.first('SELECT id FROM genres WHERE name = ?', [normalized]);
    if (row) return row.id;

    const result = await this.run('INSERT INTO genres (name) VALUES (?)', [normalized]);
    return result.meta.last_row_id;
  }

  /**
   * Get all genres.
   * @returns {Promise<object[]>}
   */
  async findAll() {
    return this.all('SELECT * FROM genres ORDER BY name ASC');
  }

  /**
   * Link a genre to a movie.
   * @param {number} movieId
   * @param {number} genreId
   * @returns {Promise<void>}
   */
  async linkToMovie(movieId, genreId) {
    await this.run(
      'INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)',
      [movieId, genreId]
    );
  }

  /**
   * Sync genres for a movie from a comma-separated genre string.
   * e.g. "Action, Sci-Fi" → inserts into genres + movie_genres.
   *
   * @param {number} movieId
   * @param {string} genreString  - e.g. "Action, Sci-Fi, Thriller"
   * @returns {Promise<void>}
   */
  async syncForMovie(movieId, genreString) {
    if (!genreString) return;
    const names = genreString.split(',').map(g => g.trim()).filter(Boolean);

    for (const name of names) {
      const genreId = await this.findOrCreate(name);
      await this.linkToMovie(movieId, genreId);
    }
  }

  /**
   * Get all genres for a movie.
   * @param {number} movieId
   * @returns {Promise<string[]>} genre names
   */
  async getForMovie(movieId) {
    const rows = await this.all(
      `SELECT g.name FROM genres g
       INNER JOIN movie_genres mg ON mg.genre_id = g.id
       WHERE mg.movie_id = ?
       ORDER BY g.name ASC`,
      [movieId]
    );
    return rows.map(r => r.name);
  }
}
