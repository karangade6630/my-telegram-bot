/**
 * @fileoverview MovieIndexService — Channel indexing pipeline.
 * Extracts metadata from Telegram channel posts, upserts movies & files, and links them.
 * Now uses FilenameParser.cleanMovieTitle for accurate poster/OMDb lookups and
 * enriches movies with full OMDb metadata (description, genre, cast, director, rating, etc.).
 *
 * @module services/movieIndexService
 */

import { MovieParser } from '../parsers/MovieParser.js';
import { FilenameParser } from '../parsers/FilenameParser.js';
import { Movie } from '../models/Movie.js';
import { File as FileModel } from '../models/File.js';
import { MovieIndexed } from '../events/MovieIndexed.js';
import { Logger } from '../utils/logger.js';
import { POSTER_API_URL } from '../config/constants.js';

const logger = new Logger('MovieIndexService');

export class MovieIndexService {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
   * @param {import('../repositories/ChannelRepository.js').ChannelRepository} channelRepo
   * @param {import('../interfaces/Queue.js').IQueue} [queue]
   * @param {import('./omdbService.js').OmdbService} [omdbService]
   */
  constructor(movieRepo, fileRepo, movieFileRepo, channelRepo, queue = null, omdbService = null) {
    this.movieRepo = movieRepo;
    this.fileRepo = fileRepo;
    this.movieFileRepo = movieFileRepo;
    this.channelRepo = channelRepo;
    this.queue = queue;
    this.omdbService = omdbService;
  }

  /**
   * Fetch poster URL using cleaned title variants.
   * @param {string} cleanedTitle - Already cleaned movie title
   * @param {string} rawFileName - Raw filename for fallback queries
   * @returns {Promise<string|null>}
   */
  async _fetchPoster(cleanedTitle, rawFileName) {
    const rawCleaned = FilenameParser.cleanMovieTitle(rawFileName);
    const searchQueries = [
      cleanedTitle,
      rawCleaned,
      cleanedTitle.replace(/\b[Ss]\d{1,2}[Ee]\d{1,3}\b.*/gi, '').trim(),
      cleanedTitle.replace(/[\d\s]+$/g, '').trim(),
    ];

    for (const query of [...new Set(searchQueries)].filter(q => q && q.length > 2)) {
      const url = `${POSTER_API_URL}?search=${encodeURIComponent(query)}`;
      logger.info(`Fetching poster (query: "${query}"): ${url}`);
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && data.movies && data.movies.length > 0) {
          return data.movies[0].poster_url;
        }
      } catch (error) {
        logger.warn(`Failed to fetch poster for "${query}":`, error);
      }
    }
    return null;
  }

  /**
   * Enrich a movie record with OMDb metadata if available.
   * Uses cleanMovieTitle to strip noise before querying OMDb.
   *
   * @param {number} movieId
   * @param {string} rawTitle - The raw/cleaned title from the parser
   * @param {number|null} year
   * @returns {Promise<void>}
   */
  async _enrichWithOmdb(movieId, rawTitle, year) {
    if (!this.omdbService) return;

    try {
      const cleanTitle = FilenameParser.cleanMovieTitle(rawTitle);
      logger.info(`Enriching movie #${movieId} via OMDb with cleaned title: "${cleanTitle}"`);

      const meta = await this.omdbService.fetchMovieMetadata(cleanTitle, year);
      if (!meta) {
        logger.info(`No OMDb metadata found for "${cleanTitle}"`);
        return;
      }

      // Build update payload — only set fields that OMDb returned
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
      if (meta.type)          updateData.type            = meta.type;
      // Use OMDb poster if poster_url is missing
      if (meta.imdbId)        updateData.poster_url      = `https://img.omdbapi.com/?apikey=${this.omdbService.apiKey}&i=${meta.imdbId}`;

      if (Object.keys(updateData).length > 0) {
        await this.movieRepo.updateMetadata(movieId, updateData);
        logger.info(`Enriched movie #${movieId}: ${meta.title} (${meta.year}) [${meta.imdbId}]`);
      }
    } catch (err) {
      logger.warn(`OMDb enrichment failed for movie #${movieId}:`, err.message || err);
    }
  }

  /**
   * Process incoming Telegram channel post update.
   *
   * @param {object} message - Telegram channel_post message
   * @returns {Promise<object|null>}
   */
  async indexChannelPost(message) {
    const parsed = MovieParser.fromChannelPost(message);
    if (!parsed) return null;

    logger.info(`Indexing file from channel post: "${parsed.movieTitle}" (${parsed.quality || 'Unknown'})`);

    const existingFile = await this.fileRepo.findByUniqueId(parsed.uniqueId);
    if (existingFile) {
      logger.info('File already indexed, skipping', { uniqueId: parsed.uniqueId });
      return { status: 'skipped', fileId: existingFile.id };
    }

    const movieModel = Movie.fromParsed(parsed);

    // Use cleaned title for poster search
    const posterUrl = await this._fetchPoster(parsed.movieTitle, parsed.fileName);
    if (posterUrl) movieModel.posterUrl = posterUrl;

    const movieId = await this.movieRepo.upsert(movieModel.toRow());

    const fileModel = FileModel.fromParsedAndTelegram(
      parsed,
      {
        file_id: parsed.telegramFileId,
        file_unique_id: parsed.uniqueId,
        file_name: parsed.fileName,
        file_size: parsed.sizeBytes,
        mime_type: parsed.mimeType
      },
      parsed.channelId,
      parsed.messageId
    );

    const fileId = await this.fileRepo.insert(fileModel.toRow());
    if (fileId && movieId) {
      await this.movieFileRepo.link(movieId, fileId);

      if (parsed.messageId && parsed.channelId) {
        await this.channelRepo.updateLastIndexedMsg(parsed.channelId, parsed.messageId);
      }

      // Enrich with OMDb metadata (non-blocking — failures don't break indexing)
      await this._enrichWithOmdb(movieId, parsed.movieTitle, parsed.year);

      const event = new MovieIndexed({
        telegramFileId: parsed.telegramFileId,
        movieTitle: parsed.movieTitle,
        movieId,
        fileId,
        quality: parsed.quality || 'Unknown',
        channelId: parsed.channelId,
        messageId: parsed.messageId,
      });

      if (this.queue) {
        await this.queue.send({ type: 'analytics', payload: event.toJSON() });
      }

      return { status: 'indexed', movieId, fileId };
    }

    return null;
  }
}
