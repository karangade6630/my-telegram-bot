/**
 * @fileoverview ICache interface.
 * All cache implementations (KV, D1, in-memory) implement this contract.
 *
 * @module interfaces/Cache
 */

/**
 * Cache interface.
 * @interface ICache
 */
export class ICache {
  /**
   * Retrieve a cached value by key.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async get(key) { throw new Error('ICache.get() must be implemented'); }

  /**
   * Store a value in cache with optional TTL.
   * @param {string} key
   * @param {string} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async set(key, value, ttlSeconds) { throw new Error('ICache.set() must be implemented'); }

  /**
   * Delete a cached value.
   * @param {string} key
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async delete(key) { throw new Error('ICache.delete() must be implemented'); }

  /**
   * Check if a key exists in cache.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  async has(key) { throw new Error('ICache.has() must be implemented'); }

  /**
   * Retrieve and JSON-parse a cached value.
   * @param {string} key
   * @returns {Promise<*>}
   */
  // eslint-disable-next-line no-unused-vars
  async getJson(key) { throw new Error('ICache.getJson() must be implemented'); }

  /**
   * JSON-stringify a value and store it.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlSeconds]
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async setJson(key, value, ttlSeconds) { throw new Error('ICache.setJson() must be implemented'); }
}
