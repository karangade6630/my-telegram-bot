/**
 * @fileoverview MovieIndexed domain event.
 * Emitted whenever a new file is successfully parsed and saved to D1
 * from an incoming channel_post. Consumed by AnalyticsService.
 *
 * @module events/MovieIndexed
 */

export class MovieIndexed {
  /** @type {string} */
  static NAME = 'movie.indexed';

  /**
   * @param {object} payload
   * @param {string} payload.telegramFileId  - Stored Telegram file_id
   * @param {string} payload.movieTitle      - Parsed movie title
   * @param {number} payload.movieId         - D1 movies.id
   * @param {number} payload.fileId          - D1 files.id
   * @param {string} payload.quality         - e.g. '720p'
   * @param {string} payload.channelId       - Source channel Telegram ID
   * @param {number} payload.messageId       - Source message ID in channel
   * @param {Date}   [payload.indexedAt]
   */
  constructor({
    telegramFileId,
    movieTitle,
    movieId,
    fileId,
    quality,
    channelId,
    messageId,
    indexedAt = new Date(),
  }) {
    this.name          = MovieIndexed.NAME;
    this.telegramFileId = telegramFileId;
    this.movieTitle    = movieTitle;
    this.movieId       = movieId;
    this.fileId        = fileId;
    this.quality       = quality;
    this.channelId     = channelId;
    this.messageId     = messageId;
    this.indexedAt     = indexedAt;
  }

  /** Serialize to plain object for queue/analytics. */
  toJSON() {
    return {
      name:           this.name,
      telegramFileId: this.telegramFileId,
      movieTitle:     this.movieTitle,
      movieId:        this.movieId,
      fileId:         this.fileId,
      quality:        this.quality,
      channelId:      this.channelId,
      messageId:      this.messageId,
      indexedAt:      this.indexedAt.toISOString(),
    };
  }
}
