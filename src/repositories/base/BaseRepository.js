/**
 * @fileoverview BaseRepository — D1 database adapter.
 * All other repositories extend this class.
 * Provides execute(), batch(), and transaction() helpers.
 * All queries use prepared statements — never string interpolation.
 *
 * @module repositories/base/BaseRepository
 */

import { Logger } from '../../utils/logger.js';

const logger = new Logger('BaseRepository');

export class BaseRepository {
  /**
   * @param {D1Database} db - Cloudflare D1 binding
   */
  constructor(db) {
    if (!db) throw new Error('D1 database binding is required');
    this.db = db;
  }

  // ─────────────────────────────────────────────────────────
  // CORE QUERY METHODS
  // ─────────────────────────────────────────────────────────

  /**
   * Execute a SELECT query and return all matching rows.
   *
   * @param {string}   sql       - Parameterized SQL string
   * @param {Array}    [bindings] - Bound parameters
   * @returns {Promise<object[]>}
   */
  async all(sql, bindings = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...bindings).all();
      return result.results ?? [];
    } catch (err) {
      logger.error('DB.all() failed', { sql: sql.slice(0, 100), error: err.message });
      throw err;
    }
  }

  /**
   * Execute a SELECT query and return the first row.
   *
   * @param {string} sql
   * @param {Array}  [bindings]
   * @returns {Promise<object|null>}
   */
  async first(sql, bindings = []) {
    try {
      const stmt = this.db.prepare(sql);
      return await stmt.bind(...bindings).first() ?? null;
    } catch (err) {
      logger.error('DB.first() failed', { sql: sql.slice(0, 100), error: err.message });
      throw err;
    }
  }

  /**
   * Execute a mutation query (INSERT / UPDATE / DELETE).
   * Returns meta: { last_row_id, changes }.
   *
   * @param {string} sql
   * @param {Array}  [bindings]
   * @returns {Promise<D1Result>}
   */
  async run(sql, bindings = []) {
    try {
      const stmt = this.db.prepare(sql);
      return await stmt.bind(...bindings).run();
    } catch (err) {
      logger.error('DB.run() failed', { sql: sql.slice(0, 100), error: err.message });
      throw err;
    }
  }

  /**
   * Execute multiple statements in a single D1 batch (atomic).
   * Use for multi-step operations that must succeed or fail together.
   *
   * @param {Array<{ sql: string, bindings?: Array }>} statements
   * @returns {Promise<D1Result[]>}
   */
  async batch(statements) {
    try {
      const prepared = statements.map(s =>
        this.db.prepare(s.sql).bind(...(s.bindings ?? []))
      );
      return await this.db.batch(prepared);
    } catch (err) {
      logger.error('DB.batch() failed', { count: statements.length, error: err.message });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────

  /**
   * Count rows matching a WHERE clause.
   *
   * @param {string} table
   * @param {string} [where]
   * @param {Array}  [bindings]
   * @returns {Promise<number>}
   */
  async count(table, where = '1=1', bindings = []) {
    const row = await this.first(
      `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`,
      bindings
    );
    return row?.count ?? 0;
  }

  /**
   * Check if a row exists.
   *
   * @param {string} table
   * @param {string} where
   * @param {Array}  bindings
   * @returns {Promise<boolean>}
   */
  async exists(table, where, bindings = []) {
    const n = await this.count(table, where, bindings);
    return n > 0;
  }

  /**
   * Build a parameterized SET clause from an update data object.
   * Returns { clause, values } for use in UPDATE statements.
   *
   * @param {object} data
   * @returns {{ clause: string, values: Array }}
   */
  buildSetClause(data) {
    const keys   = Object.keys(data).filter(k => data[k] !== undefined);
    const clause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    return { clause, values };
  }

  /**
   * Build a parameterized INSERT clause from data object.
   * Returns { columns, placeholders, values }.
   *
   * @param {object} data
   * @returns {{ columns: string, placeholders: string, values: Array }}
   */
  buildInsertClause(data) {
    const keys         = Object.keys(data).filter(k => data[k] !== undefined);
    const columns      = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values       = keys.map(k => data[k]);
    return { columns, placeholders, values };
  }
}
