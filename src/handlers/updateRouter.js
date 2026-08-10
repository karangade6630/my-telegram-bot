/**
 * @fileoverview UpdateRouter — Central update router for incoming Telegram updates.
 *
 * @module handlers/updateRouter
 */

import { CommandHandler } from './commandHandler.js';
import { MessageHandler } from './messageHandler.js';
import { CallbackHandler } from './callbackHandler.js';
import { InlineHandler } from './inlineHandler.js';
import { ChannelPostHandler } from './channelPostHandler.js';
import { AdminHandler } from './adminHandler.js';
import { extractCommand, extractCommandArgs } from '../utils/validation.js';

export class UpdateRouter {
	/**
	 * @param {object} deps - Injected service & repository dependencies
	 */
	constructor(deps) {
		this.deps = deps;
		this.commandHandler = new CommandHandler(deps.telegramMessages, deps.telegramMedia, deps.searchService);
		this.messageHandler = new MessageHandler(
			deps.searchService,
			deps.telegramMessages,
			deps.telegramMedia,
			deps.movieFileRepo,
			deps.fileRepo,
			deps.logger,
			deps.config?.queue,
		);
		this.callbackHandler = new CallbackHandler(
			deps.telegramCallback,
			deps.telegramMedia,
			deps.fileRepo,
			deps.movieFileRepo,
			deps.movieRepo,
			deps.userRepo,
			deps.config.queue,
			deps.searchService,
		);
		this.inlineHandler = new InlineHandler(deps.telegramInline, deps.searchService, deps.config.botUsername);
		this.channelPostHandler = new ChannelPostHandler(deps.movieIndexService);
		this.adminHandler = new AdminHandler(
			deps.telegramMessages,
			deps.analyticsService,
			deps.userRepo,
			deps.movieRepo,
			deps.fileRepo,
			deps.broadcastService,
			deps.baseRepo?.db ?? deps.config.database,
		);
	}

	async route(update) {
		const { userRepo } = this.deps;

		if (update.channel_post) {
			return await this.channelPostHandler.handleChannelPost(update.channel_post);
		}

		if (update.callback_query) {
			return await this.callbackHandler.handleCallback(update.callback_query);
		}

		if (update.inline_query) {
			return await this.inlineHandler.handleInlineQuery(update.inline_query);
		}

		if (update.message) {
			const msg = update.message;
			const chatId = msg.chat?.id;
			const text = msg.text || '';
			const from = msg.from;

			if (!chatId || !from) return null;

			const user = await userRepo.upsert(from);
			if (user.isBanned) return null;

			const command = extractCommand(text);
			if (command) {
				const args = extractCommandArgs(text);
				const isAdminUser = user.isAdmin || (this.deps.config?.adminIds && this.deps.config.adminIds.has(String(from.id)));
				if (isAdminUser && ['/stats', '/broadcast', '/ban', '/unban', '/movies', '/users', '/resetdb', '/delete_file', '/delete_movie', '/delete_all_files', '/deleteall'].includes(command)) {
					return await this.adminHandler.handleAdminCommand(chatId, command, args, user);
				}
				return await this.commandHandler.handleCommand(chatId, command, args, user);
			}

			return await this.messageHandler.handleMessage(update);
		}

		return null;
	}
}
