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
	 */
	constructor(telegramMessages, telegramMedia, searchService) {
		this.telegramMessages = telegramMessages;
		this.telegramMedia = telegramMedia;
		this.searchService = searchService;
	}

	async handleCommand(chatId, command, args, user) {
		switch (command) {
			case BOT_COMMANDS.START:
				await this._handleStart(chatId, user);
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
