/**
 * @fileoverview Feature flag definitions.
 * Add new flags here. Enable/disable without touching any service code.
 * Each flag can be overridden at runtime via KV or D1 settings table.
 *
 * @module featureFlags/flags
 */

/**
 * Static feature flag defaults.
 * Override at runtime by storing JSON in KV key 'flags:overrides'.
 *
 * @type {Record<string, boolean>}
 */
export const FEATURE_FLAGS = Object.freeze({
  /** Require users to subscribe to channel(s) before searching. */
  FORCE_SUB:           false,

  /** Bot is in maintenance mode — only admins can interact. */
  MAINTENANCE:         false,

  /** Allow @bot inline queries in groups and DMs. */
  INLINE_SEARCH:       true,

  /** Automatically index files posted to tracked channels. */
  AUTO_INDEX:          true,

  /** Auto-delete user messages + bot responses after timer. */
  AUTO_DELETE:         false,

  /** Send movie posters fetched from OMDB/IMDb. */
  SHOW_POSTERS:        true,

  /** Enrich search results with OMDB metadata. */
  OMDB_ENRICHMENT:     true,

  /** Enable recommendation engine (requires enough data). */
  AI_RECOMMENDATIONS:  false,

  /** Allow admin broadcast to all users. */
  BROADCAST:           true,

  /** Enable fuzzy / Levenshtein search fallback. */
  FUZZY_SEARCH:        true,

  /** Enable regex search for power users. */
  REGEX_SEARCH:        false,

  /** Enable search result pagination. */
  PAGINATION:          true,

  /** Track per-user search history. */
  SEARCH_HISTORY:      true,

  /** Allow users to build a watchlist. */
  WATCHLIST:           true,

  /** Allow users to mark favorites. */
  FAVORITES:           true,

  /** Show trending movies section. */
  TRENDING:            true,

  /** Rate limit enforcement (disable only for testing). */
  RATE_LIMITING:       true,
});
