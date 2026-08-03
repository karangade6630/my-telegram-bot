/**
 * @fileoverview ExactSearch — fast SQL-based exact and prefix matching.
 * Stage 1 of the multi-strategy search pipeline.
 * Uses prepared statements for SQL injection safety.
 *
 * @module search/ExactSearch
 */

import { Tokenizer } from './Tokenizer.js';

export class ExactSearch {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   */
  constructor(movieRepo) {
    this.movieRepo = movieRepo;
  }

  /**
   * Run an exact (full title) search.
   * Highest confidence — title matches exactly (case-insensitive).
   *
   * @param {string} query
   * @param {SearchOptions} [opts]
   * @returns {Promise<{ movies: object[], total: number, strategy: string }>}
   */
  async searchExact(query, opts = {}) {
    const { limit = 10, offset = 0, filters = {} } = opts;
    const q = query.trim().toLowerCase();

    const result = await this.movieRepo.searchExact(q, { limit, offset, filters });
    return { movies: result.rows, total: result.total, strategy: 'exact' };
  }

  /**
   * Alias for searchExact.
   */
  async search(query, opts = {}) {
    return this.searchExact(query, opts);
  }

  /**
   * Run a LIKE contains search (query anywhere in title).
   *
   * @param {string} query
   * @param {SearchOptions} [opts]
   * @returns {Promise<{ movies: object[], total: number, strategy: string }>}
   */
  async searchContains(query, opts = {}) {
    const { limit = 10, offset = 0, filters = {} } = opts;
    const q = query.trim().toLowerCase();

    const result = await this.movieRepo.searchContains(q, { limit, offset, filters });
    return { movies: result.rows, total: result.total, strategy: 'contains' };
  }

  /**
   * Run a tokenized multi-term search.
   * Each token must appear in the title.
   *
   * @param {string} query
   * @param {SearchOptions} [opts]
   * @returns {Promise<{ movies: object[], total: number, strategy: string }>}
   */
  async searchTokenized(query, opts = {}) {
    const { limit = 10, offset = 0, filters = {} } = opts;
    const tokens = Tokenizer.tokenize(query);
    if (!tokens.length) return { movies: [], total: 0, strategy: 'tokenized' };

    const result = await this.movieRepo.searchByTokens(tokens, { limit, offset, filters });
    return { movies: result.rows, total: result.total, strategy: 'tokenized' };
  }
}

/**
 * @typedef {object} SearchOptions
 * @property {number} [limit]
 * @property {number} [offset]
 * @property {object} [filters]
 */
