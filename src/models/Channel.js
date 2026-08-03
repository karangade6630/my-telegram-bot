/**
 * @fileoverview Channel domain model.
 * Encapsulates a channels row from D1.
 * Bot must be admin in this channel to receive channel_post updates.
 *
 * @module models/Channel
 */

export class Channel {
  /**
   * @param {object} data - Raw row from D1 channels table.
   */
  constructor(data = {}) {
    this.id                = data.id                  ?? null;
    this.telegramChannelId = data.telegram_channel_id ?? '';
    this.title             = data.title               ?? null;
    this.username          = data.username            ?? null;
    this.isActive          = data.is_active === undefined ? true : Boolean(data.is_active);
    this.isIndexSource     = data.is_index_source === undefined ? true : Boolean(data.is_index_source);
    this.lastIndexedMsgId  = data.last_indexed_msg_id ? Number(data.last_indexed_msg_id) : null;
    this.createdAt         = data.created_at          ?? null;
  }

  // ─── Computed Properties ──────────────────────────────────

  /** Telegram channel link. */
  get channelLink() {
    if (this.username) return `https://t.me/${this.username}`;
    return null;
  }

  /** Display name: title or @username or ID. */
  get displayName() {
    return this.title ?? (this.username ? `@${this.username}` : this.telegramChannelId);
  }

  // ─── Factory Methods ──────────────────────────────────────

  /**
   * Build a Channel from a Telegram chat object.
   * @param {object} chat - Telegram chat object.
   * @returns {Channel}
   */
  static fromTelegramChat(chat) {
    return new Channel({
      telegram_channel_id: String(chat.id),
      title:               chat.title    ?? null,
      username:            chat.username ?? null,
    });
  }

  static fromRow(row) {
    return new Channel(row);
  }

  static fromRows(rows) {
    return (rows ?? []).map(r => Channel.fromRow(r));
  }

  // ─── Serialization ────────────────────────────────────────

  toRow() {
    return {
      telegram_channel_id: this.telegramChannelId,
      title:               this.title,
      username:            this.username,
      is_active:           this.isActive       ? 1 : 0,
      is_index_source:     this.isIndexSource  ? 1 : 0,
      last_indexed_msg_id: this.lastIndexedMsgId,
    };
  }

  toJSON() {
    return {
      id:                  this.id,
      telegramChannelId:   this.telegramChannelId,
      title:               this.title,
      username:            this.username,
      channelLink:         this.channelLink,
      isActive:            this.isActive,
      isIndexSource:       this.isIndexSource,
      lastIndexedMsgId:    this.lastIndexedMsgId,
    };
  }
}
