/**
 * @fileoverview MovieMetadataService — Multi-strategy IMDb metadata resolver with
 * confidence-scored title matching, season/episode-aware lookups, and OMDb fallback.
 *
 * Resolution pipeline (in order of preference):
 *   1. IMDb Suggestion API, queried in PARALLEL across several cleaned title variants
 *      (with year, without year, loosely cleaned, release-group stripped). Every
 *      candidate returned is scored against title similarity + year match + type
 *      match, and the highest-scoring candidate wins. This is the fast, reliable
 *      path and resolves the large majority of well-formed queries.
 *   2. Google Search HTML scrape — only used when step 1 has no confident match.
 *   3. Bing Search HTML scrape — only used when step 2 also fails. Bing tends to be
 *      less aggressive than Google about blocking automated requests, so it's a
 *      useful second search-engine fallback rather than a first choice.
 *   4. IMDb's own /find page — last-resort direct lookup.
 *   5. OMDb API (by resolved IMDb ID) to backfill any fields still missing after
 *      scraping (rating, runtime, genre, cast, plot, etc).
 *
 * Season / episode handling: once a series' IMDb ID is resolved, if a season (and
 * optionally an episode) was parsed from the query, the service makes a best-effort
 * attempt to fetch episode-level data (title, plot, air date, rating) from IMDb's
 * episode guide page. If a TMDB API key is supplied (see `tmdbApiKey` in the
 * OmdbService constructor), TMDB is used as a much more reliable structured source
 * for season/episode data — TMDB has first-class `/tv/{id}/season/{n}` endpoints,
 * unlike IMDb's episode guide which has to be scraped and can change without notice.
 *
 * TITLE EXTRACTION: many source catalogs already tag entries with a structured
 * suffix after the messy release filename, e.g.:
 *   "Skins S07E06 Rise Part 2 480p AMZN WEB DL Dual Audio AAC 2 0 H26 — Skins | TV Series"
 *   "Chum 2026 1080p WEB-DL Multi Audio ESub x264 — Chum | Movie | 2026"
 * That "— Title | Type | Year" suffix is authoritative and far more reliable than
 * trying to reverse-engineer the clean title out of release-tag soup, so
 * `extractTitleInfo()` prefers it whenever present, and that clean
 * name/year/type is what actually drives the search (IMDb suggestion API query,
 * Google/Bing fallback query, and candidate scoring) — not the raw junk string.
 * Only when no such suffix exists does extraction fall back to stripping known
 * release tags (resolution, source, codec, language, etc.) off the raw string.
 *
 * HONESTY NOTE: no scraper can be "100% guaranteed." IMDb and Google can change
 * their markup, rate-limit, or block requests at any time, and none of this is an
 * officially supported integration — scraping IMDb / Google search results directly
 * is against both sites' terms of service. This file is built to degrade gracefully
 * (multiple independent fallbacks, never throws) and reports a `matchConfidence` on
 * every result so callers can decide how much to trust it, but that's the strongest
 * honest claim it can make. For anything production-critical, pair this with a
 * licensed data source — OMDb with your OWN registered key (omdbapi.com, free tier
 * available) and/or TMDB's API are the dependable long-term options; treat the
 * scraping paths here as a free best-effort layer on top of those, not a replacement.
 *
 * No required API keys for the core path (OMDb fallback uses a shared public demo
 * key by default — see OmdbService constructor to pass your own, which you should
 * for anything beyond light testing, since shared keys get rate-limited).
 * Compatible with Cloudflare Workers (uses native fetch).
 */

import { decodeHtmlEntities } from '../utils/stringUtils.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MovieMetadataService');

// Default cache TTL (seconds) used when no KV_TTL config is wired in. The original
// file referenced an unimported `KV_TTL.IMDB_META` constant — kept configurable via
// the OmdbService constructor instead so this module has no dangling external ref.
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

// A small pool of realistic desktop User-Agents to rotate across retries, so a
// single blocked/fingerprinted UA doesn't take down every request in a run.
const USER_AGENT_POOL = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function randomUserAgent() {
	return USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
}

function browserHeaders() {
	return {
		'User-Agent': randomUserAgent(),
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.9',
	};
}

// Bot headers - IMDb serves pre-rendered HTML with full JSON-LD / __NEXT_DATA__ to search engine bots
const BOT_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9',
};

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs, spreadMs) {
	return baseMs + Math.floor(Math.random() * spreadMs);
}

// ─── Helpers ─────────────────────────────────────────────────

function clean(val) {
	if (val === undefined || val === null) return null;
	if (typeof val === 'string') {
		const trimmed = val.trim();
		if (!trimmed || trimmed.toLowerCase() === 'n/a') return null;
		return trimmed;
	}
	return val;
}

function safeDecode(val) {
	const c = clean(val);
	return c ? decodeHtmlEntities(c) : null;
}

/**
 * Formats seconds into human-readable hours and minutes (e.g. 9120 -> "2h 32m")
 */
function formatRuntime(seconds) {
	if (!seconds || isNaN(seconds)) return null;
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const parts = [];
	if (hrs > 0) parts.push(`${hrs}h`);
	if (mins > 0) parts.push(`${mins}m`);
	return parts.join(' ') || `${seconds}s`;
}

/**
 * Converts ISO 8601 duration format (e.g. "PT2H32M" or "PT45M") into "2h 32m"
 */
function parseISO8601Duration(durationStr) {
	if (!durationStr) return null;
	const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
	if (!matches) return durationStr;
	const hours = matches[1] ? `${matches[1]}h` : '';
	const minutes = matches[2] ? `${matches[2]}m` : '';
	return [hours, minutes].filter(Boolean).join(' ') || durationStr;
}

// Shared regex fragment for release-tag tokens (resolution/source/codec/lang/etc.)
// used both to strip tags from a query and to cut an episode subtitle short at
// the first tag that follows it.
const RELEASE_TAG_PATTERN =
	/\b(?:720p|1080p|2160p|4k|uhd|480p|576p|360p|web[- ]?dl|webrip|webdl|dsnp|amzn|ds4k|nf|hmax|atvp|pcok|hdtv|hdrip|bluray|blu[- ]?ray|brrip|dvdrip|remux|hdts|hdcam|proper|repack|internal|complete|x264|x265|h\.?26\d?|hevc|avc|aac\d*[\s.]?\d*|ac3|dd[\s.]?\d[\s.]?\d|ddp?\d*[\s.]?\d*|dts|flac|xvid|10bit|8bit|hdr10?\+?|sdr|atmos|esubs?|subs?|dual|multi|hindi|english|korean|telugu|tamil|bengali|gujurati|kannada|dubbed|esu|kor|eng|jpn|hin)\b/i;

/**
 * Cleans scene release tags (720p, WEB-DL, DSNP, HDRip, AAC5.1, x264, ESub, etc.)
 * from search queries to extract the actual movie/show title. This is the legacy
 * heuristic pass — it's a decent best-effort cleaner but can't always fully strip
 * everything (see extractTitleInfo for the preferred, structured-suffix-aware path).
 *
 * @param {string} query - Raw search query (possibly a scene release filename)
 * @returns {object} { cleaned, season, episode }
 */
function cleanQuery(query) {
	if (!query) return { cleaned: '', season: null, episode: null };

	let cleaned = query;

	// Extract Season & Episode info before cleaning
	let season = null;
	let episode = null;
	const seMatch = cleaned.match(/\bS(\d{1,2})\s*E(\d{1,2})\b/i);
	if (seMatch) {
		season = seMatch[1];
		episode = seMatch[2];
		cleaned = cleaned.substring(0, seMatch.index).trim();
	} else {
		const sOnly = cleaned.match(/\bSeason\s*(\d{1,2})\b/i);
		if (sOnly) {
			season = sOnly[1];
			cleaned = cleaned.substring(0, sOnly.index).trim();
		}
	}

	// Remove all known release tags (resolution, source, codec, language, misc)
	cleaned = cleaned.replace(new RegExp(RELEASE_TAG_PATTERN, 'gi'), '');

	// Extract year if present
	const yearMatch = cleaned.match(/\b((?:19|20)\d{2})\b/);

	// Clean extra symbols and whitespace
	cleaned = cleaned.replace(/[-._#()[\]{}|]/g, ' ');
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	// If we have a year, try to trim everything after the year
	if (yearMatch) {
		const yearIdx = cleaned.indexOf(yearMatch[1]);
		if (yearIdx > 0) {
			const afterYear = cleaned.substring(yearIdx + yearMatch[1].length).trim();
			if (afterYear.length > 0 && afterYear.split(/\s+/).length <= 2) {
				cleaned = cleaned.substring(0, yearIdx + yearMatch[1].length).trim();
			}
		}
	}

	return { cleaned, season, episode };
}

/** Extract IMDb ID from string or URL (tt1234567) */
function extractImdbId(query) {
	if (!query) return null;
	const match = String(query).match(/(tt\d{6,10})/i);
	return match ? match[1] : null;
}

/**
 * Extracts a structured {name, year, type, season, episode, episodeTitle} record
 * from a raw title / release filename. This is the SINGLE SOURCE OF TRUTH used to
 * build the actual search query (suggestion-API variants, Google/Bing fallback
 * query, and candidate scoring) — the raw filename itself is never used as a
 * search query directly.
 *
 * Two extraction paths, tried in order:
 *
 *   1. STRUCTURED SUFFIX (preferred): many sources already tag entries with a
 *      clean "— Title | Type | Year" suffix after the messy release filename,
 *      e.g. "Skins S07E06 Rise Part 2 480p AMZN WEB DL ... — Skins | TV Series"
 *      or "Chum 2026 1080p WEB-DL ... — Chum | Movie | 2026". When present, that
 *      suffix is authoritative for name/type/year — it's already exactly what
 *      should be searched, with none of the release-tag noise.
 *
 *   2. HEURISTIC FALLBACK: when no such suffix exists, fall back to stripping
 *      known release tags (resolution, source, codec, language, etc.) off the
 *      raw string via `cleanQuery`.
 *
 * Season/episode (SxxExx or "Season N") are always parsed straight off the raw
 * string first, since they usually sit in the messy filename portion even when a
 * clean suffix is present.
 *
 * `type` here is a SEARCH HINT ('movie' | 'series') used to bias matching and to
 * steer the Google/Bing fallback queries. The `type` in the final metadata
 * returned by OmdbService always comes from IMDb's own data for the resolved
 * title, not from this guess.
 */
function extractTitleInfo(rawTitle) {
	if (!rawTitle) return { name: '', year: null, type: 'movie', season: null, episode: null, episodeTitle: null };

	const raw = String(rawTitle);

	// Season / episode are parsed off the full raw string up front, regardless of
	// which branch below ends up supplying name/year/type.
	let season = null;
	let episode = null;
	let afterMarker = '';
	const seMatch = raw.match(/\bS(\d{1,2})\s*E(\d{1,2})\b/i);
	if (seMatch) {
		season = seMatch[1];
		episode = seMatch[2];
		afterMarker = raw.substring(seMatch.index + seMatch[0].length).trim();
	} else {
		const sOnly = raw.match(/\bSeason\s*(\d{1,2})\b/i);
		if (sOnly) {
			season = sOnly[1];
			afterMarker = raw.substring(sOnly.index + sOnly[0].length).trim();
		}
	}

	// Helper: given the text right after the S/E (or Season) marker, pull out a
	// short episode subtitle if one is present — e.g. "Rise Part 2 480p AMZN
	// WEB DL ..." -> "Rise Part 2". Cuts at the next "— Title | Type" suffix
	// (if any) and then at the first recognizable release tag.
	function extractEpisodeTitle(text) {
		if (!text) return null;
		const beforeSuffix = text.split(/\s+[—–-]{1,2}\s+(?=[^|]*\|)/)[0];
		const subtitle = beforeSuffix.split(RELEASE_TAG_PATTERN)[0].replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
		return subtitle && subtitle.length <= 60 ? subtitle : null;
	}

	// ── Path 1: structured "— Title | Type | Year" suffix (preferred) ──
	const dashMatch = raw.match(/\s[—–-]\s/);
	if (dashMatch) {
		const idx = dashMatch.index;
		const suffix = raw.substring(idx + dashMatch[0].length);
		if (suffix.includes('|')) {
			const parts = suffix
				.split('|')
				.map((p) => p.trim())
				.filter(Boolean);
			if (parts.length >= 2) {
				const name = parts[0];
				const typeRaw = parts[1].toLowerCase();
				const type = /movie|film/.test(typeRaw) ? 'movie' : 'series';

				let year = null;
				for (let i = 2; i < parts.length; i += 1) {
					const ym = parts[i].match(/\b((?:19|20)\d{2})\b/);
					if (ym) {
						year = ym[1];
						break;
					}
				}
				if (!year) {
					// Year sometimes only appears in the messy prefix, e.g. "Chum 2026 1080p ...".
					const prefixYear = raw.substring(0, idx).match(/\b((?:19|20)\d{2})\b/);
					if (prefixYear) year = prefixYear[1];
				}

				return { name, year, type, season, episode, episodeTitle: extractEpisodeTitle(afterMarker) };
			}
		}
	}

	// ── Path 2: heuristic fallback — strip known release tags off the raw string ──
	let working = raw;

	let explicitType = null;
	const typeAnnotationMatch = working.match(/[—-]\s*(TV\s*Series|Web\s*Series|Mini\s*Series|Anime(?:\s*Series)?|Movie|Film)\b/i);
	if (typeAnnotationMatch) {
		const t = typeAnnotationMatch[1].toLowerCase();
		explicitType = t.includes('movie') || t.includes('film') ? 'movie' : 'series';
		working = working.slice(0, typeAnnotationMatch.index).trim();
	}

	const { cleaned } = cleanQuery(working);
	const yearMatch = cleaned.match(/\b((?:19|20)\d{2})\b/);
	const year = yearMatch ? yearMatch[1] : null;
	const name = year ? cleaned.replace(year, '').replace(/\s+/g, ' ').trim() : cleaned;

	const type = explicitType || (season ? 'series' : 'movie');

	return { name: name || cleaned || working, year, type, season, episode, episodeTitle: extractEpisodeTitle(afterMarker) };
}

/**
 * Normalizes a title for fuzzy comparison: strips accents/punctuation, lowercases,
 * and drops a leading article so "The Matrix" and "Matrix" compare equal.
 */
function normalizeTitle(str) {
	if (!str) return '';
	return String(str)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/^(the|a|an)\s+/i, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Lightweight token-overlap (Jaccard) similarity between two titles, 0..1.
 * Deliberately simple/dependency-free rather than a full edit-distance metric —
 * it's used to RANK candidates from the same suggestion set, not to make hard
 * pass/fail decisions on its own.
 */
function titleSimilarity(a, b) {
	const na = normalizeTitle(a);
	const nb = normalizeTitle(b);
	if (!na || !nb) return 0;
	if (na === nb) return 1;
	const tokensA = new Set(na.split(' ').filter(Boolean));
	const tokensB = new Set(nb.split(' ').filter(Boolean));
	if (!tokensA.size || !tokensB.size) return 0;
	let overlap = 0;
	tokensA.forEach((t) => {
		if (tokensB.has(t)) overlap += 1;
	});
	const union = new Set([...tokensA, ...tokensB]).size;
	return union ? overlap / union : 0;
}

/**
 * Native fetch helper with timeout, header-set fallback, one retry with a fresh
 * User-Agent, and small jitter delays between attempts (reduces the chance of
 * back-to-back requests tripping basic rate limiting).
 */
async function fetchHtml(url, customHeaders = null, { retries = 1 } = {}) {
	const attempts = customHeaders ? [customHeaders] : [BOT_HEADERS, browserHeaders()];

	for (let i = 0; i < attempts.length; i += 1) {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 8000);
			const res = await fetch(url, { headers: attempts[i], signal: controller.signal });
			clearTimeout(timer);
			if (res.ok) {
				return await res.text();
			}
		} catch (e) {
			logger.debug(`fetchHtml attempt ${i + 1} failed for ${url}: ${e.message}`);
		}
		if (i < attempts.length - 1) await sleep(jitter(150, 300));
	}

	// One extra retry with a fresh random UA, in case the failure was transient
	if (retries > 0) {
		await sleep(jitter(300, 400));
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 8000);
			const res = await fetch(url, { headers: browserHeaders(), signal: controller.signal });
			clearTimeout(timer);
			if (res.ok) return await res.text();
		} catch (e) {
			logger.warn(`fetchHtml retry failed for ${url}: ${e.message}`);
		}
	}

	return null;
}

/**
 * Fetches data for an IMDb ID from IMDb's public suggestion API
 */
async function fetchImdbApiData(imdbId) {
	try {
		const suggestionUrl = `https://v3.sg.media-imdb.com/suggestion/t/${imdbId}.json`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 5000);
		const res = await fetch(suggestionUrl, { headers: browserHeaders(), signal: controller.signal });
		clearTimeout(timer);
		if (res.ok) {
			const data = await res.json();
			if (data && data.d && data.d.length > 0) {
				return data.d[0];
			}
		}
	} catch (e) {
		// Ignore suggestion API error
	}
	return null;
}

/**
 * Text search against IMDb's public suggestion API. Uses the query's own first
 * character for the path segment, which is IMDb's documented convention for this
 * endpoint (the earlier version of this file hardcoded "x" for every query, which
 * happened to still work in practice but isn't the intended usage).
 *
 * @returns {Promise<Array>} raw suggestion entries (each with id/l/y/q/qid/s/i)
 */
async function imdbSuggestionSearch(query) {
	if (!query) return [];
	const formatted = query
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	if (!formatted) return [];
	const firstChar = /[a-z0-9]/.test(formatted[0]) ? formatted[0] : 'a';
	const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(formatted)}.json`;

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 5000);
		const res = await fetch(url, { headers: browserHeaders(), signal: controller.signal });
		clearTimeout(timer);
		if (res.ok) {
			const data = await res.json();
			if (data && Array.isArray(data.d)) {
				return data.d.filter((item) => item.id && item.id.startsWith('tt'));
			}
		}
	} catch (e) {
		logger.debug(`imdbSuggestionSearch failed for "${query}": ${e.message}`);
	}
	return [];
}

/**
 * Builds several reasonable query variants from a raw title / filename so the
 * resolver isn't dependent on getting exactly one cleaning pass right. Cheap to
 * try in parallel since the suggestion API calls are lightweight JSON requests.
 *
 * The clean {name, year, type} from `extractTitleInfo` (structured-suffix-aware)
 * is the PRIMARY source for variants — the legacy `cleanQuery` heuristic result is
 * only added as an extra backstop variant, never as the primary query, so a messy
 * filename with an authoritative "— Title | Type | Year" suffix no longer leaks
 * leftover release tags into the actual search.
 */
function generateQueryVariants(rawTitle) {
	const info = extractTitleInfo(rawTitle);
	const { name, year, type, season, episode } = info;

	const variants = new Set();
	if (name) {
		variants.add(name);
		if (year) variants.add(`${name} ${year}`);
	}

	// Legacy cleaned-string variant, kept as a looser backstop in case
	// extractTitleInfo's parsing missed something the old tag-stripping pipeline
	// would have caught. Only added if it's meaningfully different from `name`.
	const { cleaned } = cleanQuery(rawTitle);
	if (cleaned && normalizeTitle(cleaned) !== normalizeTitle(name)) {
		variants.add(cleaned);
	}

	return { variants: [...variants].filter(Boolean), year, season, episode, name, type };
}

/**
 * Scores and ranks candidates returned across all suggestion-API variant queries,
 * combining title similarity with year and (for series queries) type agreement.
 */
function pickBestCandidate(candidates, primaryQuery, year, isLikelySeries) {
	if (!candidates.length) return null;

	const scored = candidates.map((c) => {
		let score = titleSimilarity(c.title, primaryQuery);
		if (year && c.year && String(c.year) === String(year)) score += 0.4;
		const type = (c.type || '').toLowerCase();
		if (isLikelySeries && type.includes('series')) score += 0.15;
		if (!isLikelySeries && (type.includes('feature') || type.includes('movie'))) score += 0.1;
		return { ...c, score };
	});

	scored.sort((a, b) => b.score - a.score);
	return scored[0];
}

/**
 * Resolves an IMDb ID for a free-text title / filename using, in order: the
 * suggestion API (multiple variants, scored), Google search scraping, Bing search
 * scraping, then IMDb's own /find page. Returns null only if every strategy fails.
 *
 * The query actually sent to every strategy is the CLEAN {name, year, type} coming
 * out of `extractTitleInfo` / `generateQueryVariants` — never the raw filename —
 * so a structured "— Title | Type | Year" suffix (when present) drives the whole
 * search instead of getting diluted by leftover release-tag noise.
 *
 * @returns {Promise<{imdbId: string, confidence: 'high'|'medium'|'low', matchedTitle: ?string, season: ?string, episode: ?string}|null>}
 */
async function resolveImdbId(rawTitle) {
	if (!rawTitle) return null;
	const { variants, year, season, episode, name, type } = generateQueryVariants(rawTitle);
	if (!variants.length) return null;

	// The clean extracted name (not variants[0], which may reorder) is what we
	// score candidates against and what seeds the Google/Bing fallback queries.
	const primaryQuery = name || variants[0];
	const isLikelySeries = type === 'series';

	logger.debug('Resolving IMDb ID', { rawTitle, primaryQuery, year, season, episode, type });

	// ── STEP 1: IMDb Suggestion API across all variants, in parallel ──
	const batches = await Promise.allSettled(variants.map((v) => imdbSuggestionSearch(v)));
	const candidates = [];
	batches.forEach((result) => {
		if (result.status === 'fulfilled') {
			result.value.forEach((item) => {
				candidates.push({
					imdbId: item.id,
					title: item.l,
					year: item.y ? String(item.y) : null,
					type: item.q || item.qid || null,
				});
			});
		}
	});

	const best = pickBestCandidate(candidates, primaryQuery, year, isLikelySeries);
	if (best && best.score >= 0.35) {
		return {
			imdbId: best.imdbId,
			confidence: best.score >= 0.85 ? 'high' : best.score >= 0.55 ? 'medium' : 'low',
			matchedTitle: best.title || null,
			season,
			episode,
		};
	}

	// ── STEP 2: Google Search scrape fallback ──
	// Built from the clean name + year + type hint, e.g. "Skins imdb tv series" or
	// "Chum 2026 imdb movie" — not the raw release filename.
	const typeHint = isLikelySeries ? 'tv series' : 'movie';
	const searchQuery = `${primaryQuery}${year ? ' ' + year : ''} imdb ${typeHint}`;
	const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
	const googleHtml = await fetchHtml(googleUrl);
	if (googleHtml) {
		const imdbLinkMatch = googleHtml.match(/href=["'](?:\/url\?q=)?(https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)[^"']*)["']/i);
		if (imdbLinkMatch) {
			return { imdbId: imdbLinkMatch[2], confidence: 'medium', matchedTitle: null, season, episode };
		}
	}

	// ── STEP 3: Bing Search scrape fallback ──
	const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(`${primaryQuery}${year ? ' ' + year : ''} imdb ${typeHint}`)}`;
	const bingHtml = await fetchHtml(bingUrl);
	if (bingHtml) {
		const bingMatch = bingHtml.match(/https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)/i);
		if (bingMatch) {
			return { imdbId: bingMatch[1], confidence: 'medium', matchedTitle: null, season, episode };
		}
	}

	// ── STEP 4: IMDb's own /find page ──
	const findUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(`${primaryQuery}${year ? ' ' + year : ''}`)}&s=all`;
	const findHtml = await fetchHtml(findUrl);
	if (findHtml) {
		const match = findHtml.match(/\/title\/(tt\d+)/);
		if (match) {
			return { imdbId: match[1], confidence: 'low', matchedTitle: null, season, episode };
		}
	}

	// Weak suggestion-API candidate is still better than nothing if every scrape failed
	if (best) {
		return { imdbId: best.imdbId, confidence: 'low', matchedTitle: best.title || null, season, episode };
	}

	logger.warn(`Could not resolve an IMDb ID for "${rawTitle}" (searched as "${primaryQuery}")`);
	return null;
}

/**
 * Best-effort scrape of a specific episode's details from IMDb's episode guide page.
 * IMDb's internal Next.js prop shape for this page isn't documented and changes
 * over time, so this tries a couple of plausible paths and returns null quietly if
 * none match rather than throwing — callers should treat episode-level data as
 * optional enrichment, not something to depend on for correctness.
 */
async function fetchEpisodeDetails(showImdbId, season, episode) {
	if (!showImdbId || !season) return null;

	const url = `https://www.imdb.com/title/${showImdbId}/episodes/?season=${encodeURIComponent(season)}`;
	const html = await fetchHtml(url);
	if (!html) return null;

	// JSON-LD is the more stable, documented source when present
	try {
		const ldMatches = html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
		for (const m of ldMatches) {
			const data = JSON.parse(m[1].trim());
			const items = Array.isArray(data) ? data : [data];
			for (const item of items) {
				const seasons = item?.containsSeason ? (Array.isArray(item.containsSeason) ? item.containsSeason : [item.containsSeason]) : [];
				for (const s of seasons) {
					const eps = s?.episode ? (Array.isArray(s.episode) ? s.episode : [s.episode]) : [];
					const match = episode ? eps.find((e) => String(e.episodeNumber) === String(episode)) : eps[0];
					if (match) {
						return {
							imdbId: null,
							title: match.name || null,
							plot: match.description || null,
							airDate: match.datePublished || null,
							rating: match.aggregateRating?.ratingValue ? parseFloat(match.aggregateRating.ratingValue) : null,
							season,
							episode,
						};
					}
				}
			}
		}
	} catch (e) {
		logger.debug(`Episode JSON-LD parse failed: ${e.message}`);
	}

	// Best-effort __NEXT_DATA__ fallback — field paths here are reverse-engineered
	// and may drift; guarded so a shape change just yields null instead of throwing.
	try {
		const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
		if (nextDataMatch) {
			const parsed = JSON.parse(nextDataMatch[1]);
			const pageProps = parsed?.props?.pageProps;
			const rawEpisodes =
				pageProps?.contentData?.section?.episodes?.items || pageProps?.mainColumnData?.episodes?.episodes?.edges?.map((e) => e.node) || [];
			const match = episode
				? rawEpisodes.find((ep) => String(ep.episode || ep.episodeNumber?.episodeNumber) === String(episode))
				: rawEpisodes[0];
			if (match) {
				const rd = match.releaseDate;
				return {
					imdbId: match.id || match.const || null,
					title: match.titleText?.text || match.title || null,
					plot: match.plot?.plotText?.plainText || match.plot || null,
					airDate: rd ? `${rd.year}-${String(rd.month).padStart(2, '0')}-${String(rd.day).padStart(2, '0')}` : null,
					rating: match.ratingsSummary?.aggregateRating || null,
					season,
					episode,
				};
			}
		}
	} catch (e) {
		logger.debug(`Episode __NEXT_DATA__ parse failed: ${e.message}`);
	}

	return null;
}

/**
 * Optional, more reliable season/episode source via TMDB's API (only used when the
 * caller supplies a TMDB API key — see OmdbService constructor). TMDB has explicit
 * `/tv/{id}/season/{n}/episode/{n}` endpoints, which is a much sturdier source for
 * this specific data than scraping IMDb's episode guide markup.
 */
async function fetchTmdbEpisodeDetails(apiKey, imdbId, season, episode) {
	if (!apiKey || !imdbId || !season) return null;
	try {
		const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
		const findRes = await fetch(findUrl);
		if (!findRes.ok) return null;
		const findData = await findRes.json();
		const tv = findData?.tv_results?.[0];
		if (!tv) return null;

		const epPath = episode ? `/episode/${encodeURIComponent(episode)}` : '';
		const epUrl = `https://api.themoviedb.org/3/tv/${tv.id}/season/${encodeURIComponent(season)}${epPath}?api_key=${apiKey}`;
		const epRes = await fetch(epUrl);
		if (!epRes.ok) return null;
		const epData = await epRes.json();

		return {
			imdbId: null,
			title: epData.name || null,
			plot: epData.overview || null,
			airDate: epData.air_date || null,
			rating: typeof epData.vote_average === 'number' ? epData.vote_average : null,
			episodeCount: Array.isArray(epData.episodes) ? epData.episodes.length : null,
			season,
			episode,
		};
	} catch (e) {
		logger.debug(`TMDB episode fetch failed: ${e.message}`);
		return null;
	}
}

/**
 * Scrapes complete metadata from IMDb using Suggestion API + JSON-LD + __NEXT_DATA__ + Meta Selectors + Fallback API
 *
 * @param {string} imdbUrl - The IMDb title URL
 * @param {string} imdbId - The IMDb title ID (e.g. tt0468569)
 * @param {string} [omdbApiKey] - OMDb API key for the fallback backfill step
 * @returns {Promise<object>} Full metadata object
 */
async function scrapeImdbDetails(imdbUrl, imdbId, omdbApiKey = 'trilogy') {
	logger.info(`Fetching full IMDb details for ${imdbId || imdbUrl}`);

	const details = {
		title: null,
		originalTitle: null,
		type: null,
		poster: null,
		trailerUrl: null,
		rating: null,
		ratingValue: null,
		ratingCount: null,
		runtime: null,
		genres: [],
		directors: [],
		writers: [],
		cast: [],
		languages: [],
		countries: [],
		releaseDate: null,
		releaseYear: null,
		plot: null,
		imdbId: imdbId || null,
		imdbUrl: imdbUrl || (imdbId ? `https://www.imdb.com/title/${imdbId}/` : null),
	};

	// ── STEP 1: Query IMDb Suggestion API for Title Metadata ──
	if (imdbId) {
		const apiData = await fetchImdbApiData(imdbId);
		if (apiData) {
			details.title = apiData.l || null;
			details.type = apiData.q || apiData.qid || null;
			details.releaseDate = apiData.y ? String(apiData.y) : null;
			if (apiData.y) details.releaseYear = Number(apiData.y);
			if (apiData.i && apiData.i.imageUrl) {
				details.poster = apiData.i.imageUrl;
			}
			if (apiData.s) {
				details.cast = apiData.s
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean);
			}
		}
	}

	// ── STEP 2: Query IMDb HTML Page for Extended Metadata ──
	const htmlData = await fetchHtml(imdbUrl);

	if (htmlData) {
		// 1. JSON-LD Scraping
		const ldMatches = htmlData.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
		for (const match of ldMatches) {
			try {
				const content = match[1]?.trim();
				if (!content) continue;
				const data = JSON.parse(content);
				const items = Array.isArray(data) ? data : [data];

				for (const item of items) {
					if (!item) continue;

					if (!details.title && item.name) details.title = item.name;
					if (!details.type && item['@type']) details.type = item['@type'];
					if (!details.poster && item.image) {
						details.poster = typeof item.image === 'string' ? item.image : item.image?.url || null;
					}
					if (!details.trailerUrl && item.trailer) {
						if (typeof item.trailer === 'string') details.trailerUrl = item.trailer;
						else if (item.trailer?.embedUrl) details.trailerUrl = item.trailer.embedUrl;
						else if (item.trailer?.contentUrl) details.trailerUrl = item.trailer.contentUrl;
						else if (item.trailer?.url) details.trailerUrl = item.trailer.url;
					}
					if (!details.plot && item.description) details.plot = item.description;
					if (!details.releaseDate && item.datePublished) details.releaseDate = item.datePublished;
					if (!details.releaseYear && item.datePublished) {
						const yMatch = String(item.datePublished).match(/\b(19|20)\d{2}\b/);
						if (yMatch) details.releaseYear = Number(yMatch[0]);
					}

					if (!details.genres.length && item.genre) {
						const gArr = Array.isArray(item.genre) ? item.genre : [item.genre];
						details.genres = gArr.filter(Boolean);
					}

					if (!details.runtime && item.duration) {
						details.runtime = parseISO8601Duration(item.duration);
					}

					if (!details.rating && item.aggregateRating) {
						const rVal = item.aggregateRating.ratingValue;
						const rCount = item.aggregateRating.ratingCount;
						if (rVal !== undefined && rVal !== null) {
							details.ratingValue = parseFloat(rVal);
							details.rating = `${rVal}/10`;
						}
						if (rCount !== undefined && rCount !== null) {
							details.ratingCount = parseInt(String(rCount).replace(/,/g, ''), 10);
						}
					}

					if (!details.directors.length && item.director) {
						const dirs = Array.isArray(item.director) ? item.director : [item.director];
						details.directors = dirs.map((d) => (typeof d === 'string' ? d : d.name)).filter(Boolean);
					}

					if (!details.writers.length && item.creator) {
						const creators = Array.isArray(item.creator) ? item.creator : [item.creator];
						details.writers = creators
							.filter((c) => typeof c === 'object' && (c['@type'] === 'Person' || !c['@type']))
							.map((c) => (typeof c === 'string' ? c : c.name))
							.filter(Boolean);
					}

					if (!details.cast.length && item.actor) {
						const actors = Array.isArray(item.actor) ? item.actor : [item.actor];
						details.cast = actors.map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean);
					}

					if (!details.languages.length && item.inLanguage) {
						const langs = Array.isArray(item.inLanguage) ? item.inLanguage : [item.inLanguage];
						details.languages = langs.map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
					}
				}
			} catch (e) {
				// Ignore JSON parse errors
			}
		}

		// 2. Next.js Page Data (__NEXT_DATA__)
		const nextDataMatch = htmlData.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
		if (nextDataMatch) {
			try {
				const parsedData = JSON.parse(nextDataMatch[1]);
				const pageProps = parsedData?.props?.pageProps;
				const above = pageProps?.aboveTheFoldData;
				const main = pageProps?.mainColumnData;

				// Inspect aboveTheFoldData
				if (above) {
					if (!details.title) details.title = above.titleText?.text || null;
					if (!details.originalTitle) {
						const orig = above.originalTitleText?.text;
						if (orig && orig !== details.title) details.originalTitle = orig;
					}
					if (!details.type) details.type = above.titleType?.text || above.titleType?.id || null;
					if (!details.poster) details.poster = above.primaryImage?.url || null;
					if (!details.plot) details.plot = above.plot?.plotText?.plainText || null;
					if (!details.releaseYear && above.releaseYear?.year) details.releaseYear = Number(above.releaseYear.year);

					if (!details.rating && above.ratingsSummary) {
						const r = above.ratingsSummary.aggregateRating;
						const c = above.ratingsSummary.voteCount;
						if (r) {
							details.ratingValue = parseFloat(r);
							details.rating = `${r}/10`;
						}
						if (c) details.ratingCount = parseInt(String(c).replace(/,/g, ''), 10);
					}

					if (!details.runtime && above.runtime?.seconds) {
						details.runtime = formatRuntime(above.runtime.seconds);
					}

					if (!details.genres.length && above.genres?.genres) {
						details.genres = above.genres.genres.map((g) => g.text).filter(Boolean);
					}
				}

				// Inspect mainColumnData
				if (main) {
					if (!details.title) details.title = main.titleText?.text || details.title;
					if (!details.type) details.type = main.titleType?.text || main.titleType?.id || details.type;
					if (!details.poster) details.poster = main.primaryImage?.url || details.poster;
					if (!details.plot) details.plot = main.plot?.plotText?.plainText || details.plot;

					if (!details.releaseDate) {
						if (main.releaseDate) {
							details.releaseDate = `${main.releaseDate.year}-${String(main.releaseDate.month).padStart(2, '0')}-${String(main.releaseDate.day).padStart(2, '0')}`;
						} else if (main.releaseYear?.year) {
							details.releaseDate = String(main.releaseYear.year);
						}
					}
					if (!details.releaseYear && main.releaseYear?.year) {
						details.releaseYear = Number(main.releaseYear.year);
					}

					if (!details.rating && main.ratingsSummary) {
						const r = main.ratingsSummary.aggregateRating;
						const c = main.ratingsSummary.voteCount;
						if (r) {
							details.ratingValue = parseFloat(r);
							details.rating = `${r}/10`;
						}
						if (c) details.ratingCount = parseInt(String(c).replace(/,/g, ''), 10);
					}

					if (!details.runtime && main.runtime?.seconds) {
						details.runtime = formatRuntime(main.runtime.seconds);
					}

					if (!details.genres.length && main.genres?.genres) {
						details.genres = main.genres.genres.map((g) => g.text).filter(Boolean);
					}

					if (!details.directors.length && main.directors) {
						const dirs = [];
						main.directors.forEach((dGroup) => {
							dGroup.credits?.forEach((c) => {
								if (c.name?.nameText?.text) dirs.push(c.name.nameText.text);
							});
						});
						if (dirs.length) details.directors = [...new Set(dirs)];
					}

					if (!details.writers.length && main.writers) {
						const wrs = [];
						main.writers.forEach((wGroup) => {
							wGroup.credits?.forEach((c) => {
								if (c.name?.nameText?.text) wrs.push(c.name.nameText.text);
							});
						});
						if (wrs.length) details.writers = [...new Set(wrs)];
					}

					if (!details.cast.length && main.cast?.edges?.length) {
						const castList = main.cast.edges.map((edge) => edge.node?.name?.nameText?.text).filter(Boolean);
						details.cast = [...new Set(castList)];
					}

					if (!details.languages.length && main.spokenLanguages?.spokenLanguages) {
						details.languages = main.spokenLanguages.spokenLanguages.map((l) => l.text).filter(Boolean);
					}

					if (!details.countries.length && main.countriesOfOrigin?.countries) {
						details.countries = main.countriesOfOrigin.countries.map((c) => c.text).filter(Boolean);
					}
				}

				if (!details.imdbId && pageProps?.tconst) {
					details.imdbId = pageProps.tconst;
					details.imdbUrl = `https://www.imdb.com/title/${pageProps.tconst}/`;
				}
			} catch (e) {
				// Next.js parse fallback
			}
		}

		// 3. Meta Selectors & Direct Video HTML Fallback
		if (!details.poster) {
			const ogImage = htmlData.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
			if (ogImage) details.poster = ogImage[1];
		}
		if (!details.plot) {
			const ogDesc =
				htmlData.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
				htmlData.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
			if (ogDesc) details.plot = ogDesc[1];
		}
		if (!details.languages.length) {
			const langMatches = htmlData.matchAll(/href=["'][^"']*primary_language=([^"']+)["'][^>]*>([^<]+)<\/a>/gi);
			for (const lm of langMatches) {
				const l = lm[2].trim();
				if (l && !details.languages.includes(l)) details.languages.push(l);
			}
		}
		if (!details.countries.length) {
			const countryMatches = htmlData.matchAll(/href=["'][^"']*country_of_origin=([^"']+)["'][^>]*>([^<]+)<\/a>/gi);
			for (const cm of countryMatches) {
				const c = cm[2].trim();
				if (c && !details.countries.includes(c)) details.countries.push(c);
			}
		}
		if (!details.trailerUrl) {
			const mp4Match = htmlData.match(/https?:\/\/imdb-video\.media-imdb\.com\/[^\s"']+\.mp4[^\s"']*/i);
			if (mp4Match) {
				details.trailerUrl = decodeHtmlEntities(mp4Match[0].replace(/&amp;/g, '&'));
			}
		}
	}

	// ── STEP 2.5: Resolve Direct MP4 Trailer URL if video ID or IMDb video page URL found ──
	if (details.trailerUrl && !details.trailerUrl.includes('.mp4')) {
		const viMatch = details.trailerUrl.match(/(vi\d+)/);
		if (viMatch) {
			const videoPageUrl = `https://www.imdb.com/video/${viMatch[1]}/`;
			logger.info(`Resolving direct MP4 trailer link from video page: ${videoPageUrl}`);
			const videoHtml = await fetchHtml(videoPageUrl);
			if (videoHtml) {
				const directMp4 = videoHtml.match(/https?:\/\/imdb-video\.media-imdb\.com\/[^\s"']+\.mp4[^\s"']*/i);
				if (directMp4) {
					details.trailerUrl = decodeHtmlEntities(directMp4[0].replace(/&amp;/g, '&'));
				}
			}
		}
	}

	// ── STEP 3: Fallback API for missing details (OMDb API) ──
	if (details.imdbId && (!details.rating || !details.runtime || !details.genres.length || !details.plot || !details.cast.length)) {
		try {
			const omdbUrl = `https://www.omdbapi.com/?i=${details.imdbId}&apikey=${encodeURIComponent(omdbApiKey)}`;
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 5000);
			const omdbRes = await fetch(omdbUrl, { signal: controller.signal });
			clearTimeout(timer);

			if (omdbRes.ok) {
				const omdb = await omdbRes.json();
				if (omdb && omdb.Response === 'True') {
					if (!details.title) details.title = omdb.Title;
					if (!details.type) details.type = omdb.Type;
					if (!details.poster && omdb.Poster && omdb.Poster !== 'N/A') details.poster = omdb.Poster;
					if (!details.rating && omdb.imdbRating && omdb.imdbRating !== 'N/A') {
						details.ratingValue = parseFloat(omdb.imdbRating);
						details.rating = `${omdb.imdbRating}/10`;
						if (omdb.imdbVotes && omdb.imdbVotes !== 'N/A') {
							details.ratingCount = parseInt(String(omdb.imdbVotes).replace(/,/g, ''), 10);
						}
					}
					if (!details.runtime && omdb.Runtime && omdb.Runtime !== 'N/A') details.runtime = omdb.Runtime;
					if (!details.genres.length && omdb.Genre && omdb.Genre !== 'N/A') {
						details.genres = omdb.Genre.split(',').map((g) => g.trim());
					}
					if (!details.directors.length && omdb.Director && omdb.Director !== 'N/A') {
						details.directors = omdb.Director.split(',').map((d) => d.trim());
					}
					if (!details.writers.length && omdb.Writer && omdb.Writer !== 'N/A') {
						details.writers = omdb.Writer.split(',').map((w) => w.trim());
					}
					if (!details.cast.length && omdb.Actors && omdb.Actors !== 'N/A') {
						details.cast = omdb.Actors.split(',').map((a) => a.trim());
					}
					if (!details.languages.length && omdb.Language && omdb.Language !== 'N/A') {
						details.languages = omdb.Language.split(',').map((l) => l.trim());
					}
					if (!details.countries.length && omdb.Country && omdb.Country !== 'N/A') {
						details.countries = omdb.Country.split(',').map((c) => c.trim());
					}
					if (!details.releaseDate && omdb.Released && omdb.Released !== 'N/A') details.releaseDate = omdb.Released;
					if (!details.releaseYear && omdb.Year && omdb.Year !== 'N/A') {
						const yMatch = String(omdb.Year).match(/\b(19|20)\d{2}\b/);
						if (yMatch) details.releaseYear = Number(yMatch[0]);
					}
					if (!details.plot && omdb.Plot && omdb.Plot !== 'N/A') details.plot = omdb.Plot;
				}
			}
		} catch (omdbErr) {
			// Fallback API failure ignored
		}
	}

	return details;
}

// ─────────────────────────────────────────────────────────────

export class OmdbService {
	/**
	 * @param {import('./cacheService.js').CacheService} [cacheService]
	 * @param {object} [options]
	 * @param {string} [options.omdbApiKey] - Your own OMDb API key (recommended — the
	 *   default 'trilogy' key is a shared public demo key and will get rate-limited
	 *   under any real traffic). Get a free key at https://www.omdbapi.com/apikey.aspx
	 * @param {string} [options.tmdbApiKey] - Optional TMDB API key. When set, it's used
	 *   as a more reliable structured source for season/episode data than scraping
	 *   IMDb's episode guide. Get a free key at https://www.themoviedb.org/settings/api
	 * @param {number} [options.cacheTtlSeconds] - Cache TTL in seconds (default 24h)
	 */
	constructor(cacheService = null, options = {}) {
		this.cacheService = cacheService;
		this.omdbApiKey = options.omdbApiKey || 'trilogy';
		this.tmdbApiKey = options.tmdbApiKey || null;
		this.cacheTtlSeconds = options.cacheTtlSeconds || DEFAULT_CACHE_TTL_SECONDS;
	}

	/**
	 * Main entrypoint to fetch metadata for a movie, show, or a specific episode.
	 *
	 * @param {string} rawTitle - Movie/show title, filename-style query (season/episode
	 *   and scene-release tags are parsed out automatically), IMDb ID (tt1234567), or
	 *   IMDb URL.
	 * @param {number|string} [year] - Optional known release year, used to disambiguate
	 *   candidates when the title alone is ambiguous.
	 * @param {object} [opts]
	 * @param {number|string} [opts.season] - Overrides any season parsed from rawTitle.
	 * @param {number|string} [opts.episode] - Overrides any episode parsed from rawTitle.
	 * @returns {Promise<object|null>} Standardized metadata object, or null if nothing
	 *   could be resolved. Includes `matchConfidence` ('high'|'medium'|'low') — this is
	 *   NOT a guarantee, just a signal for how confident the resolver is in the match,
	 *   since no free scraping pipeline can promise perfect accuracy.
	 */
	async fetchMovieMetadata(rawTitle, year = null, opts = {}) {
		if (!rawTitle) return null;

		const directImdbId = extractImdbId(rawTitle);
		const explicitSeason = opts.season != null ? String(opts.season) : null;
		const explicitEpisode = opts.episode != null ? String(opts.episode) : null;

		const cacheKey = `imdb_meta:${(directImdbId || rawTitle).toLowerCase().trim()}:${year || 'any'}:${explicitSeason || 's?'}:${explicitEpisode || 'e?'}`;

		if (this.cacheService) {
			const cached = await this.cacheService.getJson(cacheKey);
			if (cached) {
				logger.debug('Cache hit for metadata', { rawTitle, year });
				return cached;
			}
		}

		let resolved;
		if (directImdbId) {
			resolved = { imdbId: directImdbId, confidence: 'high', matchedTitle: null, season: explicitSeason, episode: explicitEpisode };
		} else {
			resolved = await resolveImdbId(rawTitle);
		}

		if (!resolved || !resolved.imdbId) {
			logger.warn(`No IMDb metadata found for "${rawTitle}"`);
			return null;
		}

		const season = explicitSeason || resolved.season;
		const episode = explicitEpisode || resolved.episode;

		const imdbUrl = `https://www.imdb.com/title/${resolved.imdbId}/`;
		const details = await scrapeImdbDetails(imdbUrl, resolved.imdbId, this.omdbApiKey);

		if (!details || (!details.title && !details.imdbId)) {
			logger.warn(`No IMDb metadata found for "${rawTitle}"`);
			return null;
		}

		const isSeries = details.type && (details.type.toLowerCase().includes('series') || details.type.toLowerCase().includes('tv'));

		// Episode-level enrichment — best-effort, only attempted for series with a season
		let episodeInfo = null;
		if (season && isSeries) {
			if (this.tmdbApiKey) {
				episodeInfo = await fetchTmdbEpisodeDetails(this.tmdbApiKey, resolved.imdbId, season, episode);
			}
			if (!episodeInfo) {
				episodeInfo = await fetchEpisodeDetails(resolved.imdbId, season, episode);
			}
		}

		// Normalize to application's internal metadata object contract
		const normalizedMeta = {
			title: safeDecode(details.title || rawTitle),
			year: details.releaseYear ? Number(details.releaseYear) : year ? Number(year) : null,
			type: isSeries ? 'series' : 'movie',
			description: safeDecode(details.plot),
			genre: safeDecode(Array.isArray(details.genres) ? details.genres.join(', ') : details.genres),
			language: safeDecode(Array.isArray(details.languages) ? details.languages.join(', ') : details.languages),
			countries: safeDecode(Array.isArray(details.countries) ? details.countries.join(', ') : details.countries),
			directors: safeDecode(Array.isArray(details.directors) ? details.directors.join(', ') : details.directors),
			writers: safeDecode(Array.isArray(details.writers) ? details.writers.join(', ') : details.writers),
			cast: safeDecode(Array.isArray(details.cast) ? details.cast.join(', ') : details.cast),
			imdbRating: details.ratingValue || (details.rating ? parseFloat(details.rating) : null),
			ratingCount: details.ratingCount || null,
			duration: safeDecode(details.runtime),
			imdbId: clean(details.imdbId),
			posterUrl: clean(details.poster),
			trailerUrl: clean(details.trailerUrl),
			imdbUrl: details.imdbUrl || (details.imdbId ? `https://www.imdb.com/title/${details.imdbId}/` : null),
			matchConfidence: resolved.confidence || 'unknown',
		};

		if (season) normalizedMeta.seasonNum = Number(season);
		if (episode) normalizedMeta.episodeNum = Number(episode);
		if (episodeInfo) {
			normalizedMeta.episodeTitle = safeDecode(episodeInfo.title);
			normalizedMeta.episodeDescription = safeDecode(episodeInfo.plot);
			normalizedMeta.episodeAirDate = clean(episodeInfo.airDate);
			if (episodeInfo.imdbId) normalizedMeta.episodeImdbId = clean(episodeInfo.imdbId);
			if (typeof episodeInfo.rating === 'number') normalizedMeta.episodeRating = episodeInfo.rating;
		}

		if (this.cacheService) {
			await this._saveCache(cacheKey, normalizedMeta);
		}

		return normalizedMeta;
	}

	async _saveCache(key, data, ttl = this.cacheTtlSeconds) {
		if (this.cacheService) {
			await this.cacheService.setJson(key, data, ttl);
		}
	}
}
