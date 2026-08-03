/**
 * @fileoverview MovieParser — high-level orchestrator for file indexing.
 * Combines CaptionParser + FilenameParser to produce the best possible
 * metadata from a Telegram channel_post message.
 *
 * Flow:
 *   channel_post → MovieParser.fromChannelPost() → ParsedMovie
 *
 * @module parsers/MovieParser
 */

import { CaptionParser } from './CaptionParser.js';
import { FilenameParser } from './FilenameParser.js';
import { slugify }        from '../utils/stringUtils.js';
import { CONTENT_TYPES }  from '../config/constants.js';

export class MovieParser {
  /**
   * Extract all metadata from a Telegram channel_post update.
   *
   * Telegram sends one of:
   *   - message.document  (any file)
   *   - message.video     (video files)
   *
   * @param {object} message - Telegram message object from update.
   * @returns {ParsedMovie|null}  null if message has no file.
   */
  static fromChannelPost(message) {
    if (!message) return null;

    // ── Step 1: Get Telegram file object ─────────────────────
    const tgFile = message.video || message.document || null;
    if (!tgFile) return null;   // no file attachment — ignore

    const fileId       = tgFile.file_id;
    const fileUniqueId = tgFile.file_unique_id;
    const mimeType     = tgFile.mime_type ?? '';
    const fileSize     = tgFile.file_size ?? null;
    const rawFilename  = tgFile.file_name ?? '';
    const isVideo      = !!message.video || mimeType.startsWith('video/');

    // ── Step 2: Parse filename + caption ─────────────────────
    const caption = message.caption ?? '';
    const parsed  = CaptionParser.parse(caption, rawFilename);

    // ── Step 3: Determine content type ───────────────────────
    const type = MovieParser._detectType(parsed);

    // ── Step 4: Build slug ───────────────────────────────────
    const slug = slugify(`${parsed.movieTitle}-${parsed.year ?? ''}`);

    // ── Step 5: Assemble result ──────────────────────────────
    return {
      // Movie-level data
      slug,
      movieTitle:  parsed.movieTitle,
      year:        parsed.year,
      type,
      language:    parsed.language,
      imdbRating:  parsed.imdbRating,

      // File-level data
      telegramFileId: fileId,
      uniqueId:       fileUniqueId,
      fileType:       isVideo ? 'video' : 'document',
      fileName:       rawFilename || null,
      mimeType,
      quality:        parsed.quality,
      codec:          parsed.codec,
      audioTracks:    parsed.audioTracks,
      isDualAudio:    parsed.isDualAudio,
      isHevc:         parsed.isHevc,
      isHdr:          parsed.isHdr,
      season:         parsed.season,
      episode:        parsed.episode,
      size:           parsed.size,
      sizeBytes:      fileSize,
      caption:        caption || null,
      channelId:      String(message.chat?.id ?? ''),
      messageId:      message.message_id ?? null,
    };
  }

  /**
   * Detect content type (movie/series/anime/web_series) from parsed data.
   *
   * @param {object} parsed
   * @returns {string}
   */
  static _detectType(parsed) {
    const title = (parsed.movieTitle ?? '').toLowerCase();
    const cap   = (parsed.rawCaption ?? '').toLowerCase();

    if (parsed.season || parsed.episode) {
      if (title.includes('anime') || cap.includes('anime')) return CONTENT_TYPES.ANIME;
      if (title.includes('web')   || cap.includes('web series')) return CONTENT_TYPES.WEB_SERIES;
      return CONTENT_TYPES.SERIES;
    }
    return CONTENT_TYPES.MOVIE;
  }
}

/**
 * @typedef {object} ParsedMovie
 * @property {string}       slug
 * @property {string}       movieTitle
 * @property {number|null}  year
 * @property {string}       type
 * @property {string|null}  language
 * @property {number|null}  imdbRating
 * @property {string}       telegramFileId
 * @property {string}       uniqueId
 * @property {string}       fileType
 * @property {string|null}  fileName
 * @property {string}       mimeType
 * @property {string|null}  quality
 * @property {string|null}  codec
 * @property {string|null}  audioTracks
 * @property {boolean}      isDualAudio
 * @property {boolean}      isHevc
 * @property {boolean}      isHdr
 * @property {number|null}  season
 * @property {number|null}  episode
 * @property {string|null}  size
 * @property {number|null}  sizeBytes
 * @property {string|null}  caption
 * @property {string}       channelId
 * @property {number|null}  messageId
 */
