/**
 * @fileoverview BroadcastService — Manages admin broadcasts via Queue or direct Telegram delivery.
 *
 * @module services/broadcastService
 */

import { BROADCAST_STATUS } from '../config/constants.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('BroadcastService');

export class BroadcastService {
  /**
   * @param {import('../repositories/UserRepository.js').UserRepository} userRepo
   * @param {import('../repositories/base/BaseRepository.js').BaseRepository} repo
   * @param {import('../interfaces/Queue.js').IQueue|null} [queue]
   * @param {import('../telegram/messages.js').TelegramMessages|null} [telegramMessages]
   */
  constructor(userRepo, repo, queue = null, telegramMessages = null) {
    this.userRepo = userRepo;
    this.repo = repo;
    this.queue = queue;
    this.telegramMessages = telegramMessages;
  }

  /**
   * Send broadcast message to all active registered users.
   *
   * @param {string} messageText
   * @param {number|string} adminUserId
   * @returns {Promise<{ totalUsers: number, sent: number, failed: number }>}
   */
  async createBroadcast(messageText, adminUserId) {
    const userIds = await this.userRepo.getAllActiveTelegramIds();
    logger.info(`Starting broadcast for ${userIds.length} active users`);

    let broadcastId = null;
    try {
      const res = await this.repo.run(
        `INSERT INTO broadcast (message, created_by, status) VALUES (?, ?, ?)`,
        [messageText, adminUserId, BROADCAST_STATUS.SENDING]
      );
      broadcastId = res.meta?.last_row_id;
    } catch (err) {
      logger.warn('Failed to insert broadcast log row', { error: err.message });
    }

    let sent = 0;
    let failed = 0;

    const batchSize = 50;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const chunk = userIds.slice(i, i + batchSize);

      if (this.queue) {
        try {
          await this.queue.send({
            type: 'broadcast_chunk',
            broadcastId,
            messageText,
            userIds: chunk,
          });
          sent += chunk.length;
        } catch (queueErr) {
          logger.warn('Queue send failed, falling back to direct delivery', { error: queueErr.message });
          if (this.telegramMessages) {
            for (const uid of chunk) {
              const res = await this.telegramMessages.sendMessage(uid, messageText);
              if (res && res.ok) sent++;
              else failed++;
            }
          }
        }
      } else if (this.telegramMessages) {
        for (const uid of chunk) {
          const res = await this.telegramMessages.sendMessage(uid, messageText);
          if (res && res.ok) sent++;
          else failed++;
        }
      }
    }

    if (broadcastId) {
      try {
        await this.repo.run(
          `UPDATE broadcast SET status = ?, total_sent = ?, total_fail = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [BROADCAST_STATUS.DONE, sent, failed, broadcastId]
        );
      } catch {
        // quiet fallback
      }
    }

    return { totalUsers: userIds.length, sent, failed };
  }
}
