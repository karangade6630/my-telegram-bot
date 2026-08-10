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

export class FilenameParser {
	/**
	 * Clean a raw post string or filename into a pure movie/series title.
	 * Removes noise tags, qualities, dual audio, brackets, duplicate strings, and season info.
	 *
	 * @param {string} raw
	 * @returns {string}
	 */
	static cleanMovieTitle(raw) {
		if (!raw || typeof raw !== 'string') return 'Unknown';

		let title = raw.trim();

		// Strip extension (.mkv, .mp4, etc.)
		title = title.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|3gp|ts)$/i, '');

		// Handle doubled duplicate titles (e.g. "Wieners WEB-DL... Wieners WEB-DL...")
		if (title.length > 20) {
			const half = Math.floor(title.length / 2);
			const firstHalf = title.slice(0, half).trim();
			const secondHalf = title.slice(half).trim();
			if (firstHalf.length > 5 && secondHalf.startsWith(firstHalf.slice(0, Math.min(15, firstHalf.length)))) {
				title = firstHalf;
			}
		}

		// Replace underscores, dots, pluses, pipes with spaces
		title = title.replace(/[._+|]/g, ' ');

		// Strip square bracket tags e.g. [Hindi ORG. + English], [English With Subtitles], [S01 Ep30 Added]
		title = title.replace(/\[[^\]]*\]/g, ' ');

		// Strip parenthetical season/episode info e.g. (Season 1-2), (Season 1), (Episode 1-10)
		title = title.replace(/\([^)]*season[^)]*\)/gi, ' ');
		title = title.replace(/\([^)]*episodes?[^)]*\)/gi, ' ');

		// Noise patterns to strip out
		const noisePatterns = [
			/\b\d{3,4}p\b/gi,                           // 480p, 720p, 1080p, 2160p
			/\b4k\b|\buhd\b|\bhd\b|\bhdrip\b|\bwebrip\b|\bbluray\b|\bweb-dl\b|\bwebdl\b|\bdvdrip\b|\bhdtv\b/gi,
			/\bdual\s*audio\b|\bmulti\s*audio\b|\bhindi\s*org\b|\bhindi\s*dubbed\b|\bhindi\b|\benglish\b|\btamil\b|\btelugu\b|\bkorean\b|\bfrench\b|\bturkish\b|\bbengali\b|\bmalayalam\b|\bkannada\b|\bdubbed\b/gi,
			/\bfull\s*movie\b|\bcomplete\s*web\s*series\b|\bcomplete\s*anime\s*series\b|\bcomplete\s*series\b|\bcomplete\s*turkish\s*drama\s*series\b|\bcomplete\s*tv\s*series\b|\bcomplete\b|\bnetflix\s*original\b|\bnetflix\b|\boriginal\b|\bseries\b|\banime\s*series\b|\bdrama\s*series\b/gi,
			/\bseason\s*\d+(?:-\d+)?\b/gi,              // Season 1, Season 1-2
			/\bs\d{1,2}(?:e\d{1,3})?\b/gi,              // S01, S01E05
			/\bep?\d{1,3}\b/gi,                          // Ep30
			/\bx264\b|\bx265\b|\bhevc\b|\baac\d?\b|\besub\b|\bsubtitles?\b|\bwith\s*subtitles?\b/gi,
			/\blink\b|\badded\b/gi,
		];

		for (const pattern of noisePatterns) {
			title = title.replace(pattern, ' ');
		}

		// Remove leftover bracket/parenthesis characters
		title = title.replace(/[\(\)\[\]\{\}]/g, ' ');

		// Normalize space
		title = title.replace(/\s+/g, ' ').trim();

		// Fallback if title became too short
		if (!title || title.length < 2) {
			title = raw.replace(/\.[^.]+$/, '').replace(/[._]/g, ' ').trim();
		}

		return title;
	}

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
			.replace(/\.[^.]+$/, '') // strip extension
			.replace(/[._]/g, ' ') // separators → spaces
			.replace(/\s+/g, ' ')
			.trim();

		const quality = FilenameParser._extractQuality(normalized);
		const year = FilenameParser._extractYear(normalized);
		const season = FilenameParser._extractSeason(normalized);
		const episode = FilenameParser._extractEpisode(normalized);
		const codec = FilenameParser._extractCodec(normalized);
		const language = FilenameParser._extractLanguage(normalized);
		const isDualAudio = FILENAME_PATTERNS.DUAL_AUDIO.test(normalized);
		const isHevc = FILENAME_PATTERNS.HEVC.test(normalized);
		const isHdr = FILENAME_PATTERNS.HDR.test(normalized);
		const size = FilenameParser._extractSize(filename);
		const movieTitle = FilenameParser.cleanMovieTitle(filename);
		const audioTracks = FilenameParser._extractAudio(normalized);

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
			resolution: null, // resolution extracted from quality if needed
		};
	}

	// ─── Private Extractors ──────────────────────────────────────

	static _extractQuality(str) {
		const m = str.match(FILENAME_PATTERNS.QUALITY);
		if (!m) return null;
		// Normalize quality to canonical form
		const q = m[0].toLowerCase();
		if (q.includes('2160') || q.includes('4k') || q.includes('uhd')) return '2160p';
		if (q.includes('1080')) return '1080p';
		if (q.includes('720')) return '720p';
		if (q.includes('480')) return '480p';
		if (q.includes('360')) return '360p';
		if (q.includes('cam')) return 'CAM';
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
		if (c.includes('264')) return 'x264';
		return m[0].toUpperCase();
	}

	static _extractLanguage(str) {
		const m = str.match(FILENAME_PATTERNS.LANGUAGE);
		if (!m) return null;
		const l = m[0].toLowerCase();
		if (l.includes('hindi')) return 'Hindi';
		if (l.includes('english')) return 'English';
		if (l.includes('tamil')) return 'Tamil';
		if (l.includes('telugu')) return 'Telugu';
		if (l.includes('malayalam')) return 'Malayalam';
		if (l.includes('kannada')) return 'Kannada';
		if (l.includes('bengali')) return 'Bengali';
		if (l.includes('dual')) return 'Dual Audio';
		if (l.includes('multi')) return 'Multi Audio';
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

	static _empty() {
		return {
			filename: null,
			movieTitle: null,
			year: null,
			quality: null,
			codec: null,
			language: null,
			audioTracks: null,
			isDualAudio: false,
			isHevc: false,
			isHdr: false,
			season: null,
			episode: null,
			size: null,
			resolution: null,
		};
	}
}

function titleCase(str) {
	return str.replace(/\b\w/g, (c) => c.toUpperCase());
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
