/**
 * @fileoverview AdminHandler — Manages admin commands (/stats, /broadcast, /ban, etc.).
 *
 * @module handlers/adminHandler
 */

import { buildAdminKeyboard } from '../telegram/keyboards.js';

export class AdminHandler {
  /**
   * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
   * @param {import('../services/analyticsService.js').AnalyticsService} analyticsService
   * @param {import('../repositories/UserRepository.js').UserRepository} userRepo
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   */
  constructor(telegramMessages, analyticsService, userRepo, movieRepo, fileRepo) {
    this.telegramMessages = telegramMessages;
    this.analyticsService = analyticsService;
    this.userRepo = userRepo;
    this.movieRepo = movieRepo;
    this.fileRepo = fileRepo;
  }

  async handleAdminCommand(chatId, command, args) {
    if (command === '/stats') {
      const users = await this.userRepo.countAll();
      const movies = await this.movieRepo.countAll();
      const files = await this.fileRepo.countAll();

      const text = `📊 <b>System Statistics</b>\n\n👥 Total Users: <b>${users}</b>\n🎬 Total Movies: <b>${movies}</b>\n💾 Total Files: <b>${files}</b>`;
      await this.telegramMessages.sendMessage(chatId, text, { reply_markup: buildAdminKeyboard() });
    }
  }
}
