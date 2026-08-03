/**
 * @fileoverview BanCheck Middleware.
 *
 * @module middleware/banCheck
 */

export async function banCheckMiddleware(telegramUserId, userRepo) {
  if (!userRepo) return false;
  return await userRepo.isBanned(telegramUserId);
}
