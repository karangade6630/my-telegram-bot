/**
 * @fileoverview Telegram Messages API wrapper.
 * Handles sendMessage, editMessageText, deleteMessage, forwardMessage.
 * All methods return the raw Telegram API response.
 *
 * @module telegram/messages
 */

import { PARSE_MODE } from '../config/constants.js';
import { Logger }     from '../utils/logger.js';

const logger = new Logger('telegram:messages');

export class TelegramMessages {
  /**
   * @param {string} botToken
   */
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Send a text message to a chat.
   *
   * @param {string|number} chatId
   * @param {string} text
   * @param {object} [extra] - Additional Telegram parameters
   * @returns {Promise<object>}
   */
  async sendMessage(chatId, text, extra = {}) {
    return this._call('sendMessage', {
      chat_id:    chatId,
      text,
      parse_mode: PARSE_MODE.HTML,
      ...extra,
    });
  }

  /**
   * Edit an existing message's text.
   *
   * @param {string|number} chatId
   * @param {number} messageId
   * @param {string} text
   * @param {object} [extra]
   * @returns {Promise<object>}
   */
  async editMessageText(chatId, messageId, text, extra = {}) {
    return this._call('editMessageText', {
      chat_id:    chatId,
      message_id: messageId,
      text,
      parse_mode: PARSE_MODE.HTML,
      ...extra,
    });
  }

  /**
   * Delete a message from a chat.
   *
   * @param {string|number} chatId
   * @param {number} messageId
   * @returns {Promise<object>}
   */
  async deleteMessage(chatId, messageId) {
    return this._call('deleteMessage', {
      chat_id:    chatId,
      message_id: messageId,
    });
  }

  /**
   * Forward a message from one chat to another.
   *
   * @param {string|number} toChatId
   * @param {string|number} fromChatId
   * @param {number} messageId
   * @returns {Promise<object>}
   */
  async forwardMessage(toChatId, fromChatId, messageId) {
    return this._call('forwardMessage', {
      chat_id:      toChatId,
      from_chat_id: fromChatId,
      message_id:   messageId,
    });
  }

  /**
   * Copy a message (like forward but without "Forwarded from" header).
   *
   * @param {string|number} toChatId
   * @param {string|number} fromChatId
   * @param {number} messageId
   * @param {object} [extra]
   * @returns {Promise<object>}
   */
  async copyMessage(toChatId, fromChatId, messageId, extra = {}) {
    return this._call('copyMessage', {
      chat_id:      toChatId,
      from_chat_id: fromChatId,
      message_id:   messageId,
      ...extra,
    });
  }

  /**
   * Pin a message in a chat.
   * @param {string|number} chatId
   * @param {number} messageId
   * @returns {Promise<object>}
   */
  async pinChatMessage(chatId, messageId) {
    return this._call('pinChatMessage', {
      chat_id:    chatId,
      message_id: messageId,
      disable_notification: true,
    });
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
      if (!data.ok) {
        logger.warn(`Telegram ${method} error`, { error: data.description, body });
      }
      return data;
    } catch (err) {
      logger.error(`Telegram ${method} fetch failed`, { error: err.message });
      return { ok: false, description: err.message };
    }
  }
}
