/**
 * @fileoverview BroadcastService — Manages admin broadcasts via Cloudflare Queue.
 *
 * @module services/broadcastService
 */

import { BROADCAST_STATUS } from '../config/constants.js';

export class BroadcastService {
  /**
   * @param {import('../repositories/UserRepository.js').UserRepository} userRepo
   * @param {import('../repositories/base/BaseRepository.js').BaseRepository} repo
   * @param {import('../interfaces/Queue.js').IQueue} queue
   */
  constructor(userRepo, repo, queue) {
    this.userRepo = userRepo;
    this.repo = repo;
    this.queue = queue;
  }

  /**
   * Queue a broadcast message for background sending.
   *
   * @param {string} messageText
   * @param {number} adminUserId
   * @returns {Promise<number>} broadcast ID
   */
  async createBroadcast(messageText, adminUserId) {
    const res = await this.repo.run(
      `INSERT INTO broadcast (message, created_by, status) VALUES (?, ?, ?)`,
      [messageText, adminUserId, BROADCAST_STATUS.SENDING]
    );

    const broadcastId = res.meta.last_row_id;
    const userIds = await this.userRepo.getAllActiveTelegramIds();

    const batchSize = 100;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const chunk = userIds.slice(i, i + batchSize);
      await this.queue.send({
        type: 'broadcast_chunk',
        broadcastId,
        messageText,
        userIds: chunk,
      });
    }

    return broadcastId;
  }
}
