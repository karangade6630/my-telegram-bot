// src/services/omdbService.js
/**
 * @fileoverview MovieMetadataService — Pure IMDb scraper engine with fallback API support.
 * Combines Google Search resolution, IMDb Suggestion API (v3.sg.media-imdb.com),
 * JSON-LD schema parsing, Next.js __NEXT_DATA__ parsing (aboveTheFoldData + mainColumnData),
 * HTML Meta Selectors, and public fallback metadata retrieval.
 *
 * 100% free — No API keys required.
 * Compatible with Cloudflare Workers (uses native fetch).
 */

import { decodeHtmlEntities } from '../utils/stringUtils.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MovieMetadataService');

// Realistic browser headers to bypass IMDb's bot response
const HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9',
};

// Bot headers - IMDb serves pre-rendered HTML with full JSON-LD / __NEXT_DATA__ to search engine bots
const BOT_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9',
};

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

/**
 * Cleans scene release tags (720p, WEB-DL, DSNP, HDRip, AAC5.1, x264, ESub, etc.)
 * from search queries to extract the actual movie/show title.
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

	// Remove video resolution tags
	cleaned = cleaned.replace(/\b(720p|1080p|2160p|4k|uhd|480p|576p|360p)\b/gi, '');

	// Remove release source & type tags
	cleaned = cleaned.replace(
		/\b(web[- ]?dl|webrip|webdl|dsnp|amzn|nf|hmax|atvp|pcok|hdtv|hdrip|bluray|blu[- ]?ray|brrip|dvdrip|remux|hdts|hdcam|web|proper|repack|internal)\b/gi,
		'',
	);

	// Remove audio & video codec tags
	cleaned = cleaned.replace(
		/\b(x264|x265|h\.?264|h\.?265|hevc|avc|aac\d*[\s.]?\d*|ac3|dd[\s.]?\d[\s.]?\d|ddp?\d*[\s.]?\d*|dts|flac|xvid|10bit|8bit|hdr|sdr|atmos)\b/gi,
		'',
	);

	// Remove subtitle, language & misc scene tags
	cleaned = cleaned.replace(/\b(esubs?|subs?|dual|multi|hindi|english|korean|telugu|tamil|bengali|dubbed|esu|kor|eng|jpn|hin)\b/gi, '');

	// Extract year if present
	const yearMatch = cleaned.match(/\b((?:19|20)\d{2})\b/);

	// Clean extra symbols and whitespace
	cleaned = cleaned.replace(/[-._#()[\]{}]/g, ' ');
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
 * Native fetch helper with timeout & BOT_HEADERS / HEADERS fallback
 */
async function fetchHtml(url, customHeaders = null) {
	const headers = customHeaders || BOT_HEADERS;
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		const res = await fetch(url, { headers, signal: controller.signal });
		clearTimeout(timer);
		if (res.ok) {
			return await res.text();
		}
	} catch (e) {
		logger.debug(`fetchHtml bot headers failed for ${url}: ${e.message}`);
	}

	// Fallback to standard browser headers
	if (headers !== HEADERS) {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 8000);
			const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
			clearTimeout(timer);
			if (res.ok) {
				return await res.text();
			}
		} catch (e) {
			logger.warn(`fetchHtml browser headers failed for ${url}: ${e.message}`);
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
		const res = await fetch(suggestionUrl, { headers: HEADERS, signal: controller.signal });
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
 * Scrapes complete metadata from IMDb using Suggestion API + JSON-LD + __NEXT_DATA__ + Meta Selectors + Fallback API
 *
 * @param {string} imdbUrl - The IMDb title URL
 * @param {string} imdbId - The IMDb title ID (e.g. tt0468569)
 * @returns {Promise<object>} Full metadata object
 */
async function scrapeImdbDetails(imdbUrl, imdbId) {
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

	// ── STEP 3: Fallback API for missing details (OMDb API trilogy public key fallback) ──
	if (details.imdbId && (!details.rating || !details.runtime || !details.genres.length || !details.plot || !details.cast.length)) {
		try {
			const omdbUrl = `https://www.omdbapi.com/?i=${details.imdbId}&apikey=trilogy`;
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

/**
 * Searches Google for exact title, resolves IMDb URL, and scrapes full details.
 *
 * @param {string} searchQuery - Search query string
 * @returns {Promise<object|null>}
 */
async function searchGoogleAndScrapeImdb(searchQuery) {
	if (!searchQuery) return null;

	logger.info(`Searching Google & IMDb for: "${searchQuery}"`);

	const { cleaned: cleanedQuery, season: parsedSeason } = cleanQuery(searchQuery);
	const targetQuery = cleanedQuery || searchQuery;

	// STEP 1: Search Google for exact title & direct IMDb link
	const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(targetQuery + ' imdb movie tv series')}`;
	const googleHtml = await fetchHtml(googleUrl);

	let exactTitle = null;
	let googleImdbId = null;
	let googleImdbUrl = null;

	if (googleHtml) {
		// Extract spell-corrected text
		const spellMatch =
			googleHtml.match(/id=["']fprsl["'][^>]*>(.*?)<\/a>/i) ||
			googleHtml.match(/class=["']fprs["'][^>]*>(.*?)<\/a>/i) ||
			googleHtml.match(/href=["'][^"']*spell=1[^"']*["'][^>]*>(.*?)<\/a>/i);

		if (spellMatch) {
			exactTitle = spellMatch[1].replace(/<[^>]+>/g, '').trim();
		}

		// Extract direct IMDb link from Google results
		const imdbLinkMatch = googleHtml.match(/href=["'](?:\/url\?q=)?(https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)[^"']*)["']/i);
		if (imdbLinkMatch) {
			googleImdbId = imdbLinkMatch[2];
			googleImdbUrl = `https://www.imdb.com/title/${googleImdbId}/`;
		}

		// Extract title from Google h3 heading if missing
		if (!exactTitle) {
			const h3Match = googleHtml.match(/<h3[^>]*>(.*?)<\/h3>/i);
			if (h3Match) {
				const text = h3Match[1].replace(/<[^>]+>/g, '').trim();
				if (text && !text.toLowerCase().includes('people also ask')) {
					exactTitle = text
						.replace(/\s*[-|:]\s*IMDb.*$/i, '')
						.replace(/\s*[-|:]\s*Wikipedia.*$/i, '')
						.replace(/\s*\(\d{4}\)\s*$/, '')
						.trim();
				}
			}
		}
	}

	const canonicalTitle = exactTitle || targetQuery;
	const seasonMatch = canonicalTitle.match(/\b(?:season|s)\s*(\d+)\b/i);
	const seasonNum = parsedSeason || (seasonMatch ? seasonMatch[1] : null);

	let targetImdbUrl = googleImdbUrl;
	let imdbId = googleImdbId;

	// STEP 2: If Google didn't return a direct IMDb link, query IMDb Suggestion API
	if (!targetImdbUrl) {
		const cleanShowQuery = canonicalTitle.replace(/\b(?:season|s)\s*\d+\b/gi, '').trim();
		const formattedQuery = cleanShowQuery
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '_')
			.replace(/_+/g, '_');
		const suggestionUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(formattedQuery)}.json`;

		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 5000);
			const suggestionRes = await fetch(suggestionUrl, { headers: HEADERS, signal: controller.signal });
			clearTimeout(timer);

			if (suggestionRes.ok) {
				const data = await suggestionRes.json();
				if (data && data.d && data.d.length > 0) {
					const titles = data.d.filter((item) => item.id && item.id.startsWith('tt'));
					const firstResult =
						titles.find((item) => item.q && (item.q.toLowerCase().includes('tv series') || item.q.toLowerCase() === 'feature')) ||
						titles[0] ||
						data.d[0];

					if (firstResult && firstResult.id) {
						imdbId = firstResult.id;
						targetImdbUrl = `https://www.imdb.com/title/${imdbId}/`;
					}
				}
			}
		} catch (apiErr) {
			// Suggestion API fallback
		}
	}

	// STEP 3: Fallback: IMDb Search Page
	if (!targetImdbUrl) {
		const findUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(canonicalTitle)}&s=all`;
		const findHtml = await fetchHtml(findUrl);
		if (findHtml) {
			const match = findHtml.match(/\/title\/(tt\d+)/);
			if (match) {
				imdbId = match[1];
				targetImdbUrl = `https://www.imdb.com/title/${imdbId}/`;
			}
		}
	}

	if (!targetImdbUrl && !imdbId) {
		logger.warn(`Could not resolve IMDb page for "${canonicalTitle}".`);
		return null;
	}

	// STEP 4: Scrape Details
	const details = await scrapeImdbDetails(targetImdbUrl, imdbId);
	if (seasonNum && details) {
		details.seasonNum = seasonNum;
	}

	return details;
}

// ─────────────────────────────────────────────────────────────

export class OmdbService {
	/**
	 * @param {import('./cacheService.js').CacheService} [cacheService]
	 */
	constructor(cacheService = null) {
		this.cacheService = cacheService;
	}

	/**
	 * Main entrypoint to fetch metadata from IMDb using Google Search + Suggestion API + Page Scraping.
	 *
	 * @param {string} rawTitle - Movie title, IMDb ID (tt1234567), or IMDb URL
	 * @param {number|string} [year]
	 * @returns {Promise<object|null>} Standardized metadata object
	 */
	async fetchMovieMetadata(rawTitle, year = null) {
		if (!rawTitle) return null;

		const directImdbId = extractImdbId(rawTitle);
		const cacheKey = `imdb_meta:${(directImdbId || rawTitle).toLowerCase().trim()}:${year || 'any'}`;

		if (this.cacheService) {
			const cached = await this.cacheService.getJson(cacheKey);
			if (cached) {
				logger.debug('Cache hit for metadata', { rawTitle, year });
				return cached;
			}
		}

		let details = null;

		if (directImdbId) {
			const imdbUrl = `https://www.imdb.com/title/${directImdbId}/`;
			details = await scrapeImdbDetails(imdbUrl, directImdbId);
		} else {
			details = await searchGoogleAndScrapeImdb(rawTitle);
		}

		if (!details || (!details.title && !details.imdbId)) {
			logger.warn(`No IMDb metadata found for "${rawTitle}"`);
			return null;
		}

		// Normalize to application's internal metadata object contract
		const isSeries = details.type && (details.type.toLowerCase().includes('series') || details.type.toLowerCase().includes('tv'));

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
		};

		if (this.cacheService) {
			await this._saveCache(cacheKey, normalizedMeta);
		}

		return normalizedMeta;
	}

	async _saveCache(key, data, ttl = KV_TTL.IMDB_META) {
		if (this.cacheService) {
			await this.cacheService.setJson(key, data, ttl);
		}
	}
}
