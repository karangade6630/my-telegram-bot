/**
 * @fileoverview UserRepository — CRUD for the users table.
 * All queries are parameterized prepared statements.
 *
 * @module repositories/UserRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { User }           from '../models/User.js';
import { nowISO }         from '../utils/timeUtils.js';

export class UserRepository extends BaseRepository {
  // ─────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────

  /**
   * Find a user by their Telegram user ID.
   * @param {string} telegramUserId
   * @returns {Promise<User|null>}
   */
  async findByTelegramId(telegramUserId) {
    const row = await this.first(
      'SELECT * FROM users WHERE telegram_user_id = ?',
      [String(telegramUserId)]
    );
    return row ? User.fromRow(row) : null;
  }

  /**
   * Find a user by their D1 primary key.
   * @param {number} id
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    const row = await this.first('SELECT * FROM users WHERE id = ?', [id]);
    return row ? User.fromRow(row) : null;
  }

  /**
   * Get all users (paginated).
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<User[]>}
   */
  async findAll(limit = 50, offset = 0) {
    const rows = await this.all(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return User.fromRows(rows);
  }

  /**
   * Get all non-banned user IDs (for broadcast).
   * @returns {Promise<string[]>}
   */
  async getAllActiveTelegramIds() {
    const rows = await this.all(
      'SELECT telegram_user_id FROM users WHERE is_banned = 0',
      []
    );
    return rows.map(r => r.telegram_user_id);
  }

  /**
   * Count total users.
   * @returns {Promise<number>}
   */
  async countAll() {
    return this.count('users');
  }

  /**
   * Count active users (not banned).
   * @returns {Promise<number>}
   */
  async countActive() {
    return this.count('users', 'is_banned = 0');
  }

  // ─────────────────────────────────────────────────────────
  // WRITE
  // ─────────────────────────────────────────────────────────

  /**
   * Upsert a user from a Telegram `from` object.
   * On first interaction: insert. On repeat: update last_active.
   *
   * @param {object} from  - Telegram user object
   * @returns {Promise<User>}
   */
  async upsert(from) {
    const id   = String(from.id);
    const now  = nowISO();

    await this.run(
      `INSERT INTO users (telegram_user_id, first_name, last_name, username, language_code, last_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         first_name    = excluded.first_name,
         last_name     = excluded.last_name,
         username      = excluded.username,
         last_active   = excluded.last_active,
         updated_at    = excluded.updated_at`,
      [
        id,
        from.first_name  ?? '',
        from.last_name   ?? null,
        from.username    ?? null,
        from.language_code ?? 'en',
        now,
        now,
      ]
    );

    return this.findByTelegramId(id);
  }

  /**
   * Increment the user's total search count.
   * @param {string} telegramUserId
   * @returns {Promise<void>}
   */
  async incrementSearchCount(telegramUserId) {
    await this.run(
      `UPDATE users SET total_searches = total_searches + 1, updated_at = ? WHERE telegram_user_id = ?`,
      [nowISO(), String(telegramUserId)]
    );
  }

  /**
   * Ban a user.
   * @param {number} userId  - D1 users.id
   * @param {string} [reason]
   * @param {number} [bannedBy]
   * @returns {Promise<void>}
   */
  async ban(userId, reason, bannedBy) {
    await this.batch([
      {
        sql:      'UPDATE users SET is_banned = 1, updated_at = ? WHERE id = ?',
        bindings: [nowISO(), userId],
      },
      {
        sql:      'INSERT OR REPLACE INTO banned_users (user_id, reason, banned_by) VALUES (?, ?, ?)',
        bindings: [userId, reason ?? null, bannedBy ?? null],
      },
    ]);
  }

  /**
   * Unban a user.
   * @param {number} userId
   * @returns {Promise<void>}
   */
  async unban(userId) {
    await this.batch([
      {
        sql:      'UPDATE users SET is_banned = 0, updated_at = ? WHERE id = ?',
        bindings: [nowISO(), userId],
      },
      {
        sql:      'DELETE FROM banned_users WHERE user_id = ?',
        bindings: [userId],
      },
    ]);
  }

  /**
   * Set or remove admin status.
   * @param {number}  userId
   * @param {boolean} isAdmin
   * @param {string}  [role]
   * @returns {Promise<void>}
   */
  async setAdmin(userId, isAdmin, role = 'admin') {
    if (isAdmin) {
      await this.batch([
        {
          sql:      'UPDATE users SET is_admin = 1, updated_at = ? WHERE id = ?',
          bindings: [nowISO(), userId],
        },
        {
          sql:      'INSERT OR IGNORE INTO admins (user_id, role) VALUES (?, ?)',
          bindings: [userId, role],
        },
      ]);
    } else {
      await this.batch([
        {
          sql:      'UPDATE users SET is_admin = 0, updated_at = ? WHERE id = ?',
          bindings: [nowISO(), userId],
        },
        {
          sql:      'DELETE FROM admins WHERE user_id = ?',
          bindings: [userId],
        },
      ]);
    }
  }

  /**
   * Check if a user is banned.
   * @param {string} telegramUserId
   * @returns {Promise<boolean>}
   */
  async isBanned(telegramUserId) {
    return this.exists('users', 'telegram_user_id = ? AND is_banned = 1', [String(telegramUserId)]);
  }
}
