/**
 * @fileoverview Command Handler — Handlers for /start, /help, /about, /search, /settings.
 *
 * @module handlers/commandHandler
 */

import { BOT_COMMANDS, BOT_NAME, WELCOME_IMAGE_URL } from '../config/constants.js';

export class CommandHandler {
	/**
	 * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
	 * @param {import('../telegram/media.js').TelegramMedia} telegramMedia
	 * @param {import('../services/searchService.js').SearchService} searchService
	 * @param {import('../repositories/FileRepository.js').FileRepository} [fileRepo]
	 * @param {import('./callbackHandler.js').CallbackHandler} [callbackHandler]
	 */
	constructor(telegramMessages, telegramMedia, searchService, fileRepo = null, callbackHandler = null) {
		this.telegramMessages = telegramMessages;
		this.telegramMedia = telegramMedia;
		this.searchService = searchService;
		this.fileRepo = fileRepo;
		this.callbackHandler = callbackHandler;
	}

	async handleCommand(chatId, command, args, user) {
		switch (command) {
			case BOT_COMMANDS.START:
				if (args && args.startsWith('dl_')) {
					await this._handleDeepLinkFileDownload(chatId, args);
				} else {
					await this._handleStart(chatId, user);
				}
				break;

			case BOT_COMMANDS.HELP:
				await this._handleHelp(chatId);
				break;

			case BOT_COMMANDS.ABOUT:
				await this.telegramMessages.sendMessage(
					chatId,
					`🤖 Welcome! Search movies, series, anime, apps, ebooks & more instantly.
🔍 Just send the exact file name (e.g. \`Avengers Endgame 2019\` or \`Money Heist S01\`).
⚡ Use full names with year/season for the fastest & most accurate results.`,
					{
						parse_mode: 'Markdown',
					},
				);
				break;

			default:
				break;
		}
	}

	// ─── Private ────────────────────────────────────────────────

	async _handleDeepLinkFileDownload(chatId, args) {
		// args format: "dl_<fileId>_<timestamp>"
		const parts = args.slice(3).split('_');
		const fileId = parseInt(parts[0], 10);
		const t = parseInt(parts[1], 10);

		const now = Date.now();
		const TEN_MINUTES_MS = 10 * 60 * 1000;

		if (!fileId || isNaN(fileId)) {
			await this.telegramMessages.sendMessage(chatId, '⚠️ Invalid file link.');
			return;
		}

		if (isNaN(t) || (now - t > TEN_MINUTES_MS) || (t > now + 60000)) {
			await this.telegramMessages.sendMessage(
				chatId,
				'⚠️ <b>Link Expired</b>\n\nThis movie file download link was valid for <b>10 minutes</b> and has expired. Please search for the movie again in the bot to get a fresh link.',
				{ parse_mode: 'HTML' }
			);
			return;
		}

		if (!this.fileRepo) {
			await this.telegramMessages.sendMessage(chatId, '⚠️ File repository unavailable.');
			return;
		}

		const file = await this.fileRepo.findById(fileId);
		if (!file) {
			await this.telegramMessages.sendMessage(
				chatId,
				'⚠️ <b>File not found</b>\n\nThis file is no longer available in the database.',
				{ parse_mode: 'HTML' }
			);
			return;
		}

		if (this.callbackHandler) {
			await this.callbackHandler.sendFileMessage(chatId, null, file);
		} else {
			const fileCaption = file.fileName || 'File';
			await this.telegramMedia.sendFile(chatId, file.telegramFileId, file.fileType, fileCaption);
		}
	}

	async _handleStart(chatId, user) {
		const firstName = user?.displayName ?? user?.firstName ?? 'Friend';

		const caption = [
			`<b>ʜᴇʟʟᴏ</b> <b><u>${escapeHtml(firstName)}</u></b><b>, ᴍʏ ɴᴀᴍᴇ ɪꜱ</b> <b><u>${escapeHtml(BOT_NAME)}</u></b> 🤖`,
			``,
			`🔍 <b>Search movies, series, anime, apps, ebooks & more instantly.</b>`,
			`📌 Send the exact file name (e.g. <code>Avengers Endgame 2019</code> or <code>Money Heist S01</code>).`,
			`⚡ <i>Use full names with year/season for the fastest & most accurate results.</i>`,
		].join('\n');

		// Try to send welcome image with caption
		try {
			await this.telegramMedia.sendPhoto(chatId, WELCOME_IMAGE_URL, caption);
		} catch {
			// Fallback to plain text if image fails
			await this.telegramMessages.sendMessage(chatId, caption, { parse_mode: 'HTML' });
		}
	}

	async _handleHelp(chatId) {
		const text = [
			`📖 <b>Help &amp; Instructions</b>`,
			``,
			`1️⃣  Type any movie or series name — e.g. <code>Avengers Endgame</code>`,
			`2️⃣  Browse quality buttons (480p · 720p · 1080p · 4K)`,
			`3️⃣  Tap a quality — file delivered instantly!`,
			``,
			`<b>Tips:</b>`,
			`• Include the year for faster results: <code>Avengers 2019</code>`,
			`• Works in groups &amp; private chat`,
			`• Results auto-delete in 5 minutes`,
		].join('\n');

		await this.telegramMessages.sendMessage(chatId, text);
	}
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
