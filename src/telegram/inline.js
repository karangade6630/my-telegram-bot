/**
 * @fileoverview Telegram Inline API wrapper.
 * Handles answerInlineQuery for @bot inline search results.
 *
 * @module telegram/inline
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('telegram:inline');

export class TelegramInline {
  /**
   * @param {string} botToken
   */
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Answer an inline query with up to 50 results.
   *
   * @param {string}          inlineQueryId
   * @param {InlineResult[]}  results
   * @param {object}          [options]
   * @param {number}          [options.cacheTime]     - Seconds to cache results (default 300)
   * @param {boolean}         [options.isPersonal]    - Results differ per user
   * @param {string}          [options.nextOffset]    - For pagination
   * @param {object}          [options.button]        - Switch to bot button
   * @returns {Promise<object>}
   */
  async answer(inlineQueryId, results, options = {}) {
    return this._call('answerInlineQuery', {
      inline_query_id: inlineQueryId,
      results:         JSON.stringify(results),
      cache_time:      options.cacheTime   ?? 300,
      is_personal:     options.isPersonal  ?? true,
      next_offset:     options.nextOffset  ?? '',
      button:          options.button,
    });
  }

  /**
   * Build an InlineQueryResultArticle object.
   *
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.title
   * @param {string} opts.description
   * @param {string} opts.text           - Message text when result is selected
   * @param {object} [opts.replyMarkup]
   * @param {string} [opts.thumbUrl]
   * @returns {InlineResult}
   */
  static buildArticle({ id, title, description, text, replyMarkup, thumbUrl }) {
    return {
      type:                  'article',
      id,
      title,
      description,
      thumb_url:             thumbUrl,
      input_message_content: {
        message_text: text,
        parse_mode:   'HTML',
      },
      reply_markup: replyMarkup,
    };
  }

  /**
   * Build an InlineQueryResultPhoto object (for movie posters).
   *
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.photoUrl
   * @param {string} opts.thumbUrl
   * @param {string} opts.title
   * @param {string} opts.caption
   * @param {object} [opts.replyMarkup]
   * @returns {InlineResult}
   */
  static buildPhoto({ id, photoUrl, thumbUrl, title, caption, replyMarkup }) {
    return {
      type:       'photo',
      id,
      photo_url:  photoUrl,
      thumb_url:  thumbUrl ?? photoUrl,
      title,
      caption,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    };
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

/**
 * @typedef {object} InlineResult
 */
