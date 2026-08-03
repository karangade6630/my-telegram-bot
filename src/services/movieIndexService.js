/**
 * @fileoverview MovieIndexService — Channel indexing pipeline.
 * Extracts metadata from Telegram channel posts, upserts movies & files, and links them.
 *
 * @module services/movieIndexService
 */

import { MovieParser } from '../parsers/MovieParser.js';
import { Movie } from '../models/Movie.js';
import { File as FileModel } from '../models/File.js';
import { MovieIndexed } from '../events/MovieIndexed.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MovieIndexService');

export class MovieIndexService {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
   * @param {import('../repositories/ChannelRepository.js').ChannelRepository} channelRepo
   * @param {import('./omdbService.js').OmdbService} [omdbService]
   * @param {import('../interfaces/Queue.js').IQueue} [queue]
   */
  constructor(movieRepo, fileRepo, movieFileRepo, channelRepo, omdbService = null, queue = null) {
    this.movieRepo = movieRepo;
    this.fileRepo = fileRepo;
    this.movieFileRepo = movieFileRepo;
    this.channelRepo = channelRepo;
    this.omdbService = omdbService;
    this.queue = queue;
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

    let omdbMeta = null;
    if (this.omdbService) {
      omdbMeta = await this.omdbService.fetchMovieMetadata(parsed.movieTitle, parsed.year);
    }

    const movieModel = Movie.fromParsed({
      ...parsed,
      ...(omdbMeta || {}),
    });

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
