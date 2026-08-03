/**
 * @fileoverview InlineHandler — Handles @Bot movie inline search.
 *
 * @module handlers/inlineHandler
 */

import { buildInlineKeyboard } from '../telegram/keyboards.js';
import { TelegramInline } from '../telegram/inline.js';

export class InlineHandler {
  /**
   * @param {TelegramInline} telegramInline
   * @param {import('../services/searchService.js').SearchService} searchService
   * @param {string} botUsername
   */
  constructor(telegramInline, searchService, botUsername) {
    this.telegramInline = telegramInline;
    this.searchService = searchService;
    this.botUsername = botUsername;
  }

  async handleInlineQuery(inlineQuery) {
    const queryId = inlineQuery.id;
    const query = inlineQuery.query;

    if (!query || query.trim().length < 2) {
      await this.telegramInline.answer(queryId, []);
      return;
    }

    const searchRes = await this.searchService.search(query, { limit: 8 });

    const results = searchRes.movies.map(movie => {
      const keyboard = buildInlineKeyboard(movie.id, this.botUsername);
      return TelegramInline.buildArticle({
        id: String(movie.id),
        title: `${movie.title} (${movie.year || 'N/A'})`,
        description: `IMDb: ${movie.imdbRating || 'N/A'} | ${movie.genre || 'Movie'}`,
        text: `🎬 <b>${movie.title}</b> (${movie.year || 'N/A'})\n⭐ IMDb: ${movie.imdbRating || 'N/A'}/10\n\nClick below to get files in DM:`,
        replyMarkup: keyboard,
        thumbUrl: movie.posterUrl
      });
    });

    await this.telegramInline.answer(queryId, results);
  }
}
