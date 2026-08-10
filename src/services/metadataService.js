/**
 * @fileoverview MetadataService — Handles movie metadata enrichment via OMDB.
 *
 * @module services/metadataService
 */

import { OmdbService } from './omdbService.js';
import { FilenameParser } from '../parsers/FilenameParser.js';
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

    // Clean the title to strip noise before querying OMDb
    const cleanTitle = FilenameParser.cleanMovieTitle(movie.title);
    const meta = await this.omdbService.fetchMovieMetadata(cleanTitle, movie.year);
    if (!meta) return false;

    const updateData = {};
    if (meta.imdbId)        updateData.imdb_id        = meta.imdbId;
    if (meta.imdbRating)    updateData.imdb_rating     = meta.imdbRating;
    if (meta.ratingCount)   updateData.imdb_votes      = meta.ratingCount;
    if (meta.description)   updateData.description     = meta.description;
    if (meta.genre)         updateData.genre           = meta.genre;
    if (meta.directors)     updateData.director        = meta.directors;
    if (meta.cast)          updateData.cast            = meta.cast;
    if (meta.duration)      updateData.runtime         = meta.duration;
    if (meta.contentRating) updateData.content_rating  = meta.contentRating;
    if (meta.imdbId)        updateData.poster_url      = `https://img.omdbapi.com/?apikey=${this.omdbService.apiKey}&i=${meta.imdbId}`;

    if (Object.keys(updateData).length > 0) {
      await this.movieRepo.updateMetadata(movieId, updateData);
      // Propagate shared poster URL, merged genres, and merged languages to same-name movies/series/seasons
      await this.movieRepo.propagateSharedMetadata(cleanTitle, updateData.poster_url, meta.genre, meta.language);
    }

    logger.info(`Enriched metadata for movie "${movie.title}" → "${cleanTitle}"`, { movieId, imdbId: meta.imdbId });
    return true;
  }
}

