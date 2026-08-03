/**
 * @fileoverview UserResponse DTO.
 * Shapes user data for admin panel and profile display.
 *
 * @module dto/UserResponse
 */

import { EMOJI } from '../config/constants.js';

export class UserResponse {
  /**
   * @param {import('../models/User.js').User} user
   */
  constructor(user) {
    this.id             = user.id;
    this.telegramUserId = user.telegramUserId;
    this.displayName    = user.displayName;
    this.username       = user.username;
    this.role           = user.role;
    this.isBanned       = user.isBanned;
    this.isPremium      = user.isPremium;
    this.totalSearches  = user.totalSearches;
    this.lastActive     = user.lastActive;
    this.createdAt      = user.createdAt;
    this.mention        = user.mention;
  }

  /**
   * Format user profile for Telegram HTML.
   * @returns {string}
   */
  toProfileHTML() {
    const lines = [
      `${EMOJI.ROBOT} <b>User Profile</b>`,
      ``,
      `${EMOJI.CROWN} <b>Name:</b> ${this.mention}`,
      `🆔 <b>ID:</b> <code>${this.telegramUserId}</code>`,
      `${EMOJI.STAR} <b>Role:</b> ${this.role.toUpperCase()}`,
      `${EMOJI.SEARCH} <b>Total Searches:</b> ${this.totalSearches}`,
      `${EMOJI.CLOCK} <b>Last Active:</b> ${this.lastActive ?? 'Never'}`,
      `📅 <b>Joined:</b> ${this.createdAt ?? 'Unknown'}`,
    ];
    if (this.isBanned) lines.push(`\n${EMOJI.LOCK} <b>Status:</b> BANNED`);
    return lines.join('\n');
  }

  /** Build from User model. */
  static from(user) {
    return new UserResponse(user);
  }

  toJSON() {
    return {
      id:             this.id,
      telegramUserId: this.telegramUserId,
      displayName:    this.displayName,
      username:       this.username,
      role:           this.role,
      isBanned:       this.isBanned,
      totalSearches:  this.totalSearches,
      lastActive:     this.lastActive,
    };
  }
}
