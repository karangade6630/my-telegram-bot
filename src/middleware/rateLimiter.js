/**
 * @fileoverview RateLimiter Middleware.
 *
 * @module middleware/rateLimiter
 */

export async function rateLimiterMiddleware(userId, isPremium, rateLimitService) {
  if (!rateLimitService) return { allowed: true };
  return await rateLimitService.checkSearchRateLimit(userId, isPremium);
}
