/**
 * @fileoverview RateLimitService — Enforces cooldowns, flood protection, and search quotas.
 * Uses KV for sub-second sliding windows and daily quota tracking.
 *
 * @module services/rateLimitService
 */

import { RATE_LIMITS } from '../config/constants.js';

export class RateLimitService {
  /**
   * @param {import('./cacheService.js').CacheService} cacheService
   */
  constructor(cacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Check if a user is currently rate limited for searching.
   *
   * @param {string} userId
   * @param {boolean} [isPremium=false]
   * @returns {Promise<{ allowed: boolean, reason?: string, retryAfter?: number }>}
   */
  async checkSearchRateLimit(userId, isPremium = false) {
    if (isPremium) return { allowed: true };

    const cooldownKey = `rate:cooldown:${userId}`;
    const inCooldown = await this.cacheService.get(cooldownKey);
    if (inCooldown) {
      return { allowed: false, reason: 'cooldown', retryAfter: RATE_LIMITS.SEARCH_COOLDOWN_SEC };
    }

    const dailyKey = `rate:daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const dailyCountStr = await this.cacheService.get(dailyKey);
    const dailyCount = dailyCountStr ? parseInt(dailyCountStr) : 0;

    if (dailyCount >= RATE_LIMITS.DAILY_SEARCH_LIMIT) {
      return { allowed: false, reason: 'daily_limit' };
    }

    await this.cacheService.set(cooldownKey, '1', RATE_LIMITS.SEARCH_COOLDOWN_SEC);
    await this.cacheService.set(dailyKey, String(dailyCount + 1), 86400);

    return { allowed: true };
  }
}
