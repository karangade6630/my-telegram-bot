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
   * Handles messy real-world filenames:
   *   "A2M Captain America The first Avenger 2011 Tel Tam Hin Eng mkv"
   *   "PM Captain America: The First Avenger English MKV"
   *   "New The Toxic Avenger The Musical 2018 720p WEBRip mkv"
   *   "Captain America The First Avenger 2011 720p@UCParadiso srt"
   *
   * @param {string} normalized
   * @param {number|null} year
   * @param {string|null} quality
   * @returns {string}
   */
  static _extractTitle(normalized, year, quality) {
    let title = normalized;

    // ── Step 1: Strip @mentions (e.g. @UCParadiso watermarks) ─────────────
    title = title.replace(/@\w+/g, ' ');

    // ── Step 2: Normalise colons ("Title : Subtitle" → "Title Subtitle") ───
    title = title.replace(/\s*:\s*/g, ' ');

    // ── Step 3: Remove year and everything after ───────────────────────────
    if (year) {
      const idx = title.indexOf(String(year));
      if (idx > 2) title = title.slice(0, idx);
    }

    // ── Step 4: Remove quality tag and everything after ────────────────────
    if (quality) {
      const qualIdx = title.toLowerCase().indexOf(quality.toLowerCase());
      if (qualIdx > 2) title = title.slice(0, qualIdx);
    }

    // ── Step 5: Remove common source/codec/audio noise tokens ─────────────
    const NOISE_TOKENS = [
      /\b(bluray|blu[-\s]?ray|bdrip|webrip|web[-\s]?dl|hdtv|dvdrip|hdrip|cam|hdcam|remux|repack|proper|theatrical|extended|directors?\s*cut)\b/gi,
      /\b(x264|x265|hevc|h\.264|h\.265|avc|xvid|divx|10bit|8bit|hdr10?|dolby\.?vision|dv)\b/gi,
      /\b(aac|ac3|dts|dd5\.?1?|dolby|atmos|truehd|flac|mp3|eac3)\b/gi,
      /\b(esub|esubs|subtitles?|multi[-\s]?audio|dual[-\s]?audio|org\.?\s*auds?|org)\b/gi,
      /\b\d+\s*[MGK]B\b/gi,
      // Language abbreviation clusters (e.g. "Tel Tam Hin Eng", "Hin Dub")
      /\b(tel|tam|hin|eng|mal|kan|ben|pun|mar|urd|guj|ori|kor|jpn|chi|zho|ara|spa|fre|ger|ita|rus|por|dub)\b/gi,
    ];
    for (const re of NOISE_TOKENS) title = title.replace(re, ' ');

    // ── Step 6: Remove S01E01 / S01 / E01 patterns ────────────────────────
    title = title.replace(/\b[Ss]\d{1,2}[Ee]\d{1,3}\b.*/g, '');
    title = title.replace(/\b[Ss]\d{1,2}\b/g, '');

    // ── Step 7: Strip leading release-group prefix tokens ─────────────────
    //   These are short (1-5 char) ALL-CAPS alphanumeric tags at the very
    //   start of the filename: "A2M ", "PM ", "NF ", "HEVC ", etc.
    //   We strip them iteratively until the first token looks like a real word.
    title = title.replace(/^(\s*[A-Z][A-Z0-9]{0,4}\s+)+/g, (match) => {
      // Keep if all stripped tokens together are a likely real title start
      const tokens = match.trim().split(/\s+/);
      // Accept the strip only if each token is pure upper-case/alphanumeric
      const allNoise = tokens.every(t => /^[A-Z][A-Z0-9]{0,4}$/.test(t));
      return allNoise ? '' : match;
    });

    // Also strip specific known prefixes that slip through (case-insensitive)
    title = title.replace(/^\s*(?:new|hq|hd|uc\w*|hdmovies\w*)\s+/i, '');

    // ── Step 8: Strip trailing punctuation / noise characters ─────────────
    title = title.replace(/[\-_\.\[\]()]+/g, ' ');

    // ── Step 9: Final normalise + title-case ──────────────────────────────
    return normalizeTitle(title)
      .split(' ')
      .filter(w => w.length > 0)
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
