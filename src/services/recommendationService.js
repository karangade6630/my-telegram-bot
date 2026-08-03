/**
 * @fileoverview RecommendationService — Recommends movies based on genres/rating.
 *
 * @module services/recommendationService
 */

import { Movie } from '../models/Movie.js';

export class RecommendationService {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   */
  constructor(movieRepo) {
    this.movieRepo = movieRepo;
  }

  /**
   * Get related recommendations for a movie.
   *
   * @param {number} movieId
   * @param {number} [limit=5]
   * @returns {Promise<Movie[]>}
   */
  async getRecommendations(movieId, limit = 5) {
    const movie = await this.movieRepo.findById(movieId);
    if (!movie) return [];

    let rows = [];
    if (movie.genre) {
      const primaryGenre = movie.genre.split(',')[0].trim();
      const res = await this.movieRepo.searchContains(primaryGenre, { limit: limit + 1 });
      rows = res.rows.filter(r => r.id !== movieId).slice(0, limit);
    }

    if (rows.length === 0) {
      rows = (await this.movieRepo.getTrending(limit)).map(m => m.toRow ? m.toRow() : m);
    }

    return Movie.fromRows(rows);
  }
}
