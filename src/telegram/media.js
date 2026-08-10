/**
 * @fileoverview Telegram Media API wrapper.
 * Handles sendDocument, sendVideo, sendPhoto, sendAudio, sendMediaGroup.
 * Files are sent using stored Telegram file_id — never re-uploaded.
 *
 * @module telegram/media
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('telegram:media');

export class TelegramMedia {
  /**
   * @param {string} botToken
   */
  constructor(botToken) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Send a document using a stored Telegram file_id.
   * This is the primary delivery method for movie files.
   *
   * @param {string|number} chatId
   * @param {string} fileId         - Telegram file_id (never re-uploads)
   * @param {string} [caption]
   * @param {object} [extra]        - e.g. { reply_markup }
   * @returns {Promise<object>}
   */
  async sendDocument(chatId, fileId, caption = '', extra = {}) {
    return this._call('sendDocument', {
      chat_id:   chatId,
      document:  fileId,
      caption,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  /**
   * Send a video using a stored Telegram file_id.
   *
   * @param {string|number} chatId
   * @param {string} fileId
   * @param {string} [caption]
   * @param {object} [extra]
   * @returns {Promise<object>}
   */
  async sendVideo(chatId, fileId, caption = '', extra = {}) {
    return this._call('sendVideo', {
      chat_id:   chatId,
      video:     fileId,
      caption,
      parse_mode: 'HTML',
      supports_streaming: true,
      ...extra,
    });
  }

  /**
   * Send a photo using a URL or file_id.
   *
   * @param {string|number} chatId
   * @param {string} photoUrlOrId
   * @param {string} [caption]
   * @param {object} [extra]
   * @returns {Promise<object>}
   */
  async sendPhoto(chatId, photoUrlOrId, caption = '', extra = {}) {
    return this._call('sendPhoto', {
      chat_id:   chatId,
      photo:     photoUrlOrId,
      caption,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  /**
   * Send an audio file using a file_id.
   *
   * @param {string|number} chatId
   * @param {string} fileId
   * @param {string} [caption]
   * @param {object} [extra]
   * @returns {Promise<object>}
   */
  async sendAudio(chatId, fileId, caption = '', extra = {}) {
    return this._call('sendAudio', {
      chat_id: chatId,
      audio:   fileId,
      caption,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  /**
   * Send a media group (album) using an array of InputMedia objects.
   *
   * @param {string|number} chatId
   * @param {object[]} media
   * @returns {Promise<object>}
   */
  async sendMediaGroup(chatId, media) {
    return this._call('sendMediaGroup', {
      chat_id: chatId,
      media,
    });
  }

  /**
   * Unified file sender — chooses sendDocument or sendVideo by fileType.
   *
   * @param {string|number} chatId
   * @param {string} fileId
   * @param {'document'|'video'|'audio'} fileType
   * @param {string} [caption]
   * @param {object} [extra]
   * @returns {Promise<object>}
   */
  async sendFile(chatId, fileId, fileType = 'document', caption = '', extra = {}) {
    let res;
    switch (fileType) {
      case 'video':
        res = await this.sendVideo(chatId, fileId, caption, extra);
        break;
      case 'audio':
        res = await this.sendAudio(chatId, fileId, caption, extra);
        break;
      default:
        res = await this.sendDocument(chatId, fileId, caption, extra);
        break;
    }
    // Fallback: If sendVideo or sendAudio fails (e.g. wrong file identifier for document file_ids), fallback to sendDocument
    if (!res?.ok && fileType !== 'document') {
      logger.warn(`sendFile with fileType=${fileType} failed (${res?.description || 'unknown error'}), falling back to sendDocument`);
      res = await this.sendDocument(chatId, fileId, caption, extra);
    }
    return res;
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
        logger.warn(`Telegram ${method} error`, { error: data.description });
      }
      return data;
    } catch (err) {
      logger.error(`Telegram ${method} fetch failed`, { error: err.message });
      return { ok: false, description: err.message };
    }
  }
}
