/**
 * @fileoverview LanguageRepository — CRUD for the languages table.
 *
 * @module repositories/LanguageRepository
 */

import { BaseRepository } from './base/BaseRepository.js';

export class LanguageRepository extends BaseRepository {

  /**
   * Find or create a language by name.
   * @param {string} name
   * @returns {Promise<number>} language id
   */
  async findOrCreate(name) {
    const normalized = name.trim();
    let row = await this.first('SELECT id FROM languages WHERE name = ?', [normalized]);
    if (row) return row.id;

    const result = await this.run(
      'INSERT INTO languages (name) VALUES (?)',
      [normalized]
    );
    return result.meta.last_row_id;
  }

  /**
   * Get all languages.
   * @returns {Promise<object[]>}
   */
  async findAll() {
    return this.all('SELECT * FROM languages ORDER BY name ASC');
  }

  /**
   * Get all distinct languages used across all movies.
   * @returns {Promise<string[]>}
   */
  async getDistinctMovieLanguages() {
    const rows = await this.all(
      'SELECT DISTINCT language FROM movies WHERE language IS NOT NULL ORDER BY language ASC'
    );
    return rows.map(r => r.language);
  }
}
