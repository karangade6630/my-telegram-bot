/**
 * @fileoverview Queue Worker Entry point.
 * Switches over queue message types and runs corresponding job modules.
 *
 * @module workers/queueWorker
 */

import { BroadcastJob } from '../queue/BroadcastJob.js';
import { AnalyticsJob } from '../queue/AnalyticsJob.js';
import { TelegramMessages } from '../telegram/messages.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('QueueWorker');

export class QueueWorker {
  static async process(batch, env) {
    const telegramMessages = new TelegramMessages(env.BOT_TOKEN);
    const broadcastJob = new BroadcastJob(telegramMessages);

    for (const message of batch.messages) {
      const { type, payload } = message.body;
      logger.info(`Processing queue job: ${type}`);

      try {
        if (type === 'broadcast_chunk') {
          await broadcastJob.run(message.body);
        } else if (type === 'delete_message') {
          const { chatId, messageIds } = payload || {};
          if (chatId && Array.isArray(messageIds)) {
            for (const msgId of messageIds) {
              try {
                await telegramMessages.deleteMessage(chatId, msgId);
              } catch (e) {
                logger.warn(`Failed to delete message ${msgId} in chat ${chatId}: ${e.message}`);
              }
            }
          }
        } else if (type === 'analytics') {
          // Analytics queue handling
        }
        message.ack();
      } catch (err) {
        logger.error(`Queue job ${type} failed`, { error: err.message });
        message.retry();
      }
    }
  }
}
