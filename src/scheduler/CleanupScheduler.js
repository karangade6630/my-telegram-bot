/**
 * @fileoverview CleanupScheduler — Cron scheduled task for system maintenance & purging old logs.
 *
 * @module scheduler/CleanupScheduler
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('CleanupScheduler');

export class CleanupScheduler {
  /**
   * @param {import('../repositories/AnalyticsRepository.js').AnalyticsRepository} analyticsRepo
   */
  constructor(analyticsRepo) {
    this.analyticsRepo = analyticsRepo;
  }

  async run() {
    logger.info('Starting daily cleanup scheduled task...');
    const logsDeleted = await this.analyticsRepo.deleteOldLogs(30);
    const eventsDeleted = await this.analyticsRepo.deleteOldEvents(90);
    logger.info(`Cleanup completed. Logs deleted: ${logsDeleted}, Events deleted: ${eventsDeleted}`);
    return { logsDeleted, eventsDeleted };
  }
}
