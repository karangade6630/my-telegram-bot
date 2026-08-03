/**
 * @fileoverview BroadcastJob — Mass messaging queue processor chunk job.
 *
 * @module queue/BroadcastJob
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('BroadcastJob');

export class BroadcastJob {
  /**
   * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
   */
  constructor(telegramMessages) {
    this.telegramMessages = telegramMessages;
  }

  async run(payload) {
    const { broadcastId, messageText, userIds } = payload;
    logger.info(`Running broadcast job ${broadcastId} for ${userIds.length} users`);

    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      const res = await this.telegramMessages.sendMessage(userId, messageText);
      if (res.ok) sent++;
      else failed++;
    }

    return { sent, failed };
  }
}
