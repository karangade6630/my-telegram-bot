/**
 * @fileoverview File domain model.
 * Encapsulates a files row from D1. Stores the Telegram file_id —
 * the bot NEVER downloads or re-uploads files.
 *
 * @module models/File
 */

import { QUALITY_LABELS, QUALITY_EMOJI } from '../config/constants.js';

export class File {
  /**
   * @param {object} data - Raw row from D1 files table.
   */
  constructor(data = {}) {
    this.id             = data.id              ?? null;
    this.telegramFileId = data.telegram_file_id ?? '';
    this.uniqueId       = data.unique_id        ?? '';
    this.fileName       = data.file_name        ?? null;
    this.fileType       = data.file_type        ?? 'document'; // 'document'|'video'|'audio'
    this.quality        = data.quality          ?? null;
    this.resolution     = data.resolution       ?? null;
    this.language       = data.language         ?? null;
    this.audioTracks    = data.audio_tracks     ?? null;
    this.subtitle       = data.subtitle         ?? null;
    this.codec          = data.codec            ?? null;
    this.isHevc         = Boolean(data.is_hevc);
    this.isHdr          = Boolean(data.is_hdr);
    this.isDualAudio    = Boolean(data.is_dual_audio);
    this.season         = data.season           ? Number(data.season) : null;
    this.episode        = data.episode          ? Number(data.episode) : null;
    this.size           = data.size             ?? null;
    this.sizeBytes      = data.size_bytes       ? Number(data.size_bytes) : null;
    this.caption        = data.caption          ?? null;
    this.channelId      = data.channel_id       ?? null;
    this.messageId      = data.message_id       ? Number(data.message_id) : null;
    this.indexedAt      = data.indexed_at       ?? null;
    this.updatedAt      = data.updated_at       ?? null;
  }

  // ─── Computed Properties ──────────────────────────────────

  /** Quality emoji for Telegram UI. */
  get qualityEmoji() {
    return QUALITY_EMOJI[this.quality?.toUpperCase()] ?? '📦';
  }

  /** Quality label in uppercase. */
  get qualityLabel() {
    return this.quality?.toUpperCase() ?? 'UNKNOWN';
  }

  /** Episode string e.g. "S02E05". */
  get episodeString() {
    if (this.season && this.episode) {
      return `S${String(this.season).padStart(2, '0')}E${String(this.episode).padStart(3, '0')}`;
    }
    if (this.season) return `Season ${this.season}`;
    return null;
  }

  /** Feature tags array e.g. ['HEVC', 'HDR', 'Dual Audio']. */
  get featureTags() {
    const tags = [];
    if (this.isHevc)      tags.push('HEVC');
    if (this.isHdr)       tags.push('HDR');
    if (this.isDualAudio) tags.push('Dual Audio');
    if (this.codec && !this.isHevc) tags.push(this.codec.toUpperCase());
    return tags;
  }

  /** Is this a video file? */
  get isVideo() {
    return this.fileType === 'video';
  }

  // ─── Factory Methods ──────────────────────────────────────

  /**
   * Build a File from a parsed Telegram message document/video.
   *
   * @param {object} parsed   - Output from FilenameParser.
   * @param {object} tgFile   - Telegram document/video object from update.
   * @param {string} channelId
   * @param {number} messageId
   * @returns {File}
   */
  static fromParsedAndTelegram(parsed, tgFile, channelId, messageId) {
    return new File({
      telegram_file_id: tgFile.file_id,
      unique_id:        tgFile.file_unique_id,
      file_name:        tgFile.file_name ?? parsed.filename ?? null,
      file_type:        tgFile.mime_type?.startsWith('video/') ? 'video' : 'document',
      quality:          parsed.quality        ?? null,
      resolution:       parsed.resolution     ?? null,
      language:         parsed.language       ?? null,
      audio_tracks:     parsed.audioTracks    ?? null,
      subtitle:         parsed.subtitle       ?? null,
      codec:            parsed.codec          ?? null,
      is_hevc:          parsed.isHevc         ? 1 : 0,
      is_hdr:           parsed.isHdr          ? 1 : 0,
      is_dual_audio:    parsed.isDualAudio    ? 1 : 0,
      season:           parsed.season         ?? null,
      episode:          parsed.episode        ?? null,
      size:             parsed.size           ?? null,
      size_bytes:       tgFile.file_size      ?? null,
      channel_id:       String(channelId),
      message_id:       messageId,
    });
  }

  static fromRow(row) {
    return new File(row);
  }

  static fromRows(rows) {
    return (rows ?? []).map(r => File.fromRow(r));
  }

  // ─── Serialization ────────────────────────────────────────

  toRow() {
    return {
      telegram_file_id: this.telegramFileId,
      unique_id:        this.uniqueId,
      file_name:        this.fileName,
      file_type:        this.fileType,
      quality:          this.quality,
      resolution:       this.resolution,
      language:         this.language,
      audio_tracks:     this.audioTracks,
      subtitle:         this.subtitle,
      codec:            this.codec,
      is_hevc:          this.isHevc      ? 1 : 0,
      is_hdr:           this.isHdr       ? 1 : 0,
      is_dual_audio:    this.isDualAudio ? 1 : 0,
      season:           this.season,
      episode:          this.episode,
      size:             this.size,
      size_bytes:       this.sizeBytes,
      caption:          this.caption,
      channel_id:       this.channelId,
      message_id:       this.messageId,
    };
  }

  toJSON() {
    return {
      id:             this.id,
      telegramFileId: this.telegramFileId,
      quality:        this.qualityLabel,
      size:           this.size,
      language:       this.language,
      episodeString:  this.episodeString,
      featureTags:    this.featureTags,
      fileType:       this.fileType,
    };
  }
}
