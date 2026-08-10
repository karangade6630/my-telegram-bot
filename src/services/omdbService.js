/**
 * @fileoverview OmdbService — Metadata fetcher for movies/series.
 * Multi-stage pipeline: OMDB API + IMDb Suggestions + IMDb Search Scrape + JSON-LD Schema.
 * Uses KV/D1 caching to minimize external calls.
 *
 * @module services/omdbService
 */

import { decodeHtmlEntities, generateTitleVariants } from '../utils/stringUtils.js';
import { OMDB_BASE_URL, IMDB_SUGGEST, KV_TTL } from '../config/constants.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('OmdbService');

export class OmdbService {
  /**
   * @param {string} apiKey
   * @param {import('./cacheService.js').CacheService} [cacheService]
   */
  constructor(apiKey, cacheService = null) {
    this.apiKey = apiKey;
    this.cacheService = cacheService;
  }

  /**
   * Main entry point: fetch movie/series metadata with multi-stage fallback pipeline.
   *
   * @param {string} rawTitle
   * @param {number|string} [year]
   * @returns {Promise<object|null>}
   */
  /**
   * Main entry point: fetch movie/series metadata with multi-stage fallback pipeline.
   *
   * @param {string} rawTitle
   * @param {number|string} [year]
   * @returns {Promise<object|null>}
   */
  async fetchMovieMetadata(rawTitle, year = null) {
    if (!rawTitle) return null;

    // Check if rawTitle is an IMDb ID (e.g. tt1234567)
    if (/^tt\d+$/i.test(rawTitle.trim())) {
      const imdbId = rawTitle.trim();
      const meta = await this._fetchFromOMDBById(imdbId);
      if (meta) return meta;
    }

    // Clean title: remove S01/S02/Season 2/Ep markers
    const title = OmdbService._cleanTitleForMetadata(rawTitle);
    const cacheKey = `imdb_meta:${title.toLowerCase().trim()}:${year || 'any'}`;

    if (this.cacheService) {
      const cached = await this.cacheService.getJson(cacheKey);
      if (cached) {
        logger.debug('Cache hit for metadata', { title, year });
        return cached;
      }
    }

    logger.info(`Fetching metadata for "${title}" (${year || 'any year'})`);

    // Stage 1: OMDB with clean title
    let metadata = await this._tryOMDB(title, year);
    if (metadata) {
      await this._saveCache(cacheKey, metadata);
      return metadata;
    }

    // Stage 2: OMDB Search List (s=) candidate lookup
    const searchListMeta = await this._searchOMDBSearchList(title, year);
    if (searchListMeta) {
      await this._saveCache(cacheKey, searchListMeta);
      return searchListMeta;
    }

    // Stage 3: OMDB with title variations
    const variations = generateTitleVariants(title);
    for (const variant of variations) {
      if (variant.toLowerCase() === title.toLowerCase()) continue;
      metadata = await this._tryOMDB(variant, year);
      if (metadata) {
        await this._saveCache(cacheKey, metadata);
        return metadata;
      }
    }

    // Stage 4: IMDb Suggestion + Direct Search + Chunk Search + JSON-LD Scrape
    const imdbResult = await this._searchViaIMDbPipeline(title, year);
    if (imdbResult) {
      if (imdbResult.imdbId) {
        const canonicalOMDB = await this._fetchFromOMDBById(imdbResult.imdbId);
        if (canonicalOMDB) {
          await this._saveCache(cacheKey, canonicalOMDB);
          return canonicalOMDB;
        }
      }
      await this._saveCache(cacheKey, imdbResult);
      return imdbResult;
    }

    logger.warn(`No metadata found across all stages for "${title}"`);
    return null;
  }

  // ─── OMDB HELPERS ──────────────────────────────────────────

  async _fetchFromOMDB(title, year) {
    if (!this.apiKey) return null;

    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('t', title);
    if (year) url.searchParams.set('y', String(year));

    try {
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      const data = await res.json();

      if (data.Response === 'True') {
        return {
          title:         decodeHtmlEntities(data.Title),
          year:          parseInt(data.Year) || year,
          description:   decodeHtmlEntities(data.Plot),
          genre:         data.Genre          !== 'N/A' ? data.Genre          : null,
          language:      data.Language       !== 'N/A' ? data.Language       : null,
          imdbRating:    data.imdbRating      !== 'N/A' ? parseFloat(data.imdbRating) : null,
          ratingCount:   data.imdbVotes       !== 'N/A' ? data.imdbVotes       : null,
          contentRating: data.Rated           !== 'N/A' ? data.Rated           : null,
          duration:      data.Runtime         !== 'N/A' ? data.Runtime         : null,
          cast:          data.Actors          !== 'N/A' ? data.Actors          : null,
          directors:     data.Director        !== 'N/A' ? data.Director        : null,
          type:          data.Type,
          imdbId:        data.imdbID,
          imdbUrl:       `https://www.imdb.com/title/${data.imdbID}/`,
        };
      }
      return null;
    } catch (err) {
      logger.error('OMDB fetch error', { error: err.message });
      return null;
    }
  }

  async _fetchFromOMDBById(imdbId) {
    if (!this.apiKey || !imdbId) return null;
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('i', imdbId);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      const data = await res.json();
      if (data.Response === 'True') {
        return {
          title:         decodeHtmlEntities(data.Title),
          year:          parseInt(data.Year) || null,
          description:   decodeHtmlEntities(data.Plot),
          genre:         data.Genre !== 'N/A' ? data.Genre : null,
          language:      data.Language !== 'N/A' ? data.Language : null,
          imdbRating:    data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
          ratingCount:   data.imdbVotes !== 'N/A' ? data.imdbVotes : null,
          contentRating: data.Rated !== 'N/A' ? data.Rated : null,
          duration:      data.Runtime !== 'N/A' ? data.Runtime : null,
          cast:          data.Actors !== 'N/A' ? data.Actors : null,
          directors:     data.Director !== 'N/A' ? data.Director : null,
          type:          data.Type,
          imdbId:        data.imdbID,
          imdbUrl:       `https://www.imdb.com/title/${data.imdbID}/`,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async _searchOMDBSearchList(title, year = null) {
    if (!this.apiKey) return null;
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('s', title);
    if (year) url.searchParams.set('y', String(year));

    try {
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      const data = await res.json();

      if (data.Response === 'True' && Array.isArray(data.Search) && data.Search.length > 0) {
        const top = data.Search[0];
        if (top.imdbID) {
          return await this._fetchFromOMDBById(top.imdbID);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async _tryOMDB(title, year) {
    if (year) {
      const res = await this._fetchFromOMDB(title, year);
      if (res) return res;
    }
    return await this._fetchFromOMDB(title, null);
  }

  // ─── IMDB MULTI-STAGE PIPELINE ─────────────────────────────

  async _searchViaIMDbPipeline(title, year) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    let imdbId = null;
    let finalTitle = title;
    let finalYear = year || null;

    // Step A: IMDb Suggestion API
    let sanitized = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const firstChar = sanitized.charAt(0) || 'm';
    const suggestUrl = `${IMDB_SUGGEST}/${firstChar}/${encodeURIComponent(sanitized)}.json`;

    try {
      const res = await fetch(suggestUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        const suggestions = data?.d ?? [];
        const valid = suggestions.filter(item => item.id && item.id.startsWith('tt'));

        if (valid.length > 0) {
          let matched = null;
          if (year) {
            const targetYr = parseInt(year);
            matched = valid.find(item => item.y && Math.abs(parseInt(item.y) - targetYr) <= 1);
          }
          if (!matched) matched = valid[0];

          imdbId  = matched.id;
          finalTitle = matched.l || finalTitle;
          finalYear  = matched.y ? String(matched.y) : finalYear;
        }
      }
    } catch (err) {
      logger.warn('IMDb suggestion search error', { error: err.message });
    }

    // Step B: Direct IMDb Find Scrape if suggestion missed
    if (!imdbId) {
      try {
        const searchUrl = `https://www.imdb.com/find?q=${encodeURIComponent(title + (year ? ' ' + year : ''))}`;
        const res = await fetch(searchUrl, { headers });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/\/title\/(tt\d+)/);
          if (match) imdbId = match[1];
        }
      } catch (err) {
        logger.warn('IMDb direct search scrape failed', { error: err.message });
      }
    }

    // Step C: Chunk-Search Fallback (first 2-3 words)
    if (!imdbId) {
      const words = title.trim().split(/\s+/);
      if (words.length > 1) {
        const chunkTitle = words.slice(0, Math.min(3, words.length - 1)).join(' ');
        const chunkSanitized = chunkTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
        const chunkChar = chunkSanitized.charAt(0) || 'm';

        try {
          const chunkUrl = `${IMDB_SUGGEST}/${chunkChar}/${encodeURIComponent(chunkSanitized)}.json`;
          const res = await fetch(chunkUrl, { headers });
          if (res.ok) {
            const data = await res.json();
            const suggestions = data?.d ?? [];
            const valid = suggestions.filter(item => item.id && item.id.startsWith('tt'));
            if (valid.length > 0) {
              imdbId     = valid[0].id;
              finalTitle = valid[0].l || finalTitle;
              finalYear  = valid[0].y ? String(valid[0].y) : finalYear;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (!imdbId) return null;

    // Step D: Scrape JSON-LD Schema from IMDb Detail Page
    let imdbRating  = null;
    let genre       = null;
    let description = null;
    let cast        = null;
    let directors   = null;
    let duration    = null;
    let contentRating = null;

    try {
      const detailUrl = `https://www.imdb.com/title/${imdbId}/`;
      const res = await fetch(detailUrl, { headers });
      if (res.ok) {
        const html = await res.text();
        const schemaMatch = html.match(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/i);
        if (schemaMatch) {
          const schema = JSON.parse(schemaMatch[1].trim());
          if (schema.aggregateRating?.ratingValue) {
            imdbRating = parseFloat(schema.aggregateRating.ratingValue);
          }
          if (schema.genre) {
            genre = Array.isArray(schema.genre) ? schema.genre.join(', ') : schema.genre;
          }
          if (schema.description) {
            description = decodeHtmlEntities(schema.description);
          }
          if (schema.actor) {
            cast = Array.isArray(schema.actor)
              ? schema.actor.map(a => a.name).join(', ')
              : schema.actor.name;
          }
          if (schema.director) {
            directors = Array.isArray(schema.director)
              ? schema.director.map(d => d.name).join(', ')
              : schema.director.name;
          }
          if (schema.duration) {
            // ISO 8601 duration e.g. "PT2H4M" → "124 min"
            const durMatch = schema.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
            if (durMatch) {
              const h = parseInt(durMatch[1] || '0');
              const m = parseInt(durMatch[2] || '0');
              duration = h > 0 ? `${h}h ${m}m` : `${m} min`;
            }
          }
          if (schema.contentRating) contentRating = schema.contentRating;
        }
      }
    } catch {
      // quiet fallback
    }

    return {
      title:         decodeHtmlEntities(finalTitle),
      year:          parseInt(finalYear) || year,
      description:   description || null,
      genre:         genre       || null,
      imdbRating,
      ratingCount:   null,
      contentRating: contentRating || null,
      duration:      duration || null,
      cast,
      directors,
      type:          'movie',
      imdbId,
      imdbUrl:       `https://www.imdb.com/title/${imdbId}/`,
    };
  }

  /**
   * Strip S01/S02/Season 2/Ep markers from movie title so series metadata matches correctly.
   */
  static _cleanTitleForMetadata(title) {
    if (!title) return '';
    return title
      .replace(/\b[Ss]\d{1,2}\b|\b[Ee]\d{1,3}\b|\b[Ss]\d{1,2}[Ee]\d{1,3}\b/g, '')
      .replace(/\bseason\s*\d+\b|\bepisode\s*\d+\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async _saveCache(key, data) {
    if (this.cacheService) {
      await this.cacheService.setJson(key, data, KV_TTL.IMDB_META);
    }
  }
}
