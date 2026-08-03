/**
 * @fileoverview SearchPerformed domain event.
 * Emitted after every user search (hit or miss).
 *
 * @module events/SearchPerformed
 */

export class SearchPerformed {
  /** @type {string} */
  static NAME = 'search.performed';

  /**
   * @param {object} payload
   * @param {string} payload.query
   * @param {string} payload.telegramUserId
   * @param {number} payload.resultCount       - 0 = no results
   * @param {string} payload.strategy          - 'exact'|'fuzzy'|'regex'
   * @param {number} payload.durationMs        - query execution time
   * @param {Date}   [payload.performedAt]
   */
  constructor({
    query,
    telegramUserId,
    resultCount,
    strategy,
    durationMs,
    performedAt = new Date(),
  }) {
    this.name           = SearchPerformed.NAME;
    this.query          = query;
    this.telegramUserId = telegramUserId;
    this.resultCount    = resultCount;
    this.strategy       = strategy;
    this.durationMs     = durationMs;
    this.performedAt    = performedAt;
  }

  get wasSuccessful() {
    return this.resultCount > 0;
  }

  toJSON() {
    return {
      name:           this.name,
      query:          this.query,
      telegramUserId: this.telegramUserId,
      resultCount:    this.resultCount,
      strategy:       this.strategy,
      durationMs:     this.durationMs,
      performedAt:    this.performedAt.toISOString(),
    };
  }
}
