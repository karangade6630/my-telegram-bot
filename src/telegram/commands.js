/**
 * @fileoverview Telegram Commands API wrapper.
 * Handles setMyCommands, getMyCommands, setWebhook, deleteWebhook, getWebhookInfo.
 *
 * @module telegram/commands
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('telegram:commands');

export class TelegramCommands {
  /**
   * @param {string} botToken
   */
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Register bot commands in the Telegram client command list.
   *
   * @param {Array<{command: string, description: string}>} commands
   * @param {object} [scope] - BotCommandScope object
   * @returns {Promise<object>}
   */
  async setMyCommands(commands, scope = { type: 'default' }) {
    return this._call('setMyCommands', { commands, scope });
  }

  /**
   * Get current bot commands.
   * @returns {Promise<object[]>}
   */
  async getMyCommands() {
    const res = await this._call('getMyCommands', {});
    return res.ok ? res.result : [];
  }

  /**
   * Set the webhook URL for receiving updates.
   *
   * @param {string} url              - HTTPS webhook URL
   * @param {string} [secretToken]    - X-Telegram-Bot-Api-Secret-Token header value
   * @returns {Promise<object>}
   */
  async setWebhook(url, secretToken) {
    return this._call('setWebhook', {
      url,
      secret_token:       secretToken,
      drop_pending_updates: true,
      allowed_updates: [
        'message',
        'callback_query',
        'inline_query',
        'channel_post',
        'chosen_inline_result',
      ],
    });
  }

  /**
   * Delete the webhook (switch back to long polling).
   * @returns {Promise<object>}
   */
  async deleteWebhook() {
    return this._call('deleteWebhook', { drop_pending_updates: true });
  }

  /**
   * Get current webhook info.
   * @returns {Promise<object>}
   */
  async getWebhookInfo() {
    return this._call('getWebhookInfo', {});
  }

  /**
   * Get the bot user object.
   * @returns {Promise<object>}
   */
  async getMe() {
    return this._call('getMe', {});
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
