/**
 * @fileoverview Ranking — post-search result ranking and scoring.
 * Applies weighted scores to raw search results before returning to user.
 *
 * Ranking factors (higher weight = more influence):
 *   - IMDb rating         (quality signal)
 *   - Popularity score    (D1 search_count)
 *   - Recency             (newer = better)
 *   - Exact title match   (bonus)
 *   - Search hit count    (trending)
 *
 * @module search/Ranking
 */

import { similarity, normalizeTitle } from '../utils/stringUtils.js';

const WEIGHTS = {
  IMDB_RATING:    0.30,
  POPULARITY:     0.25,
  RECENCY:        0.20,
  EXACT_MATCH:    0.15,
  SEARCH_COUNT:   0.10,
};

export class Ranking {
  /**
   * Sort a list of movie rows by composite relevance score.
   *
   * @param {object[]} movies    - Raw movie rows from D1
   * @param {string}   query     - Original search query
   * @returns {object[]}          Sorted movies (highest score first)
   */
  static rank(movies, query) {
    if (!movies || movies.length <= 1) return movies;

    const normalizedQuery = normalizeTitle(query);
    const now = Date.now();

    const scored = movies.map(movie => {
      const score = Ranking._score(movie, normalizedQuery, now);
      return { movie, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(s => s.movie);
  }

  /**
   * Compute a composite 0–1 score for a single movie.
   *
   * @param {object} movie
   * @param {string} normalizedQuery
   * @param {number} nowMs
   * @returns {number}
   */
  static _score(movie, normalizedQuery, nowMs) {
    let score = 0;

    // ── IMDb Rating ───────────────────────────────────────────
    if (movie.imdb_rating) {
      score += WEIGHTS.IMDB_RATING * (Number(movie.imdb_rating) / 10);
    }

    // ── Popularity Score ──────────────────────────────────────
    const pop = Number(movie.popularity_score ?? 0);
    // Normalize assuming max reasonable popularity is 10,000
    score += WEIGHTS.POPULARITY * Math.min(pop / 10_000, 1);

    // ── Recency ───────────────────────────────────────────────
    const updatedMs = movie.updated_at
      ? new Date(movie.updated_at).getTime()
      : 0;
    const ageMs = nowMs - updatedMs;
    const ageScore = Math.max(0, 1 - ageMs / (365 * 24 * 3_600_000)); // 1yr decay
    score += WEIGHTS.RECENCY * ageScore;

    // ── Exact Title Match Bonus ───────────────────────────────
    const titleSimilarity = similarity(
      normalizedQuery,
      normalizeTitle(movie.title ?? '')
    );
    score += WEIGHTS.EXACT_MATCH * titleSimilarity;

    // ── Search Count ──────────────────────────────────────────
    const searchCount = Number(movie.search_count ?? 0);
    score += WEIGHTS.SEARCH_COUNT * Math.min(searchCount / 1_000, 1);

    return score;
  }
}
