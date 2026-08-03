/**
 * @fileoverview SearchService — High level orchestration of search engine strategies.
 *
 * @module services/searchService
 */

import { ExactSearch } from '../search/ExactSearch.js';
import { FuzzySearch } from '../search/FuzzySearch.js';
import { RegexSearch } from '../search/RegexSearch.js';
import { Ranking } from '../search/Ranking.js';
import { SearchResponse } from '../dto/SearchResponse.js';
import { Movie } from '../models/Movie.js';

export class SearchService {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {import('./cacheService.js').CacheService} [cacheService]
   */
  constructor(movieRepo, cacheService = null) {
    this.movieRepo = movieRepo;
    this.cacheService = cacheService;
    this.exactSearch = new ExactSearch(movieRepo);
    this.fuzzySearch = new FuzzySearch(movieRepo);
    this.regexSearch = new RegexSearch(movieRepo);
  }

  /**
   * Execute multi-stage search with caching and ranking.
   *
   * @param {string} query
   * @param {object} [opts]
   * @returns {Promise<SearchResponse>}
   */
  async search(query, opts = {}) {
    const startTime = Date.now();
    const cleanQuery = query.trim();
    if (!cleanQuery) return SearchResponse.empty(query);

    const cacheKey = `search:${cleanQuery.toLowerCase()}:${opts.page || 1}`;
    if (this.cacheService) {
      const cached = await this.cacheService.getJson(cacheKey);
      if (cached) {
        return SearchResponse.from({
          ...cached,
          movies: Movie.fromRows(cached.movies),
          durationMs: Date.now() - startTime
        });
      }
    }

    let result = await this.exactSearch.searchExact(cleanQuery, opts);
    if (!result.total) {
      result = await this.exactSearch.searchContains(cleanQuery, opts);
    }
    if (!result.total) {
      result = await this.exactSearch.searchTokenized(cleanQuery, opts);
    }
    if (!result.total) {
      result = await this.fuzzySearch.search(cleanQuery, opts);
    }

    const rankedRows = Ranking.rank(result.movies, cleanQuery);
    const movieModels = Movie.fromRows(rankedRows);

    const response = new SearchResponse({
      query: cleanQuery,
      movies: movieModels,
      total: result.total,
      page: opts.page || 1,
      perPage: opts.limit || 10,
      strategy: result.strategy,
      durationMs: Date.now() - startTime
    });

    if (this.cacheService && response.hasResults) {
      await this.cacheService.setJson(cacheKey, response.toJSON(), 300);
    }

    return response;
  }
}
