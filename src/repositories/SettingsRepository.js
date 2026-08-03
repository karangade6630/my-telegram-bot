/**
 * @fileoverview SettingsRepository — key-value settings store backed by D1.
 * All settings are cached in KV for fast reads.
 *
 * @module repositories/SettingsRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { nowISO }         from '../utils/timeUtils.js';

export class SettingsRepository extends BaseRepository {

  /**
   * Get a setting value by key.
   * @param {string} key
   * @param {*} [defaultValue]
   * @returns {Promise<string|null>}
   */
  async get(key, defaultValue = null) {
    const row = await this.first(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return row?.value ?? defaultValue;
  }

  /**
   * Get all settings as a plain object.
   * @returns {Promise<Record<string, string>>}
   */
  async getAll() {
    const rows = await this.all('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  /**
   * Set a setting value.
   * @param {string} key
   * @param {string|number|boolean} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    await this.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, String(value), nowISO()]
    );
  }

  /**
   * Set multiple settings at once.
   * @param {Record<string, string|number|boolean>} data
   * @returns {Promise<void>}
   */
  async setMany(data) {
    const statements = Object.entries(data).map(([key, value]) => ({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      bindings: [key, String(value), nowISO()],
    }));
    if (statements.length) await this.batch(statements);
  }

  /**
   * Delete a setting.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await this.run('DELETE FROM settings WHERE key = ?', [key]);
  }

  /**
   * Check if maintenance mode is enabled.
   * @returns {Promise<boolean>}
   */
  async isMaintenanceMode() {
    const val = await this.get('maintenance', 'false');
    return val === 'true';
  }

  /**
   * Check if force-subscribe is enabled.
   * @returns {Promise<boolean>}
   */
  async isForceSubscribeEnabled() {
    const val = await this.get('force_subscribe', 'false');
    return val === 'true';
  }
}
