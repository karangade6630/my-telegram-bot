/**
 * @fileoverview IQueue interface.
 * Abstracts Cloudflare Queue so jobs can be tested without real infra.
 *
 * @module interfaces/Queue
 */

/**
 * Queue interface.
 * @interface IQueue
 */
export class IQueue {
  /**
   * Send a single message to the queue.
   * @param {object} message
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async send(message, options) { throw new Error('IQueue.send() must be implemented'); }

  /**
   * Send multiple messages to the queue in a batch.
   * @param {object[]} messages
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async sendBatch(messages) { throw new Error('IQueue.sendBatch() must be implemented'); }
}
