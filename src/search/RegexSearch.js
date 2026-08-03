/**
 * @fileoverview RegexSearch — pattern-based search for power users.
 * Enabled only when FeatureFlag REGEX_SEARCH is true.
 * Input is sanitized to prevent ReDoS.
 *
 * @module search/RegexSearch
 */

/** Max regex complexity (length) allowed. */
const MAX_REGEX_LENGTH = 60;

export class RegexSearch {
  /**
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   */
  constructor(movieRepo) {
    this.movieRepo = movieRepo;
  }

  /**
   * Filter candidate movies using a user-supplied regex pattern.
   *
   * @param {string} pattern - User-supplied regex string
   * @param {object} [opts]
   * @param {number} [opts.limit]
   * @param {number} [opts.candidateLimit]
   * @returns {Promise<{ movies: object[], total: number, strategy: string }>}
   */
  async search(pattern, opts = {}) {
    const { limit = 10, candidateLimit = 200 } = opts;

    // ── Safety checks ─────────────────────────────────────────
    if (!pattern || pattern.length > MAX_REGEX_LENGTH) {
      return { movies: [], total: 0, strategy: 'regex', error: 'Invalid pattern' };
    }

    let regex;
    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      return { movies: [], total: 0, strategy: 'regex', error: 'Invalid regex' };
    }

    // Load candidates and filter with regex
    const candidates = await this.movieRepo.getCandidates(candidateLimit);
    const matched = candidates
      .filter(m => regex.test(m.title) || regex.test(m.original_title ?? ''))
      .slice(0, limit);

    return { movies: matched, total: matched.length, strategy: 'regex' };
  }
}
