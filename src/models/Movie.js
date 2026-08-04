/**
 * @fileoverview Movie domain model.
 * Encapsulates a movies row from D1, with validation, mapping,
 * and serialization helpers.
 *
 * @module models/Movie
 */

import { CONTENT_TYPES } from '../config/constants.js';
import { slugify } from '../utils/stringUtils.js';

export class Movie {
  /**
   * @param {object} data - Raw row from D1 movies table.
   */
  constructor(data = {}) {
    this.id             = data.id             ?? null;
    this.slug           = data.slug           ?? '';
    this.title          = data.title          ?? '';
    this.originalTitle  = data.original_title ?? null;
    this.year           = data.year           ? Number(data.year) : null;
    this.type           = data.type           ?? CONTENT_TYPES.MOVIE;
    this.language       = data.language       ?? null;
    this.genre          = data.genre          ?? null;
    this.description    = data.description    ?? null;
    this.director       = data.director       ?? null;
    this.cast           = data.cast           ?? null;
    this.country        = data.country        ?? null;
    this.runtime        = data.runtime        ?? null;
    this.contentRating  = data.content_rating ?? null;
    this.imdbId         = data.imdb_id        ?? null;
    this.imdbRating     = data.imdb_rating    ? Number(data.imdb_rating) : null;
    this.imdbVotes      = data.imdb_votes     ?? null;
    this.trailerUrl     = data.trailer_url    ?? null;
    this.posterUrl      = data.poster_url     ?? null;
    this.popularityScore= data.popularity_score ? Number(data.popularity_score) : 0;
    this.searchCount    = data.search_count   ? Number(data.search_count) : 0;
    this.createdAt      = data.created_at     ?? null;
    this.updatedAt      = data.updated_at     ?? null;

    // Eager-loaded from JOIN queries
    this.files          = data.files          ?? [];
  }

  // ─── Computed Properties ──────────────────────────────────

  /** IMDb URL built from imdb_id. */
  get imdbUrl() {
    return this.imdbId ? `https://www.imdb.com/title/${this.imdbId}/` : null;
  }

  /** Formatted rating string e.g. "⭐ 8.4/10". */
  get ratingDisplay() {
    return this.imdbRating ? `⭐ ${this.imdbRating}/10` : null;
  }

  /** Genre list as an array. */
  get genreList() {
    return this.genre ? this.genre.split(',').map(g => g.trim()) : [];
  }

  /** Cast list as an array. */
  get castList() {
    return this.cast ? this.cast.split(',').map(c => c.trim()) : [];
  }

  // ─── Factory Methods ──────────────────────────────────────

  /**
   * Build a Movie from parsed file metadata.
   * Used by MovieIndexService when creating a new movie record.
   *
   * @param {object} parsed - Output from FilenameParser / OmdbService.
   * @returns {Movie}
   */
  static fromParsed(parsed) {
    const title = parsed.movieTitle ?? parsed.title ?? 'Unknown';
    const year  = parsed.year ?? null;
    return new Movie({
      slug:           slugify(`${title}-${year ?? ''}`),
      title,
      year,
      type:           parsed.type           ?? CONTENT_TYPES.MOVIE,
      language:       parsed.language       ?? null,
      genre:          parsed.genre          ?? null,
      description:    parsed.description    ?? null,
      director:       parsed.directors      ?? null,
      cast:           parsed.cast           ?? null,
      poster_url:     parsed.poster         ?? null,
      runtime:        parsed.duration       ?? null,
      content_rating: parsed.contentRating  ?? null,
    });
  }

  /**
   * Map a raw D1 row to a Movie instance.
   * @param {object} row
   * @returns {Movie}
   */
  static fromRow(row) {
    return new Movie(row);
  }

  /**
   * Map an array of D1 rows to Movie instances.
   * @param {object[]} rows
   * @returns {Movie[]}
   */
  static fromRows(rows) {
    return (rows ?? []).map(r => Movie.fromRow(r));
  }

  // ─── Serialization ────────────────────────────────────────

  /**
   * Convert to a plain D1-insertable row object.
   * Excludes auto-generated fields (id, created_at, updated_at).
   *
   * @returns {object}
   */
  toRow() {
    return {
      slug:            this.slug,
      title:           this.title,
      original_title:  this.originalTitle,
      year:            this.year,
      type:            this.type,
      language:        this.language,
      genre:           this.genre,
      description:     this.description,
      director:        this.director,
      cast:            this.cast,
      country:         this.country,
      runtime:         this.runtime,
      content_rating:  this.contentRating,
      poster_url:      this.posterUrl,
      popularity_score:this.popularityScore,
      search_count:    this.searchCount,
    };
  }

  toJSON() {
    return {
      id:            this.id,
      slug:          this.slug,
      title:         this.title,
      year:          this.year,
      type:          this.type,
      language:      this.language,
      genre:         this.genre,
      imdbRating:    this.imdbRating,
      imdbUrl:       this.imdbUrl,
      posterUrl:     this.posterUrl,
      popularityScore: this.popularityScore,
    };
  }
}
