/**
 * @fileoverview MessageHandler — Processes incoming text messages for movie searches.
 *
 * @module handlers/messageHandler
 */

import { BOT_COMMANDS, EMOJI, AUTO_DELETE_SECONDS } from '../config/constants.js';
import { normalizeMovieTitle } from '../utils/validation.js';
import { MovieHelper } from '../helpers/movieHelper.js';
import { buildSearchResultsKeyboard } from '../telegram/keyboards.js';

export class MessageHandler {
	/**
	 * @param {import('../services/searchService.js').SearchService} searchService
	 * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
	 * @param {import('../telegram/media.js').TelegramMedia} telegramMedia
	 * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
	 * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
	 * @param {import('../utils/logger.js').Logger} logger
	 * @param {object} [queue]
	 */
	constructor(searchService, telegramMessages, telegramMedia, movieFileRepo, fileRepo, logger, queue = null) {
		this.searchService = searchService;
		this.telegramMessages = telegramMessages;
		this.telegramMedia = telegramMedia;
		this.movieFileRepo = movieFileRepo;
		this.fileRepo = fileRepo;
		this.logger = logger;
		this.queue = queue;
	}

	scheduleAutoDelete(chatId, messageId) {
		if (!chatId || !messageId) return;
		const delaySec = AUTO_DELETE_SECONDS ?? 300;
		if (this.queue) {
			try {
				this.queue.send({ type: 'delete_message', payload: { chatId, messageIds: [messageId] } }, { delaySeconds: delaySec });
			} catch {}
		}
		setTimeout(async () => {
			try {
				await this.telegramMessages.deleteMessage(chatId, messageId);
			} catch {}
		}, delaySec * 1000);
	}

	async handleMessage(update) {
		const chatId = update.message?.chat?.id;
		const text = update.message?.text ?? '';
		const user = update.message?.from;

		if (!chatId || !text) return null;

		const normalized = normalizeMovieTitle(text);
		if (!normalized) return null;

		// Requester display name
		const requesterName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || 'User' : 'User';

		// Execute search via SearchService
		const searchRes = await this.searchService.search(normalized);

		let sentMsg = null;

		if (searchRes.isEmpty) {
			sentMsg = await this.telegramMessages.sendMessage(
				chatId,
				[
					`<b>Tʜᴇ Rᴇsᴜʟᴛs Fᴏʀ</b> ☞ <b>${escapeHtml(normalized)}</b>`,
					``,
					`<b>Rᴇǫᴜᴇsᴛᴇᴅ Bʏ</b> ☞ <b>${escapeHtml(requesterName)}</b>`,
					``,
					`🚫 <b>Sᴏʀʀʏ, ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏᴜɴᴅ</b>`,
					``,
					`⚠️ <b>ᴀꜰᴛᴇʀ 5 ᴍɪɴᴜᴛᴇs ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b>`,
				].join('\n'),
			);
		} else if (searchRes.movies.length === 1) {
			// Single result match — show movie card with quality buttons
			const movie = searchRes.movies[0];
			const files = await this.fileRepo.findByMovieId(movie.id);

			const { text: cardText, keyboard } = MovieHelper.formatMovieSearchResult(movie, files);

			sentMsg = await this.telegramMessages.sendMessage(chatId, cardText, { reply_markup: keyboard });
		} else {
			// Multiple results — show styled header + file list keyboard
			const header = searchRes.toHeaderText(requesterName);
			const keyboard = buildSearchResultsKeyboard(searchRes.movies, normalized, searchRes.page, searchRes.totalPages);

			sentMsg = await this.telegramMessages.sendMessage(chatId, header, { reply_markup: keyboard });
		}

		if (sentMsg?.ok && sentMsg.result?.message_id) {
			this.scheduleAutoDelete(chatId, sentMsg.result.message_id);
		}

		return null;
	}
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
