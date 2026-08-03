/**
 * @fileoverview IStorage interface.
 * Abstracts file storage (Telegram file_id, R2, S3, Backblaze…).
 * Swap implementations without touching service code.
 *
 * @module interfaces/Storage
 */

/**
 * Storage interface.
 * @interface IStorage
 */
export class IStorage {
  /**
   * Store a file and return its storage reference (file_id or URL).
   * @param {string} key   - Unique key / filename.
   * @param {Blob|ArrayBuffer|ReadableStream} data
   * @param {object} [metadata]
   * @returns {Promise<string>} storage reference
   */
  // eslint-disable-next-line no-unused-vars
  async put(key, data, metadata) { throw new Error('IStorage.put() must be implemented'); }

  /**
   * Retrieve a stored file by key.
   * @param {string} key
   * @returns {Promise<Response|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async get(key) { throw new Error('IStorage.get() must be implemented'); }

  /**
   * Delete a stored file by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async delete(key) { throw new Error('IStorage.delete() must be implemented'); }

  /**
   * Check if a file exists.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  async exists(key) { throw new Error('IStorage.exists() must be implemented'); }
}
