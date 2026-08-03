/**
 * @fileoverview AnalyticsService — Captures system events & metrics.
 *
 * @module services/analyticsService
 */

export class AnalyticsService {
  /**
   * @param {import('../repositories/AnalyticsRepository.js').AnalyticsRepository} analyticsRepo
   */
  constructor(analyticsRepo) {
    this.analyticsRepo = analyticsRepo;
  }

  /**
   * Log an event.
   *
   * @param {string} eventName
   * @param {number|null} [userId]
   * @param {object|null} [payload]
   */
  async track(eventName, userId = null, payload = null) {
    await this.analyticsRepo.trackEvent(eventName, userId, payload);
  }

  /**
   * Get analytics dashboard metrics.
   */
  async getDashboard() {
    return await this.analyticsRepo.getSummary();
  }
}
