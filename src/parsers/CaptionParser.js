/**
 * @fileoverview CaptionParser — extracts metadata from Telegram message captions.
 * Captions are often more reliable than filenames when admins add them manually.
 * Falls back gracefully if caption is missing.
 *
 * @module parsers/CaptionParser
 */

import { FilenameParser } from './FilenameParser.js';

/**
 * Regex patterns for caption key-value pairs.
 * Supports formats like:
 *   Title: Avengers Endgame
 *   Year: 2019
 *   Quality: 1080p
 *   Language: Hindi + English
 */
const CAPTION_PATTERNS = {
  TITLE:    /(?:title|name|movie)\s*[:\-]\s*(.+)/i,
  YEAR:     /(?:year|released?)\s*[:\-]\s*(\d{4})/i,
  QUALITY:  /(?:quality|res|resolution)\s*[:\-]\s*(\S+)/i,
  LANGUAGE: /(?:lang|language|audio)\s*[:\-]\s*(.+)/i,
  SIZE:     /(?:size|filesize)\s*[:\-]\s*(\d+(?:\.\d+)?\s*[KMGT]?B)/i,
  SEASON:   /(?:season|s)\s*[:\-]?\s*(\d+)/i,
  EPISODE:  /(?:episode|ep?)\s*[:\-]?\s*(\d+)/i,
  IMDB:     /(?:imdb|rating)\s*[:\-]\s*(\d+(?:\.\d+)?)/i,
};

export class CaptionParser {
  /**
   * Parse a Telegram message caption.
   * Merges structured key-value data with filename-parsed fallbacks.
   *
   * @param {string|null} caption   - Message caption text
   * @param {string|null} filename  - Fallback filename if caption is sparse
   * @returns {CaptionParsedData}
   */
  static parse(caption, filename = null) {
    const fileData = filename ? FilenameParser.parse(filename) : null;

    if (!caption || typeof caption !== 'string') {
      // Fallback entirely to filename parser
      return {
        movieTitle:  fileData?.movieTitle  ?? 'Unknown',
        year:        fileData?.year        ?? null,
        quality:     fileData?.quality     ?? null,
        language:    fileData?.language    ?? null,
        size:        fileData?.size        ?? null,
        season:      fileData?.season      ?? null,
        episode:     fileData?.episode     ?? null,
        imdbRating:  null,
        isDualAudio: fileData?.isDualAudio ?? false,
        isHevc:      fileData?.isHevc      ?? false,
        isHdr:       fileData?.isHdr       ?? false,
        codec:       fileData?.codec       ?? null,
        audioTracks: fileData?.audioTracks ?? null,
        rawCaption:  null,
      };
    }

    // Extract from caption key-value pairs
    const extract = (pattern) => {
      const m = caption.match(pattern);
      return m ? m[1].trim() : null;
    };

    const titleFromCaption    = extract(CAPTION_PATTERNS.TITLE);
    const yearFromCaption     = extract(CAPTION_PATTERNS.YEAR);
    const qualityFromCaption  = extract(CAPTION_PATTERNS.QUALITY);
    const languageFromCaption = extract(CAPTION_PATTERNS.LANGUAGE);
    const sizeFromCaption     = extract(CAPTION_PATTERNS.SIZE);
    const seasonStr           = extract(CAPTION_PATTERNS.SEASON);
    const episodeStr          = extract(CAPTION_PATTERNS.EPISODE);
    const imdbStr             = extract(CAPTION_PATTERNS.IMDB);

    return {
      movieTitle:  titleFromCaption   ?? fileData?.movieTitle  ?? CaptionParser._titleFromCaption(caption),
      year:        yearFromCaption    ? parseInt(yearFromCaption)  : fileData?.year    ?? null,
      quality:     qualityFromCaption ?? fileData?.quality     ?? null,
      language:    languageFromCaption?? fileData?.language    ?? null,
      size:        sizeFromCaption    ?? fileData?.size        ?? null,
      season:      seasonStr          ? parseInt(seasonStr)   : fileData?.season   ?? null,
      episode:     episodeStr         ? parseInt(episodeStr)  : fileData?.episode  ?? null,
      imdbRating:  imdbStr            ? parseFloat(imdbStr)  : null,
      isDualAudio: fileData?.isDualAudio ?? false,
      isHevc:      fileData?.isHevc      ?? false,
      isHdr:       fileData?.isHdr       ?? false,
      codec:       fileData?.codec       ?? null,
      audioTracks: fileData?.audioTracks ?? null,
      rawCaption:  caption,
    };
  }

  /**
   * Try to extract a movie title from the first line of the caption.
   * Many admins put the title on the first line without a key.
   *
   * @param {string} caption
   * @returns {string}
   */
  static _titleFromCaption(caption) {
    const firstLine = caption.split('\n')[0].trim();
    // If first line is short enough to be a title, use it
    if (firstLine.length > 2 && firstLine.length < 80) return firstLine;
    return 'Unknown';
  }
}

/**
 * @typedef {object} CaptionParsedData
 * @property {string}       movieTitle
 * @property {number|null}  year
 * @property {string|null}  quality
 * @property {string|null}  language
 * @property {string|null}  size
 * @property {number|null}  season
 * @property {number|null}  episode
 * @property {number|null}  imdbRating
 * @property {boolean}      isDualAudio
 * @property {boolean}      isHevc
 * @property {boolean}      isHdr
 * @property {string|null}  codec
 * @property {string|null}  audioTracks
 * @property {string|null}  rawCaption
 */
