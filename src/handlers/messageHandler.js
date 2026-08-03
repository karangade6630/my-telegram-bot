/**
 * @fileoverview MessageHandler — Processes incoming text messages for movie searches.
 *
 * @module handlers/messageHandler
 */

import { BOT_COMMANDS, EMOJI } from '../config/constants.js';
import { normalizeMovieTitle }  from '../utils/validation.js';
import { MovieHelper }          from '../helpers/movieHelper.js';
import { buildSearchResultsKeyboard } from '../telegram/keyboards.js';

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
    this.searchService    = searchService;
    this.telegramMessages = telegramMessages;
    this.telegramMedia    = telegramMedia;
    this.movieFileRepo    = movieFileRepo;
    this.fileRepo         = fileRepo;
    this.logger           = logger;
  }

  async handleMessage(update) {
    const chatId = update.message?.chat?.id;
    const text   = update.message?.text ?? '';
    const user   = update.message?.from;

    if (!chatId || !text) return null;

    const normalized = normalizeMovieTitle(text);
    if (!normalized) return null;

    // Requester display name
    const requesterName = user
      ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || 'User'
      : 'User';

    // Execute search via SearchService
    const searchRes = await this.searchService.search(normalized);

    if (searchRes.isEmpty) {
      await this.telegramMessages.sendMessage(
        chatId,
        [
          `<b>Tʜᴇ Rᴇsᴜʟᴛs Fᴏʀ</b> ☞ <b>${escapeHtml(normalized)}</b>`,
          ``,
          `<b>Rᴇǫᴜᴇsᴛᴇᴅ Bʏ</b> ☞ <b>${escapeHtml(requesterName)}</b>`,
          ``,
          `🚫 <b>Sᴏʀʀʏ, ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏᴜɴᴅ</b>`,
          ``,
          `⚠️ <b>ᴀꜰᴛᴇʀ 5 ᴍɪɴᴜᴛᴇs ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b>`,
        ].join('\n')
      );
      return null;
    }

    // Single result match — show movie card with quality buttons
    if (searchRes.movies.length === 1) {
      const movie = searchRes.movies[0];
      const files = await this.fileRepo.findByMovieId(movie.id);

      const { text: cardText, keyboard } = MovieHelper.formatMovieSearchResult(movie, files);

      await this.telegramMessages.sendMessage(chatId, cardText, { reply_markup: keyboard });
      return null;
    }

    // Multiple results — show styled header + file list keyboard
    const header   = searchRes.toHeaderText(requesterName);
    const keyboard = buildSearchResultsKeyboard(
      searchRes.movies,
      normalized,
      searchRes.page,
      searchRes.totalPages
    );

    await this.telegramMessages.sendMessage(chatId, header, { reply_markup: keyboard });
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
