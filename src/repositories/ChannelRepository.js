/**
 * @fileoverview ChannelRepository — CRUD for the channels table.
 *
 * @module repositories/ChannelRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { Channel }        from '../models/Channel.js';
import { nowISO }         from '../utils/timeUtils.js';

export class ChannelRepository extends BaseRepository {

  /**
   * Find a channel by Telegram channel ID.
   * @param {string} telegramChannelId
   * @returns {Promise<Channel|null>}
   */
  async findByTelegramId(telegramChannelId) {
    const row = await this.first(
      'SELECT * FROM channels WHERE telegram_channel_id = ?',
      [String(telegramChannelId)]
    );
    return row ? Channel.fromRow(row) : null;
  }

  /**
   * Get all active index-source channels.
   * @returns {Promise<Channel[]>}
   */
  async findActiveIndexChannels() {
    const rows = await this.all(
      'SELECT * FROM channels WHERE is_active = 1 AND is_index_source = 1'
    );
    return Channel.fromRows(rows);
  }

  /**
   * Get all channels.
   * @returns {Promise<Channel[]>}
   */
  async findAll() {
    const rows = await this.all('SELECT * FROM channels ORDER BY created_at DESC');
    return Channel.fromRows(rows);
  }

  /**
   * Upsert a channel from a Telegram chat object.
   * @param {object} chat
   * @returns {Promise<Channel>}
   */
  async upsert(chat) {
    await this.run(
      `INSERT INTO channels (telegram_channel_id, title, username, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(telegram_channel_id) DO UPDATE SET
         title    = excluded.title,
         username = excluded.username`,
      [String(chat.id), chat.title ?? null, chat.username ?? null, nowISO()]
    );
    return this.findByTelegramId(String(chat.id));
  }

  /**
   * Update the last indexed message ID for a channel.
   * @param {string} telegramChannelId
   * @param {number} messageId
   * @returns {Promise<void>}
   */
  async updateLastIndexedMsg(telegramChannelId, messageId) {
    await this.run(
      'UPDATE channels SET last_indexed_msg_id = ? WHERE telegram_channel_id = ?',
      [messageId, String(telegramChannelId)]
    );
  }

  /**
   * Toggle a channel's active status.
   * @param {string} telegramChannelId
   * @param {boolean} isActive
   * @returns {Promise<void>}
   */
  async setActive(telegramChannelId, isActive) {
    await this.run(
      'UPDATE channels SET is_active = ? WHERE telegram_channel_id = ?',
      [isActive ? 1 : 0, String(telegramChannelId)]
    );
  }

  /**
   * Delete a channel.
   * @param {string} telegramChannelId
   * @returns {Promise<void>}
   */
  async delete(telegramChannelId) {
    await this.run(
      'DELETE FROM channels WHERE telegram_channel_id = ?',
      [String(telegramChannelId)]
    );
  }
}
