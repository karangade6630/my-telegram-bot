/**
 * @fileoverview MessageHandler — Processes incoming text messages for movie searches.
 *
 * @module handlers/messageHandler
 */

import { BOT_COMMANDS, EMOJI } from '../config/constants.js';
import { normalizeMovieTitle } from '../utils/validation.js';
import { MovieHelper } from '../helpers/movieHelper.js';

export class MessageHandler {
  /**
   * @param {import('../services/searchService.js').SearchService} searchService
   * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
   * @param {import('../telegram/media.js').TelegramMedia} telegramMedia
   * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   * @param {import('../utils/logger.js').Logger} logger
   */
  constructor(searchService, telegramMessages, telegramMedia, movieFileRepo, fileRepo, logger) {
    this.searchService = searchService;
    this.telegramMessages = telegramMessages;
    this.telegramMedia = telegramMedia;
    this.movieFileRepo = movieFileRepo;
    this.fileRepo = fileRepo;
    this.logger = logger;
  }

  async handleMessage(update) {
    const chatId = update.message?.chat?.id;
    const text = update.message?.text ?? '';

    if (!chatId || !text) return null;

    const normalized = normalizeMovieTitle(text);
    if (!normalized) return null;

    // Execute search via SearchService
    const searchRes = await this.searchService.search(normalized);

    if (searchRes.isEmpty) {
      await this.telegramMessages.sendMessage(
        chatId,
        `🔍 No movie match found for <b>"${normalized}"</b>.\nTry a different spelling or search keyword.`
      );
      return null;
    }

    // Single result match — show movie card with quality buttons
    if (searchRes.movies.length === 1) {
      const movie = searchRes.movies[0];
      const files = await this.fileRepo.findByMovieId(movie.id);

      const { text: cardText, keyboard } = MovieHelper.formatMovieSearchResult(movie, files);

      if (movie.posterUrl) {
        await this.telegramMedia.sendPhoto(chatId, movie.posterUrl, cardText, { reply_markup: keyboard });
      } else {
        await this.telegramMessages.sendMessage(chatId, cardText, { reply_markup: keyboard });
      }
      return null;
    }

    // Multiple result matches — show search results selection keyboard
    const lines = [searchRes.toHeaderText(), ''];
    searchRes.movies.forEach((movie, idx) => {
      lines.push(`${idx + 1}. <b>${movie.title}</b> ${movie.year ? `(${movie.year})` : ''} ${movie.imdbRating ? `⭐ ${movie.imdbRating}` : ''}`);
    });
    lines.push('\n<i>Select a movie from the buttons below:</i>');

    const keyboard = {
      inline_keyboard: searchRes.movies.map(movie => ([
        {
          text: `🎬 ${movie.title} ${movie.year ? `(${movie.year})` : ''}`,
          callback_data: `mi:${movie.id}`
        }
      ]))
    };

    await this.telegramMessages.sendMessage(chatId, lines.join('\n'), { reply_markup: keyboard });
    return null;
  }
}
