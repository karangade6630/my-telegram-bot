/**
 * @fileoverview SuggestionService — Provides auto-complete suggestions.
 *
 * @module services/suggestionService
 */

export class SuggestionService {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   */
  constructor(movieRepo) {
    this.movieRepo = movieRepo;
  }

  /**
   * Fetch quick title suggestions for auto-complete.
   *
   * @param {string} query
   * @param {number} [limit=5]
   * @returns {Promise<Array<{id: number, title: string, year: number}>>}
   */
  async getSuggestions(query, limit = 5) {
    if (!query || query.length < 2) return [];
    const result = await this.movieRepo.searchContains(query, { limit });
    return result.rows.map(m => ({
      id: m.id,
      title: m.title,
      year: m.year
    }));
  }
}
