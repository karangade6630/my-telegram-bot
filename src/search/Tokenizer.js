/**
 * @fileoverview Tokenizer — splits search queries into ranked tokens.
 * Used by FuzzySearch and ExactSearch to build SQL LIKE queries.
 *
 * @module search/Tokenizer
 */

/** Common stop words that add noise to movie searches. */
const STOP_WORDS = new Set([
  'the','a','an','and','of','in','for','on','with','is','at',
  'by','from','to','that','this','it','as','are','was','be',
  'has','had','have','or','not','but','so','do','its','film',
  'movie','series','season','episode','part','vol','volume',
]);

export class Tokenizer {
  /**
   * Tokenize a search query into clean, ranked tokens.
   * Longer tokens rank higher (more specific).
   *
   * @param {string} query
   * @returns {string[]} sorted tokens (longest first)
   */
  static tokenize(query) {
    if (!query) return [];

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')       // punctuation → space
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(t => t.length > 1 && !STOP_WORDS.has(t))
      .sort((a, b) => b.length - a.length);   // longer = more specific
  }

  /**
   * Build a LIKE pattern for a single token.
   * @param {string} token
   * @returns {string}
   */
  static toLike(token) {
    return `%${token}%`;
  }

  /**
   * Build SQL WHERE fragment for multi-token search.
   * Returns individual LIKE bindings for prepared statements.
   *
   * @param {string[]} tokens
   * @param {string}   [column='title']
   * @returns {{ sql: string, bindings: string[] }}
   */
  static buildSqlConditions(tokens, column = 'LOWER(m.title)') {
    if (!tokens.length) return { sql: '1=1', bindings: [] };
    const conditions = tokens.map(() => `${column} LIKE ?`);
    const bindings   = tokens.map(t => `%${t}%`);
    return { sql: conditions.join(' AND '), bindings };
  }
}
