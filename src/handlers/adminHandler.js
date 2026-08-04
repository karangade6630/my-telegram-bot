/**
 * @fileoverview AdminHandler — Manages admin commands (/stats, /broadcast, /ban, /unban, /movies, /users, etc.).
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
   * @param {import('../services/broadcastService.js').BroadcastService} [broadcastService]
   */
  constructor(telegramMessages, analyticsService, userRepo, movieRepo, fileRepo, broadcastService = null) {
    this.telegramMessages = telegramMessages;
    this.analyticsService = analyticsService;
    this.userRepo = userRepo;
    this.movieRepo = movieRepo;
    this.fileRepo = fileRepo;
    this.broadcastService = broadcastService;
  }

  async handleAdminCommand(chatId, command, rawArgs = [], user = null) {
    const args = Array.isArray(rawArgs)
      ? rawArgs
      : (typeof rawArgs === 'string' && rawArgs.trim() ? rawArgs.trim().split(/\s+/) : []);

    switch (command) {
      case '/stats': {
        const users = await this.userRepo.countAll();
        const movies = await this.movieRepo.countAll();
        const files = await this.fileRepo.countAll();
        const totalSizeBytes = await this.fileRepo.getTotalSizeBytes ? await this.fileRepo.getTotalSizeBytes() : 0;

        let formattedFileSize = '0 MB';
        if (totalSizeBytes >= 1073741824) {
          formattedFileSize = `${(totalSizeBytes / 1073741824).toFixed(2)} GB`;
        } else if (totalSizeBytes > 0) {
          formattedFileSize = `${(totalSizeBytes / 1048576).toFixed(2)} MB`;
        }

        const d1LimitGB = 10;
        const estimatedDbSizeMB = ((movies * 1.5 + files * 0.8 + users * 0.5) / 1024).toFixed(2);
        const estimatedDbSizeGB = (estimatedDbSizeMB / 1024).toFixed(3);
        const dbUsagePercent = ((estimatedDbSizeGB / d1LimitGB) * 100).toFixed(2);

        const text = [
          `📊 <b>System &amp; Database Statistics</b>`,
          ``,
          `👥 <b>Total Users:</b> <code>${users}</code>`,
          `🎬 <b>Total Movies:</b> <code>${movies}</code>`,
          `💾 <b>Total Files:</b> <code>${files}</code>`,
          `📦 <b>Indexed Files Size:</b> <code>${formattedFileSize}</code>`,
          ``,
          `🗄️ <b>Database Storage Status (Cloudflare D1):</b>`,
          `├ <b>Estimated DB Used:</b> <code>${estimatedDbSizeMB} MB</code> (${estimatedDbSizeGB} GB)`,
          `├ <b>Max DB Capacity:</b> <code>${d1LimitGB} GB</code>`,
          `└ <b>Fill Status:</b> <code>${dbUsagePercent}%</code> used (out of ${d1LimitGB} GB)`,
        ].join('\n');

        await this.telegramMessages.sendMessage(chatId, text, { reply_markup: buildAdminKeyboard() });
        break;
      }

      case '/ban': {
        const targetUserId = args[0];
        if (!targetUserId) {
          await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/ban &lt;user_id&gt; [reason]</code>');
          return;
        }
        const reason = args.slice(1).join(' ') || 'Violation of bot terms';
        const targetUser = await this.userRepo.findByTelegramId(targetUserId);
        if (!targetUser) {
          await this.telegramMessages.sendMessage(chatId, `❌ User with ID <code>${targetUserId}</code> not found in database.`);
          return;
        }
        await this.userRepo.ban(targetUser.id, reason, user?.id);
        await this.telegramMessages.sendMessage(chatId, `✅ <b>User Banned</b>\n\n👤 User ID: <code>${targetUserId}</code>\n📝 Reason: ${reason}`);
        break;
      }

      case '/unban': {
        const targetUserId = args[0];
        if (!targetUserId) {
          await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/unban &lt;user_id&gt;</code>');
          return;
        }
        const targetUser = await this.userRepo.findByTelegramId(targetUserId);
        if (!targetUser) {
          await this.telegramMessages.sendMessage(chatId, `❌ User with ID <code>${targetUserId}</code> not found in database.`);
          return;
        }
        await this.userRepo.unban(targetUser.id);
        await this.telegramMessages.sendMessage(chatId, `✅ <b>User Unbanned</b>\n\n👤 User ID: <code>${targetUserId}</code>`);
        break;
      }

      case '/movies': {
        const total = await this.movieRepo.countAll();
        const recent = await this.movieRepo.getRecent(5);
        let text = `🎬 <b>Total Movies:</b> <b>${total}</b>\n\n<b>Recently Added:</b>\n`;
        recent.forEach((m, idx) => {
          text += `${idx + 1}. <b>${m.title}</b> ${m.year ? `(${m.year})` : ''}\n`;
        });
        await this.telegramMessages.sendMessage(chatId, text);
        break;
      }

      case '/users': {
        const total = await this.userRepo.countAll();
        const active = await this.userRepo.countActive();
        const text = `👥 <b>User Overview</b>\n\nTotal Registered Users: <b>${total}</b>\nActive Users: <b>${active}</b>`;
        await this.telegramMessages.sendMessage(chatId, text);
        break;
      }

      case '/broadcast': {
        if (!args.length) {
          await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/broadcast &lt;message_text&gt;</code>');
          return;
        }

        const msgText = args.join(' ');

        if (!this.broadcastService) {
          await this.telegramMessages.sendMessage(chatId, '❌ Broadcast service is unavailable.');
          return;
        }

        await this.telegramMessages.sendMessage(chatId, `⏳ <b>Initiating Broadcast...</b>\nSending message to all active users...`);

        const result = await this.broadcastService.createBroadcast(msgText, user?.id || null);

        await this.telegramMessages.sendMessage(
          chatId,
          `✅ <b>Broadcast Complete!</b>\n\n👥 <b>Target Users:</b> <code>${result.totalUsers}</code>\n📤 <b>Sent Successfully:</b> <code>${result.sent}</code>\n❌ <b>Failed:</b> <code>${result.failed}</code>`
        );
        break;
      }

      default:
        break;
    }
  }
}
