/**
 * @fileoverview FuzzySearch — Levenshtein-based fallback search.
 * Stage 2 of the search pipeline. Runs AFTER ExactSearch returns nothing.
 * Loads candidate results from D1, then ranks by similarity score in JS.
 *
 * Performance note: This loads up to CANDIDATE_LIMIT rows from D1 and
 * filters in-memory. Acceptable for <100k movies; add FTS5 for larger sets.
 *
 * @module search/FuzzySearch
 */

import { similarity, normalizeTitle } from '../utils/stringUtils.js';
import { SEARCH }                     from '../config/constants.js';

const CANDIDATE_LIMIT = 200;  // Max rows to load for in-memory scoring

export class FuzzySearch {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   */
  constructor(movieRepo) {
    this.movieRepo = movieRepo;
  }

  /**
   * Fuzzy search using Levenshtein similarity scoring.
   * Returns movies above the similarity threshold, ranked by score.
   *
   * @param {string} query
   * @param {object} [opts]
   * @param {number} [opts.limit]
   * @param {number} [opts.offset]
   * @param {number} [opts.threshold]
   * @returns {Promise<{ movies: object[], total: number, strategy: string }>}
   */
  async search(query, opts = {}) {
    const {
      limit     = SEARCH.DEFAULT_LIMIT,
      offset    = 0,
      threshold = SEARCH.FUZZY_THRESHOLD,
    } = opts;

    const normalizedQuery = normalizeTitle(query);

    // Load a broad candidate set from D1
    const candidates = await this.movieRepo.getCandidates(CANDIDATE_LIMIT);

    // Score each candidate
    const scored = candidates
      .map(movie => ({
        movie,
        score: similarity(normalizedQuery, normalizeTitle(movie.title)),
      }))
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score);   // highest similarity first

    const total = scored.length;
    const page  = scored.slice(offset, offset + limit).map(s => s.movie);

    return { movies: page, total, strategy: 'fuzzy' };
  }
}
