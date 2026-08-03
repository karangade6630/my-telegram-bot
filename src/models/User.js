/**
 * @fileoverview User domain model.
 * Encapsulates a users row from D1.
 *
 * @module models/User
 */

import { ROLES } from '../config/constants.js';

export class User {
  /**
   * @param {object} data - Raw row from D1 users table.
   */
  constructor(data = {}) {
    this.id             = data.id              ?? null;
    this.telegramUserId = data.telegram_user_id ?? '';
    this.firstName      = data.first_name       ?? '';
    this.lastName       = data.last_name        ?? null;
    this.username       = data.username         ?? null;
    this.languageCode   = data.language_code    ?? 'en';
    this.isAdmin        = Boolean(data.is_admin);
    this.isBanned       = Boolean(data.is_banned);
    this.isPremium      = Boolean(data.is_premium);
    this.totalSearches  = data.total_searches   ? Number(data.total_searches) : 0;
    this.lastActive     = data.last_active       ?? null;
    this.createdAt      = data.created_at        ?? null;
    this.updatedAt      = data.updated_at        ?? null;
  }

  // ─── Computed Properties ──────────────────────────────────

  /** Full display name. */
  get displayName() {
    const parts = [this.firstName, this.lastName].filter(Boolean);
    return parts.join(' ') || this.username || `User ${this.telegramUserId}`;
  }

  /** @mention link for Telegram HTML. */
  get mention() {
    if (this.username) return `@${this.username}`;
    return `<a href="tg://user?id=${this.telegramUserId}">${this.displayName}</a>`;
  }

  /** Effective role string. */
  get role() {
    if (this.isAdmin)   return ROLES.ADMIN;
    if (this.isPremium) return ROLES.PREMIUM;
    return ROLES.USER;
  }

  /** Whether the user can bypass rate limits. */
  get canBypassRateLimit() {
    return this.isAdmin || this.isPremium;
  }

  // ─── Factory Methods ──────────────────────────────────────

  /**
   * Build a new User from a Telegram `from` object.
   * Used when upserting a user on first interaction.
   *
   * @param {object} from - Telegram user object from update.
   * @returns {User}
   */
  static fromTelegram(from) {
    return new User({
      telegram_user_id: String(from.id),
      first_name:       from.first_name  ?? '',
      last_name:        from.last_name   ?? null,
      username:         from.username    ?? null,
      language_code:    from.language_code ?? 'en',
    });
  }

  static fromRow(row) {
    return new User(row);
  }

  static fromRows(rows) {
    return (rows ?? []).map(r => User.fromRow(r));
  }

  // ─── Serialization ────────────────────────────────────────

  toRow() {
    return {
      telegram_user_id: this.telegramUserId,
      first_name:       this.firstName,
      last_name:        this.lastName,
      username:         this.username,
      language_code:    this.languageCode,
      is_admin:         this.isAdmin  ? 1 : 0,
      is_banned:        this.isBanned ? 1 : 0,
      is_premium:       this.isPremium ? 1 : 0,
      total_searches:   this.totalSearches,
      last_active:      this.lastActive,
    };
  }

  toJSON() {
    return {
      id:             this.id,
      telegramUserId: this.telegramUserId,
      displayName:    this.displayName,
      username:       this.username,
      role:           this.role,
      totalSearches:  this.totalSearches,
      lastActive:     this.lastActive,
    };
  }
}
