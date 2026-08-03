/**
 * @fileoverview FileParser — extracts structured data from Telegram file objects.
 * Handles both document and video types.
 * Lower-level than MovieParser; used when only file metadata is needed.
 *
 * @module parsers/FileParser
 */

import { FilenameParser } from './FilenameParser.js';

export class FileParser {
  /**
   * Build a structured file data object from a Telegram document/video.
   *
   * @param {object} tgFile   - Telegram document or video object.
   * @param {string} [caption]
   * @returns {ParsedFile}
   */
  static parse(tgFile, caption = '') {
    if (!tgFile) return null;

    const filename = tgFile.file_name ?? '';
    const parsed   = FilenameParser.parse(filename);

    return {
      telegramFileId: tgFile.file_id,
      uniqueId:       tgFile.file_unique_id,
      fileName:       filename || null,
      mimeType:       tgFile.mime_type ?? null,
      sizeBytes:      tgFile.file_size ?? null,
      fileType:       FileParser._detectType(tgFile),
      quality:        parsed.quality,
      codec:          parsed.codec,
      language:       parsed.language,
      audioTracks:    parsed.audioTracks,
      isDualAudio:    parsed.isDualAudio,
      isHevc:         parsed.isHevc,
      isHdr:          parsed.isHdr,
      season:         parsed.season,
      episode:        parsed.episode,
      size:           parsed.size ?? FileParser._formatSize(tgFile.file_size),
      caption:        caption || null,
    };
  }

  /**
   * Determine file type from MIME type or object type.
   * @param {object} tgFile
   * @returns {'video'|'document'|'audio'}
   */
  static _detectType(tgFile) {
    const mime = tgFile.mime_type ?? '';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Format raw file size in bytes to human-readable string.
   * @param {number|null} bytes
   * @returns {string|null}
   */
  static _formatSize(bytes) {
    if (!bytes) return null;
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
    if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(0)} KB`;
    return `${bytes} B`;
  }
}

/**
 * @typedef {object} ParsedFile
 * @property {string}      telegramFileId
 * @property {string}      uniqueId
 * @property {string|null} fileName
 * @property {string|null} mimeType
 * @property {number|null} sizeBytes
 * @property {string}      fileType
 * @property {string|null} quality
 * @property {string|null} codec
 * @property {string|null} language
 * @property {string|null} audioTracks
 * @property {boolean}     isDualAudio
 * @property {boolean}     isHevc
 * @property {boolean}     isHdr
 * @property {number|null} season
 * @property {number|null} episode
 * @property {string|null} size
 * @property {string|null} caption
 */
