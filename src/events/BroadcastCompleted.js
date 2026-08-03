/**
 * @fileoverview BroadcastCompleted domain event.
 * Emitted when an admin broadcast finishes sending to all users.
 *
 * @module events/BroadcastCompleted
 */

export class BroadcastCompleted {
  /** @type {string} */
  static NAME = 'broadcast.completed';

  /**
   * @param {object} payload
   * @param {number} payload.broadcastId
   * @param {string} payload.sentBy        - Admin telegram user ID
   * @param {number} payload.totalSent
   * @param {number} payload.totalFailed
   * @param {number} payload.durationMs
   * @param {Date}   [payload.completedAt]
   */
  constructor({
    broadcastId,
    sentBy,
    totalSent,
    totalFailed,
    durationMs,
    completedAt = new Date(),
  }) {
    this.name        = BroadcastCompleted.NAME;
    this.broadcastId = broadcastId;
    this.sentBy      = sentBy;
    this.totalSent   = totalSent;
    this.totalFailed = totalFailed;
    this.durationMs  = durationMs;
    this.completedAt = completedAt;
  }

  get successRate() {
    const total = this.totalSent + this.totalFailed;
    return total > 0 ? ((this.totalSent / total) * 100).toFixed(1) : '0.0';
  }

  toJSON() {
    return {
      name:        this.name,
      broadcastId: this.broadcastId,
      sentBy:      this.sentBy,
      totalSent:   this.totalSent,
      totalFailed: this.totalFailed,
      successRate: this.successRate,
      durationMs:  this.durationMs,
      completedAt: this.completedAt.toISOString(),
    };
  }
}
