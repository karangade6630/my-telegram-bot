/**
 * @fileoverview Webhook Router / Route Handler.
 * Keeps index.js minimal by isolating Webhook request handling into src/routes/webhook.js.
 *
 * @module routes/webhook
 */

import { getBotConfig } from '../config/index.js';
import { validateWebhookRequest } from '../middleware/security.js';
import { BaseRepository } from '../repositories/base/BaseRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { MovieRepository } from '../repositories/MovieRepository.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MovieFileRepository } from '../repositories/MovieFileRepository.js';
import { ChannelRepository } from '../repositories/ChannelRepository.js';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';

import { CacheService } from '../services/cacheService.js';
import { SearchService } from '../services/searchService.js';
import { OmdbService } from '../services/omdbService.js';
import { MovieIndexService } from '../services/movieIndexService.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { BroadcastService } from '../services/broadcastService.js';

import { TelegramMessages } from '../telegram/messages.js';
import { TelegramMedia } from '../telegram/media.js';
import { TelegramCallback } from '../telegram/callback.js';
import { TelegramInline } from '../telegram/inline.js';
import { TelegramChat } from '../telegram/chat.js';

import { UpdateRouter } from '../handlers/updateRouter.js';
import { Logger } from '../utils/logger.js';

export async function handleWebhookRequest(request, env) {
  const logger = new Logger('webhook');
  const config = getBotConfig(env);

  const securityCheck = await validateWebhookRequest(request, env);
  if (!securityCheck.ok) {
    logger.warn('Webhook request rejected by security check.');
    return new Response('Unauthorized', { status: securityCheck.status });
  }

  const update = await request.json().catch(() => null);
  if (!update) {
    return new Response('OK', { status: 200 });
  }

  if (!config.database) {
    logger.warn('D1 Database binding is missing.');
    return new Response('Database unavailable', { status: 503 });
  }

  // Repository initialization
  const baseRepo = new BaseRepository(config.database);
  const userRepo = new UserRepository(config.database);
  const movieRepo = new MovieRepository(config.database);
  const fileRepo = new FileRepository(config.database);
  const movieFileRepo = new MovieFileRepository(config.database);
  const channelRepo = new ChannelRepository(config.database);
  const analyticsRepo = new AnalyticsRepository(config.database);
  const settingsRepo = new SettingsRepository(config.database);

  // Telegram API Wrappers
  const telegramMessages = new TelegramMessages(config.botToken);
  const telegramMedia = new TelegramMedia(config.botToken);
  const telegramCallback = new TelegramCallback(config.botToken);
  const telegramInline = new TelegramInline(config.botToken);
  const telegramChat = new TelegramChat(config.botToken);

  // Service initialization
  const cacheService = new CacheService(config.cache, baseRepo);
  const omdbService = new OmdbService(config.omdbApiKey, cacheService);
  const searchService = new SearchService(movieRepo, cacheService);
  const movieIndexService = new MovieIndexService(movieRepo, fileRepo, movieFileRepo, channelRepo, config.queue, omdbService);
  const analyticsService = new AnalyticsService(analyticsRepo);
  const broadcastService = new BroadcastService(userRepo, baseRepo, config.queue, telegramMessages);

  const router = new UpdateRouter({
    config,
    baseRepo,
    userRepo,
    movieRepo,
    fileRepo,
    movieFileRepo,
    channelRepo,
    analyticsRepo,
    settingsRepo,
    cacheService,
    omdbService,
    searchService,
    movieIndexService,
    analyticsService,
    broadcastService,
    telegramMessages,
    telegramMedia,
    telegramCallback,
    telegramInline,
    telegramChat,
    logger,
  });

  try {
    await router.route(update);
    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('Error handling webhook update', { error: error.message, stack: error.stack });
    return new Response('Internal Error', { status: 500 });
  }
}
