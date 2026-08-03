/**
 * @fileoverview UserJoined domain event.
 * Emitted when a user sends /start for the first time.
 *
 * @module events/UserJoined
 */

export class UserJoined {
  /** @type {string} */
  static NAME = 'user.joined';

  /**
   * @param {object} payload
   * @param {string} payload.telegramUserId
   * @param {string} [payload.firstName]
   * @param {string} [payload.username]
   * @param {string} [payload.languageCode]
   * @param {Date}   [payload.joinedAt]
   */
  constructor({
    telegramUserId,
    firstName,
    username,
    languageCode,
    joinedAt = new Date(),
  }) {
    this.name           = UserJoined.NAME;
    this.telegramUserId = telegramUserId;
    this.firstName      = firstName;
    this.username       = username;
    this.languageCode   = languageCode;
    this.joinedAt       = joinedAt;
  }

  toJSON() {
    return {
      name:           this.name,
      telegramUserId: this.telegramUserId,
      firstName:      this.firstName,
      username:       this.username,
      languageCode:   this.languageCode,
      joinedAt:       this.joinedAt.toISOString(),
    };
  }
}
