/**
 * @fileoverview ForceSubscribe Middleware.
 *
 * @module middleware/forceSubscribe
 */

export async function forceSubscribeMiddleware(userId, forceSubService) {
  if (!forceSubService) return { isSubscribed: true, missingChannels: [] };
  return await forceSubService.checkForceSubscribe(userId);
}
