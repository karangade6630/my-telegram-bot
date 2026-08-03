/**
 * @fileoverview AnalyticsJob — Processes queue event analytics.
 *
 * @module queue/AnalyticsJob
 */

export class AnalyticsJob {
  /**
   * @param {import('../services/analyticsService.js').AnalyticsService} analyticsService
   */
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  async run(payload) {
    if (!payload || !payload.name) return;
    await this.analyticsService.track(payload.name, payload.userId || null, payload);
  }
}
