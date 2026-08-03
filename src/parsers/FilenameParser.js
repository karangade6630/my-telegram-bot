/**
 * @fileoverview FilenameParser — core filename metadata extractor.
 * Parses raw filenames like:
 *   "Avengers.Endgame.2019.1080p.BluRay.x265.HEVC.Dual.Audio.mkv"
 * into structured metadata used by MovieIndexService.
 *
 * All regex patterns live in config/constants.js (FILENAME_PATTERNS).
 *
 * @module parsers/FilenameParser
 */

import { FILENAME_PATTERNS } from '../config/constants.js';
import { normalizeTitle } from '../utils/stringUtils.js';

export class FilenameParser {
  /**
   * Parse a raw filename into structured metadata.
   *
   * @param {string} filename - Raw file name e.g. from document.file_name
   * @returns {FileParsedData}
   */
  static parse(filename) {
    if (!filename || typeof filename !== 'string') {
      return FilenameParser._empty();
    }

    // Normalize separators: dots & underscores → spaces
    const normalized = filename
      .replace(/\.[^.]+$/, '')           // strip extension
      .replace(/[._]/g, ' ')             // separators → spaces
      .replace(/\s+/g, ' ')
      .trim();

    const quality    = FilenameParser._extractQuality(normalized);
    const year       = FilenameParser._extractYear(normalized);
    const season     = FilenameParser._extractSeason(normalized);
    const episode    = FilenameParser._extractEpisode(normalized);
    const codec      = FilenameParser._extractCodec(normalized);
    const language   = FilenameParser._extractLanguage(normalized);
    const isDualAudio= FILENAME_PATTERNS.DUAL_AUDIO.test(normalized);
    const isHevc     = FILENAME_PATTERNS.HEVC.test(normalized);
    const isHdr      = FILENAME_PATTERNS.HDR.test(normalized);
    const size       = FilenameParser._extractSize(filename);
    const movieTitle = FilenameParser._extractTitle(normalized, year, quality);
    const audioTracks= FilenameParser._extractAudio(normalized);

    return {
      filename,
      movieTitle,
      year,
      quality,
      codec,
      language,
      audioTracks,
      isDualAudio,
      isHevc,
      isHdr,
      season,
      episode,
      size,
      resolution: null,  // resolution extracted from quality if needed
    };
  }

  // ─── Private Extractors ──────────────────────────────────────

  static _extractQuality(str) {
    const m = str.match(FILENAME_PATTERNS.QUALITY);
    if (!m) return null;
    // Normalize quality to canonical form
    const q = m[0].toLowerCase();
    if (q.includes('2160') || q.includes('4k') || q.includes('uhd')) return '2160p';
    if (q.includes('1080'))  return '1080p';
    if (q.includes('720'))   return '720p';
    if (q.includes('480'))   return '480p';
    if (q.includes('360'))   return '360p';
    if (q.includes('cam'))   return 'CAM';
    return m[0].toUpperCase();
  }

  static _extractYear(str) {
    const m = str.match(FILENAME_PATTERNS.YEAR);
    return m ? parseInt(m[0]) : null;
  }

  static _extractSeason(str) {
    const m = str.match(FILENAME_PATTERNS.SEASON);
    return m ? parseInt(m[1]) : null;
  }

  static _extractEpisode(str) {
    const m = str.match(FILENAME_PATTERNS.EPISODE);
    return m ? parseInt(m[1]) : null;
  }

  static _extractCodec(str) {
    const m = str.match(FILENAME_PATTERNS.CODEC);
    if (!m) return null;
    const c = m[0].toLowerCase();
    if (c.includes('265') || c.includes('hevc')) return 'x265';
    if (c.includes('264'))                        return 'x264';
    return m[0].toUpperCase();
  }

  static _extractLanguage(str) {
    const m = str.match(FILENAME_PATTERNS.LANGUAGE);
    if (!m) return null;
    const l = m[0].toLowerCase();
    if (l.includes('hindi'))    return 'Hindi';
    if (l.includes('english'))  return 'English';
    if (l.includes('tamil'))    return 'Tamil';
    if (l.includes('telugu'))   return 'Telugu';
    if (l.includes('malayalam'))return 'Malayalam';
    if (l.includes('kannada'))  return 'Kannada';
    if (l.includes('bengali'))  return 'Bengali';
    if (l.includes('dual'))     return 'Dual Audio';
    if (l.includes('multi'))    return 'Multi Audio';
    return titleCase(m[0].replace(/[._]/g, ' ').trim());
  }

  static _extractAudio(str) {
    const m = str.match(FILENAME_PATTERNS.AUDIO);
    return m ? m[0].replace(/[._]/g, ' ').trim() : null;
  }

  static _extractSize(str) {
    const m = str.match(FILENAME_PATTERNS.SIZE);
    return m ? `${m[1]} ${m[2].toUpperCase()}` : null;
  }

  /**
   * Extract the movie title by removing all noise tokens.
   * Title is the part of the filename before quality/year markers.
   *
   * @param {string} normalized
   * @param {number|null} year
   * @param {string|null} quality
   * @returns {string}
   */
  static _extractTitle(normalized, year, quality) {
    let title = normalized;

    // Remove year and everything after
    if (year) {
      const idx = title.indexOf(String(year));
      if (idx > 2) title = title.slice(0, idx);
    }

    // Remove quality tag and everything after
    if (quality) {
      const idx = title.toLowerCase().indexOf(quality.toLowerCase());
      if (idx > 2) title = title.slice(0, idx);
    }

    // Remove common noise tokens
    const NOISE_TOKENS = [
      /\b(bluray|blu-ray|bdrip|webrip|web-dl|hdtv|dvdrip|hdrip|cam|hdcam)\b/gi,
      /\b(x264|x265|hevc|h\.264|h\.265|avc|xvid)\b/gi,
      /\b(aac|ac3|dts|dd5|dolby|atmos|flac|mp3)\b/gi,
      /\b(esub|esubs|subtitle|multi|dual)\b/gi,
      /\b\d+MB|\d+GB\b/gi,
    ];
    for (const re of NOISE_TOKENS) title = title.replace(re, '');

    // Remove S01E01 patterns
    title = title.replace(/[Ss]\d+[Ee]\d+.*/g, '');

    return normalizeTitle(title)
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .trim() || 'Unknown';
  }

  static _empty() {
    return {
      filename:    null,
      movieTitle:  'Unknown',
      year:        null,
      quality:     null,
      codec:       null,
      language:    null,
      audioTracks: null,
      isDualAudio: false,
      isHevc:      false,
      isHdr:       false,
      season:      null,
      episode:     null,
      size:        null,
      resolution:  null,
    };
  }
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * @typedef {object} FileParsedData
 * @property {string|null}  filename
 * @property {string}       movieTitle
 * @property {number|null}  year
 * @property {string|null}  quality
 * @property {string|null}  codec
 * @property {string|null}  language
 * @property {string|null}  audioTracks
 * @property {boolean}      isDualAudio
 * @property {boolean}      isHevc
 * @property {boolean}      isHdr
 * @property {number|null}  season
 * @property {number|null}  episode
 * @property {string|null}  size
 * @property {string|null}  resolution
 */
