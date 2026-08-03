/**
 * @fileoverview ForceSubService — Verifies channel subscription enforcement.
 *
 * @module services/forceSubService
 */

export class ForceSubService {
  /**
   * @param {import('../telegram/chat.js').TelegramChat} telegramChat
   * @param {import('../repositories/base/BaseRepository.js').BaseRepository} repo
   */
  constructor(telegramChat, repo) {
    this.telegramChat = telegramChat;
    this.repo = repo;
  }

  /**
   * Check if user has joined all required channels.
   *
   * @param {string} userId
   * @returns {Promise<{ isSubscribed: boolean, missingChannels: Array<{channel_id: string, channel_url: string, title: string}> }>}
   */
  async checkForceSubscribe(userId) {
    const channels = await this.repo.all('SELECT * FROM force_sub WHERE is_required = 1');
    if (!channels || channels.length === 0) {
      return { isSubscribed: true, missingChannels: [] };
    }

    const missing = [];
    for (const channel of channels) {
      const isMember = await this.telegramChat.isMember(channel.channel_id, userId);
      if (!isMember) {
        missing.push(channel);
      }
    }

    return {
      isSubscribed: missing.length === 0,
      missingChannels: missing,
    };
  }
}
