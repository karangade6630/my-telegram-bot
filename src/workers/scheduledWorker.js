/**
 * @fileoverview Scheduled Worker Entry point.
 * Handles Cloudflare Cron Triggers.
 *
 * @module workers/scheduledWorker
 */

import { CleanupScheduler } from '../scheduler/CleanupScheduler.js';
import { BaseRepository } from '../repositories/base/BaseRepository.js';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';

export class ScheduledWorker {
  static async handle(event, env) {
    if (!env.DB) return;
    const baseRepo = new BaseRepository(env.DB);
    const analyticsRepo = new AnalyticsRepository(env.DB);
    const cleanupScheduler = new CleanupScheduler(analyticsRepo);

    await cleanupScheduler.run();
  }
}
