/**
 * @fileoverview Command Handler — Handlers for /start, /help, /about, /search, /settings.
 *
 * @module handlers/commandHandler
 */

import { BOT_COMMANDS } from '../config/constants.js';

export class CommandHandler {
  /**
   * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
   * @param {import('../services/searchService.js').SearchService} searchService
   */
  constructor(telegramMessages, searchService) {
    this.telegramMessages = telegramMessages;
    this.searchService = searchService;
  }

  async handleCommand(chatId, command, args, user) {
    switch (command) {
      case BOT_COMMANDS.START:
        await this.telegramMessages.sendMessage(
          chatId,
          `👋 Welcome to Movie AutoFilter Bot, <b>${user.displayName}</b>!\n\nJust send me any movie or series name and I will instantly search for available qualities!`
        );
        break;

      case BOT_COMMANDS.HELP:
        await this.telegramMessages.sendMessage(
          chatId,
          `📖 <b>Help & Instructions</b>\n\n1. Simply type a movie name like <code>Avengers Endgame</code>\n2. Select your desired quality (480p, 720p, 1080p, 4K)\n3. Receive the file instantly!`
        );
        break;

      case BOT_COMMANDS.ABOUT:
        await this.telegramMessages.sendMessage(
          chatId,
          `ℹ️ <b>About Movie AutoFilter Bot</b>\n\nServerless Telegram AutoFilter Bot built on Cloudflare Workers & D1.`
        );
        break;

      default:
        break;
    }
  }
}
