/**
 * @fileoverview AnalyticsRepository — write-only analytics and log storage.
 *
 * @module repositories/AnalyticsRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { nowISO }         from '../utils/timeUtils.js';

export class AnalyticsRepository extends BaseRepository {

  /**
   * Record an analytics event.
   *
   * @param {string} eventName  - e.g. 'search', 'file_sent', 'user_joined'
   * @param {number|null} userId - D1 users.id
   * @param {object|null} payload
   * @returns {Promise<void>}
   */
  async trackEvent(eventName, userId = null, payload = null) {
    await this.run(
      `INSERT INTO analytics (event_name, user_id, event_payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [eventName, userId, payload ? JSON.stringify(payload) : null, nowISO()]
    );
  }

  /**
   * Write a structured log entry.
   *
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} message
   * @param {object} [metadata]
   * @param {string} [source]
   * @returns {Promise<void>}
   */
  async writeLog(level, message, metadata = null, source = null) {
    await this.run(
      `INSERT INTO logs (level, message, metadata, source, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [level, message, metadata ? JSON.stringify(metadata) : null, source, nowISO()]
    );
  }

  /**
   * Get recent error logs.
   * @param {number} limit
   * @returns {Promise<object[]>}
   */
  async getRecentErrors(limit = 50) {
    return this.all(
      `SELECT * FROM logs WHERE level = 'error' ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get analytics summary counts.
   * @returns {Promise<object>}
   */
  async getSummary() {
    const [searches, fileSends, joins, errors] = await Promise.all([
      this.count('analytics', "event_name = 'search'"),
      this.count('analytics', "event_name = 'file_sent'"),
      this.count('analytics', "event_name = 'user_joined'"),
      this.count('logs',      "level = 'error'"),
    ]);
    return { searches, fileSends, joins, errors };
  }

  /**
   * Delete logs older than N days.
   * Called by the CleanupScheduler.
   *
   * @param {number} days
   * @returns {Promise<number>} rows deleted
   */
  async deleteOldLogs(days = 30) {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const result = await this.run(
      'DELETE FROM logs WHERE created_at < ?',
      [cutoff]
    );
    return result.meta?.changes ?? 0;
  }

  /**
   * Delete analytics events older than N days.
   * @param {number} days
   * @returns {Promise<number>}
   */
  async deleteOldEvents(days = 90) {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const result = await this.run(
      'DELETE FROM analytics WHERE created_at < ?',
      [cutoff]
    );
    return result.meta?.changes ?? 0;
  }
}
