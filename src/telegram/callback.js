/**
 * @fileoverview Telegram Callback API wrapper.
 * Handles answerCallbackQuery and answerPreCheckoutQuery.
 *
 * @module telegram/callback
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('telegram:callback');

export class TelegramCallback {
  /**
   * @param {string} botToken
   */
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Answer a callback query (required within 30s of receiving it).
   * Must be called after every button press.
   *
   * @param {string} callbackQueryId
   * @param {object} [options]
   * @param {string} [options.text]       - Toast notification text
   * @param {boolean}[options.showAlert]  - Show as alert modal vs toast
   * @param {string} [options.url]        - URL to open (Game)
   * @param {number} [options.cacheTime]  - Seconds to cache result
   * @returns {Promise<object>}
   */
  async answer(callbackQueryId, options = {}) {
    return this._call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text:              options.text,
      show_alert:        options.showAlert ?? false,
      url:               options.url,
      cache_time:        options.cacheTime,
    });
  }

  /**
   * Answer with a visible toast notification.
   *
   * @param {string} callbackQueryId
   * @param {string} text
   * @returns {Promise<object>}
   */
  async toast(callbackQueryId, text) {
    return this.answer(callbackQueryId, { text, showAlert: false });
  }

  /**
   * Answer with a modal alert dialog.
   *
   * @param {string} callbackQueryId
   * @param {string} text
   * @returns {Promise<object>}
   */
  async alert(callbackQueryId, text) {
    return this.answer(callbackQueryId, { text, showAlert: true });
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
