/**
 * @fileoverview Telegram Chat API wrapper.
 * Handles getChatMember, banChatMember, getChatAdministrators, etc.
 *
 * @module telegram/chat
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('telegram:chat');

export class TelegramChat {
  /**
   * @param {string} botToken
   */
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Get info about a chat member.
   * Used to verify force-subscribe status.
   *
   * @param {string|number} chatId
   * @param {string|number} userId
   * @returns {Promise<object>}  ChatMember object
   */
  async getChatMember(chatId, userId) {
    return this._call('getChatMember', { chat_id: chatId, user_id: userId });
  }

  /**
   * Check if a user is a member/subscriber of a channel.
   * Returns true for member, administrator, creator statuses.
   *
   * @param {string|number} channelId
   * @param {string|number} userId
   * @returns {Promise<boolean>}
   */
  async isMember(channelId, userId) {
    const res = await this.getChatMember(channelId, userId);
    if (!res.ok) return false;
    const status = res.result?.status;
    return ['member', 'administrator', 'creator'].includes(status);
  }

  /**
   * Get basic chat/channel information.
   *
   * @param {string|number} chatId
   * @returns {Promise<object>}
   */
  async getChat(chatId) {
    return this._call('getChat', { chat_id: chatId });
  }

  /**
   * Get list of channel administrators.
   *
   * @param {string|number} chatId
   * @returns {Promise<object[]>}
   */
  async getChatAdministrators(chatId) {
    const res = await this._call('getChatAdministrators', { chat_id: chatId });
    return res.ok ? res.result : [];
  }

  /**
   * Get member count of a chat.
   *
   * @param {string|number} chatId
   * @returns {Promise<number>}
   */
  async getChatMemberCount(chatId) {
    const res = await this._call('getChatMemberCount', { chat_id: chatId });
    return res.ok ? res.result : 0;
  }

  /**
   * Ban (kick) a user from a chat.
   *
   * @param {string|number} chatId
   * @param {string|number} userId
   * @param {number}        [untilDate] - Unix timestamp to unban, 0=forever
   * @returns {Promise<object>}
   */
  async banChatMember(chatId, userId, untilDate = 0) {
    return this._call('banChatMember', {
      chat_id:    chatId,
      user_id:    userId,
      until_date: untilDate,
    });
  }

  /**
   * Unban a user from a chat.
   *
   * @param {string|number} chatId
   * @param {string|number} userId
   * @returns {Promise<object>}
   */
  async unbanChatMember(chatId, userId) {
    return this._call('unbanChatMember', {
      chat_id:         chatId,
      user_id:         userId,
      only_if_banned:  true,
    });
  }

  /**
   * Leave a chat/channel.
   * @param {string|number} chatId
   * @returns {Promise<object>}
   */
  async leaveChat(chatId) {
    return this._call('leaveChat', { chat_id: chatId });
  }

  // ─── Internal ────────────────────────────────────────────────

  async _call(method, body) {
    const url = `${this.baseUrl}/${method}`;
    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) logger.warn(`Telegram ${method} error`, { error: data.description });
      return data;
    } catch (err) {
      logger.error(`Telegram ${method} failed`, { error: err.message });
      return { ok: false, description: err.message };
    }
  }
}
