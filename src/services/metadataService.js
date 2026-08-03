/**
 * @fileoverview MetadataService — Handles movie metadata enrichment via OMDB.
 *
 * @module services/metadataService
 */

import { OmdbService } from './omdbService.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MetadataService');

export class MetadataService {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {OmdbService} omdbService
   */
  constructor(movieRepo, omdbService) {
    this.movieRepo = movieRepo;
    this.omdbService = omdbService;
  }

  /**
   * Enrich a movie record with detailed metadata if missing.
   *
   * @param {number} movieId
   * @returns {Promise<boolean>}
   */
  async enrichMovie(movieId) {
    const movie = await this.movieRepo.findById(movieId);
    if (!movie || movie.imdbId) return false;

    const meta = await this.omdbService.fetchMovieMetadata(movie.title, movie.year);
    if (!meta) return false;

    await this.movieRepo.updateMetadata(movieId, {
      imdb_id: meta.imdbId,
      imdb_rating: meta.imdbRating,
      imdb_votes: meta.ratingCount,
      poster_url: meta.poster,
      director: meta.directors,
      cast: meta.cast,
      description: meta.description,
      genre: meta.genre,
      runtime: meta.duration,
      content_rating: meta.contentRating,
    });

    logger.info(`Enriched metadata for movie "${movie.title}"`, { movieId, imdbId: meta.imdbId });
    return true;
  }
}
