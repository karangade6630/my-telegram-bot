/**
 * @fileoverview IRepository interface (JSDoc contract).
 * All concrete repository classes MUST implement these methods.
 * When migrating to TypeScript, convert to `interface IRepository<T>`.
 *
 * @module interfaces/Repository
 */

/**
 * Base repository interface.
 * Defines the minimum CRUD contract for all data repositories.
 *
 * @interface IRepository
 * @template T
 */
export class IRepository {
  /**
   * Find a single record by its primary key.
   * @param {number|string} id
   * @returns {Promise<T|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async findById(id) { throw new Error('IRepository.findById() must be implemented'); }

  /**
   * Find all records matching a filter object.
   * @param {object} [filter]
   * @returns {Promise<T[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async findAll(filter) { throw new Error('IRepository.findAll() must be implemented'); }

  /**
   * Insert a new record and return the created entity.
   * @param {Partial<T>} data
   * @returns {Promise<T>}
   */
  // eslint-disable-next-line no-unused-vars
  async create(data) { throw new Error('IRepository.create() must be implemented'); }

  /**
   * Update an existing record by id.
   * @param {number|string} id
   * @param {Partial<T>} data
   * @returns {Promise<T|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async update(id, data) { throw new Error('IRepository.update() must be implemented'); }

  /**
   * Delete a record by id.
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  async delete(id) { throw new Error('IRepository.delete() must be implemented'); }

  /**
   * Check if a record exists matching a filter.
   * @param {object} filter
   * @returns {Promise<boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  async exists(filter) { throw new Error('IRepository.exists() must be implemented'); }

  /**
   * Count records matching a filter.
   * @param {object} [filter]
   * @returns {Promise<number>}
   */
  // eslint-disable-next-line no-unused-vars
  async count(filter) { throw new Error('IRepository.count() must be implemented'); }
}
