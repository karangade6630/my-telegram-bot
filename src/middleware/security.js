/**
 * @fileoverview Security Middleware — Webhook authentication and payload validation.
 *
 * @module middleware/security
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('security');

export async function validateWebhookRequest(request, env) {
  const secretToken = env.WEBHOOK_SECRET;

  // If WEBHOOK_SECRET is not configured, bypass security check
  if (!secretToken || secretToken.trim() === '') {
    return { ok: true };
  }

  const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  if (!header) {
    logger.warn('Incoming webhook missing X-Telegram-Bot-Api-Secret-Token header. Re-register setWebhook with secret_token.');
    return { ok: false, status: 403 };
  }

  if (header !== secretToken) {
    logger.warn('X-Telegram-Bot-Api-Secret-Token header mismatch.');
    return { ok: false, status: 403 };
  }

  return { ok: true };
}
