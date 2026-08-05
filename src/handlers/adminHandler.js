/**
 * @fileoverview AdminHandler — Manages admin commands (/stats, /broadcast, /ban, /unban, /movies, /users, etc.).
 *
 * @module handlers/adminHandler
 */

import { buildAdminKeyboard } from '../telegram/keyboards.js';

export class AdminHandler {
	/**
	 * @param {import('../telegram/messages.js').TelegramMessages} telegramMessages
	 * @param {import('../services/analyticsService.js').AnalyticsService} analyticsService
	 * @param {import('../repositories/UserRepository.js').UserRepository} userRepo
	 * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
	 * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
	 * @param {import('../services/broadcastService.js').BroadcastService} [broadcastService]
	 */
	constructor(telegramMessages, analyticsService, userRepo, movieRepo, fileRepo, broadcastService = null, db = null) {
		this.telegramMessages = telegramMessages;
		this.analyticsService = analyticsService;
		this.userRepo = userRepo;
		this.movieRepo = movieRepo;
		this.fileRepo = fileRepo;
		this.broadcastService = broadcastService;
		this.db = db;
	}

	async handleAdminCommand(chatId, command, rawArgs = [], user = null) {
		const args = Array.isArray(rawArgs) ? rawArgs : typeof rawArgs === 'string' && rawArgs.trim() ? rawArgs.trim().split(/\s+/) : [];

		switch (command) {
			case '/stats': {
				const users = await this.userRepo.countAll();
				const movies = await this.movieRepo.countAll();
				const files = await this.fileRepo.countAll();
				const totalSizeBytes = (await this.fileRepo.getTotalSizeBytes) ? await this.fileRepo.getTotalSizeBytes() : 0;

				let formattedFileSize = '0 MB';
				if (totalSizeBytes >= 1073741824) {
					formattedFileSize = `${(totalSizeBytes / 1073741824).toFixed(2)} GB`;
				} else if (totalSizeBytes > 0) {
					formattedFileSize = `${(totalSizeBytes / 1048576).toFixed(2)} MB`;
				}

				const d1LimitGB = 10;
				const estimatedDbSizeMB = ((movies * 1.5 + files * 0.8 + users * 0.5) / 1024).toFixed(2);
				const estimatedDbSizeGB = (estimatedDbSizeMB / 1024).toFixed(3);
				const dbUsagePercent = ((estimatedDbSizeGB / d1LimitGB) * 100).toFixed(2);

				const text = [
					`📊 <b>System &amp; Database Statistics</b>`,
					``,
					`👥 <b>Total Users:</b> <code>${users}</code>`,
					`🎬 <b>Total Movies:</b> <code>${movies}</code>`,
					`💾 <b>Total Files:</b> <code>${files}</code>`,
					`📦 <b>Indexed Files Size:</b> <code>${formattedFileSize}</code>`,
					``,
					`🗄️ <b>Database Storage Status (Cloudflare D1):</b>`,
					`├ <b>Estimated DB Used:</b> <code>${estimatedDbSizeMB} MB</code> (${estimatedDbSizeGB} GB)`,
					`├ <b>Max DB Capacity:</b> <code>${d1LimitGB} GB</code>`,
					`└ <b>Fill Status:</b> <code>${dbUsagePercent}%</code> used (out of ${d1LimitGB} GB)`,
				].join('\n');

				await this.telegramMessages.sendMessage(chatId, text, { reply_markup: buildAdminKeyboard() });
				break;
			}

			case '/ban': {
				const targetUserId = args[0];
				if (!targetUserId) {
					await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/ban &lt;user_id&gt; [reason]</code>');
					return;
				}
				const reason = args.slice(1).join(' ') || 'Violation of bot terms';
				const targetUser = await this.userRepo.findByTelegramId(targetUserId);
				if (!targetUser) {
					await this.telegramMessages.sendMessage(chatId, `❌ User with ID <code>${targetUserId}</code> not found in database.`);
					return;
				}
				await this.userRepo.ban(targetUser.id, reason, user?.id);
				await this.telegramMessages.sendMessage(
					chatId,
					`✅ <b>User Banned</b>\n\n👤 User ID: <code>${targetUserId}</code>\n📝 Reason: ${reason}`,
				);
				break;
			}

			case '/unban': {
				const targetUserId = args[0];
				if (!targetUserId) {
					await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/unban &lt;user_id&gt;</code>');
					return;
				}
				const targetUser = await this.userRepo.findByTelegramId(targetUserId);
				if (!targetUser) {
					await this.telegramMessages.sendMessage(chatId, `❌ User with ID <code>${targetUserId}</code> not found in database.`);
					return;
				}
				await this.userRepo.unban(targetUser.id);
				await this.telegramMessages.sendMessage(chatId, `✅ <b>User Unbanned</b>\n\n👤 User ID: <code>${targetUserId}</code>`);
				break;
			}

			case '/movies': {
				const total = await this.movieRepo.countAll();
				const recent = await this.movieRepo.getRecent(5);
				let text = `🎬 <b>Total Movies:</b> <b>${total}</b>\n\n<b>Recently Added:</b>\n`;
				recent.forEach((m, idx) => {
					text += `${idx + 1}. <b>${m.title}</b> ${m.year ? `(${m.year})` : ''}\n`;
				});
				await this.telegramMessages.sendMessage(chatId, text);
				break;
			}

			case '/users': {
				const total = await this.userRepo.countAll();
				const active = await this.userRepo.countActive();
				const text = `👥 <b>User Overview</b>\n\nTotal Registered Users: <b>${total}</b>\nActive Users: <b>${active}</b>`;
				await this.telegramMessages.sendMessage(chatId, text);
				break;
			}

			case '/resetdb': {
				await this.telegramMessages.sendMessage(
					chatId,
					'🧹 <b>Resetting bot data...</b>\nThis will clear all runtime data and leave the database schema plus the first user intact.',
				);
				try {
					const result = await this.resetDatabaseData();
					await this.telegramMessages.sendMessage(
						chatId,
						`✅ <b>Reset complete</b>\n\n🗄️ Database schema preserved.\n👤 Preserved user ID: <code>${result.preservedUserId ?? 'none'}</code>\n🧹 Cleared runtime tables and logs.`,
					);
				} catch (error) {
					await this.telegramMessages.sendMessage(chatId, `❌ <b>Reset failed</b>\n\n${error.message}`);
				}
				break;
			}

			case '/broadcast': {
				if (!args.length) {
					await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/broadcast &lt;message_text&gt;</code>');
					return;
				}

				const msgText = args.join(' ');

				if (!this.broadcastService) {
					await this.telegramMessages.sendMessage(chatId, '❌ Broadcast service is unavailable.');
					return;
				}

				await this.telegramMessages.sendMessage(chatId, `⏳ <b>Initiating Broadcast...</b>\nSending message to all active users...`);

				const result = await this.broadcastService.createBroadcast(msgText, user?.id || null);

				await this.telegramMessages.sendMessage(
					chatId,
					`✅ <b>Broadcast Complete!</b>\n\n👥 <b>Target Users:</b> <code>${result.totalUsers}</code>\n📤 <b>Sent Successfully:</b> <code>${result.sent}</code>\n❌ <b>Failed:</b> <code>${result.failed}</code>`,
				);
				break;
			}

			case '/delete_file': {
				const arg = args[0];
				if (!arg) {
					await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/delete_file &lt;file_id_or_telegram_id&gt;</code>');
					return;
				}
				let file = null;
				if (!isNaN(arg)) {
					file = await this.fileRepo.findById(parseInt(arg));
				}
				if (!file) {
					file = await this.fileRepo.findByFileId(arg);
				}
				if (!file) {
					await this.telegramMessages.sendMessage(chatId, `❌ File <code>${arg}</code> not found in database.`);
					return;
				}
				await this.fileRepo.delete(file.id);
				await this.telegramMessages.sendMessage(
					chatId,
					`✅ <b>File Deleted</b>\n\n📁 File Name: <code>${file.fileName}</code>\n🆔 ID: <code>${file.id}</code>`,
				);
				break;
			}

			case '/delete_movie': {
				const arg = args.join(' ');
				if (!arg) {
					await this.telegramMessages.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/delete_movie &lt;movie_id_or_title&gt;</code>');
					return;
				}
				let movie = null;
				if (!isNaN(arg)) {
					movie = await this.movieRepo.findById(parseInt(arg));
				}
				if (!movie) {
					const found = await this.movieRepo.searchExact(arg);
					movie = found?.[0] || null;
				}
				if (!movie) {
					const containsRes = await this.movieRepo.searchContains(arg, { limit: 1 });
					movie = containsRes?.rows?.[0] || null;
				}
				if (!movie) {
					await this.telegramMessages.sendMessage(chatId, `❌ Movie <code>${arg}</code> not found in database.`);
					return;
				}
				await this.movieRepo.delete(movie.id);
				await this.telegramMessages.sendMessage(
					chatId,
					`✅ <b>Movie & Associated Files Deleted</b>\n\n🎬 Title: <b>${movie.title}</b>\n🆔 Movie ID: <code>${movie.id}</code>`,
				);
				break;
			}

			case '/delete_all_files':
			case '/deleteall': {
				await this.telegramMessages.sendMessage(chatId, '🗑 <b>Deleting all movies and files from database...</b>');
				try {
					const movieCount = await this.movieRepo.countAll();
					const fileCount = await this.fileRepo.countAll();

					if (this.db) {
						await this.db.prepare('DELETE FROM movie_files').run();
						await this.db.prepare('DELETE FROM files').run();
						await this.db.prepare('DELETE FROM movies').run();
					} else {
						await this.fileRepo.run('DELETE FROM movie_files', []);
						await this.fileRepo.run('DELETE FROM files', []);
						await this.movieRepo.run('DELETE FROM movies', []);
					}

					await this.telegramMessages.sendMessage(
						chatId,
						`✅ <b>All Movies & Files Deleted</b>\n\n🎬 Movies removed: <code>${movieCount}</code>\n💾 Files removed: <code>${fileCount}</code>\n\nDatabase media index is now clean!`,
					);
				} catch (error) {
					await this.telegramMessages.sendMessage(chatId, `❌ <b>Deletion failed:</b> ${error.message}`);
				}
				break;
			}

			default:
				break;
		}
	}

	async resetDatabaseData() {
		if (!this.db) {
			throw new Error('Database binding is unavailable.');
		}

		const preservedUser = await this.userRepo.first('SELECT * FROM users ORDER BY created_at ASC, id ASC LIMIT 1');
		const preservedUserId = preservedUser?.id ?? null;

		const tablesToClear = [
			'analytics',
			'logs',
			'requests',
			'watchlist',
			'favorites',
			'continue_watching',
			'search_history',
			'broadcast',
			'force_sub',
			'movie_files',
			'files',
			'movies',
			'channels',
			'banned_users',
			'imdb_cache',
			'poster_cache',
		];

		for (const table of tablesToClear) {
			await this.db.prepare(`DELETE FROM ${table}`).run();
		}

		if (preservedUserId !== null) {
			await this.db.prepare('DELETE FROM users WHERE id != ?').bind(preservedUserId).run();
			await this.db.prepare('DELETE FROM admins WHERE user_id != ?').bind(preservedUserId).run();
			await this.db.prepare('DELETE FROM banned_users WHERE user_id != ?').bind(preservedUserId).run();
		} else {
			await this.db.prepare('DELETE FROM users').run();
			await this.db.prepare('DELETE FROM admins').run();
			await this.db.prepare('DELETE FROM banned_users').run();
		}

		try {
			await this.db.prepare('DELETE FROM sqlite_sequence').run();
		} catch {}

		await this.db
			.prepare(
				"INSERT OR IGNORE INTO qualities (label, rank) VALUES ('480p', 1), ('720p', 2), ('1080p', 3), ('2160p', 4), ('4K', 4), ('HDR', 5), ('CAM', 0)",
			)
			.run();
		await this.db
			.prepare(
				"INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance', 'false'), ('force_subscribe', 'false'), ('auto_filter', 'true'), ('auto_index', 'true'), ('auto_delete', 'false'), ('auto_delete_timer', '300'), ('welcome_message', 'Welcome to the Movie Bot! Send a movie name to search.'), ('private_mode', 'false'), ('group_mode', 'true'), ('max_results', '10'), ('search_cooldown', '3'), ('daily_search_limit', '50')",
			)
			.run();

		return { preservedUserId };
	}
}
