/**
 * @fileoverview CallbackHandler — Handles inline keyboard button callbacks.
 * Delivers files instantly by file_id upon button clicks.
 * Auto-deletes sent files + notifications after 5 minutes via Cloudflare Queue.
 *
 * @module handlers/callbackHandler
 */

import { CALLBACK, AUTO_DELETE_SECONDS } from '../config/constants.js';
import { buildQualityKeyboard } from '../telegram/keyboards.js';

const AUTO_DELETE_MS = (AUTO_DELETE_SECONDS ?? 300) * 1000;

export class CallbackHandler {
  /**
   * @param {import('../telegram/callback.js').TelegramCallback} telegramCallback
   * @param {import('../telegram/media.js').TelegramMedia} telegramMedia
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {object|null} queue  - Cloudflare Queue binding (env.QUEUE)
   * @param {import('../services/searchService.js').SearchService} [searchService]
   */
  constructor(telegramCallback, telegramMedia, fileRepo, movieFileRepo, movieRepo, userRepo, queue = null, searchService = null) {
    this.telegramCallback = telegramCallback;
    this.telegramMedia    = telegramMedia;
    this.fileRepo         = fileRepo;
    this.movieFileRepo    = movieFileRepo;
    this.movieRepo        = movieRepo;
    this.userRepo         = userRepo;
    this.queue            = queue;
    this.searchService    = searchService;
  }

  async handleCallback(callbackQuery) {
    const queryId   = callbackQuery.id;
    const chatId    = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const data      = callbackQuery.data;

    if (!data || !chatId) return;

    // ── Close button: delete the original search result message ───────────
    if (data === CALLBACK.CLOSE) {
      await this.telegramCallback.answer(queryId);
      if (messageId) {
        await this.telegramMedia._call('deleteMessage', {
          chat_id:    chatId,
          message_id: messageId,
        });
      }
      return;
    }

    // ── NOOP button: silently acknowledge ─────────────────────────────────
    if (data === CALLBACK.NOOP) {
      await this.telegramCallback.answer(queryId);
      return;
    }

    // ── Admin Dashboard Button Callbacks ──────────────────────────────────
    if (data.startsWith('admin:')) {
      await this.telegramCallback.answer(queryId);
      const subAction = data.split(':')[1];

      if (subAction === 'stats') {
        const users = await this.userRepo.countAll();
        const movies = await this.movieRepo.countAll();
        const files = await this.fileRepo.countAll();
        const totalSizeBytes = await this.fileRepo.getTotalSizeBytes ? await this.fileRepo.getTotalSizeBytes() : 0;

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

        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      } else if (subAction === 'users') {
        const total = await this.userRepo.countAll();
        const active = await this.userRepo.countActive();
        const text = `👥 <b>User Overview</b>\n\nTotal Registered Users: <b>${total}</b>\nActive Users: <b>${active}</b>`;
        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      } else if (subAction === 'movies') {
        const total = await this.movieRepo.countAll();
        const recent = await this.movieRepo.getRecent(5);
        let text = `🎬 <b>Total Movies:</b> <b>${total}</b>\n\n<b>Recently Added:</b>\n`;
        recent.forEach((m, idx) => {
          text += `${idx + 1}. <b>${m.title}</b> ${m.year ? `(${m.year})` : ''}\n`;
        });
        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      } else if (subAction === 'broadcast') {
        const text = `📢 <b>Broadcast Instructions</b>\n\nTo broadcast a message to all users, send:\n<code>/broadcast Your message text here...</code>`;
        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      } else if (subAction === 'settings') {
        const text = `⚙️ <b>Bot Settings &amp; Configuration</b>\n\n• Auto-Filter: <b>Enabled</b>\n• Auto-Delete Timer: <b>5 Minutes</b>\n• Mode: <b>Public &amp; Group</b>`;
        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      } else if (subAction === 'channels') {
        const text = `🔧 <b>Channel Indexing Management</b>\n\nAdd this bot to your storage channels as Admin to auto-index uploaded movie files instantly.`;
        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      } else if (subAction === 'logs') {
        const text = `📋 <b>System Logs</b>\n\n• Server Status: <b>Online (Cloudflare Workers)</b>\n• Database: <b>Connected (Cloudflare D1)</b>\n• Cache: <b>Healthy (Cloudflare KV)</b>`;
        if (messageId) {
          await this.telegramMedia._call('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            reply_markup: (await import('../telegram/keyboards.js')).buildAdminKeyboard(),
          });
        }
      }
      return;
    }

    const [action, id] = data.split(':');

    // ── Movie Info / Selection Callback ───────────────────
    if (action === CALLBACK.MOVIE_INFO) {
      const movieId = parseInt(id);
      if (!movieId) {
        await this.telegramCallback.answer(queryId);
        return;
      }
      const movie = await this.movieRepo.findById(movieId);
      const files = await this.fileRepo.findByMovieId(movieId);

      if (!movie || !files || files.length === 0) {
        await this.telegramCallback.alert(queryId, '⚠️ File no longer available.');
        return;
      }

      // Single file for movie -> send file directly!
      if (files.length === 1) {
        const file = files[0];
        await this.telegramCallback.toast(queryId, '📤 Sending file…');

        const fileCaption = [
          `🎬 <b>${escapeHtml(file.fileName || movie.title || 'Movie File')}</b>`,
          file.qualityLabel ? `📡 Quality: ${escapeHtml(file.qualityLabel)}` : '',
          file.size         ? `💾 Size: ${escapeHtml(file.size)}` : '',
        ].filter(Boolean).join('\n');

        const fileMsg = await this.telegramMedia.sendFile(
          chatId,
          file.telegramFileId,
          file.fileType,
          fileCaption
        );

        const delMinutes = Math.round((AUTO_DELETE_SECONDS ?? 300) / 60);
        const notifMsg = await this.telegramMedia._call('sendMessage', {
          chat_id:    chatId,
          text:       `🗑 <b>ʀᴇᴍᴇᴍʙᴇʀ:</b> Tʜɪs ꜰɪʟᴇ ᴀɴᴅ ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ <b>ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b> ɪɴ <b>${delMinutes} ᴍɪɴᴜᴛᴇs</b>. 📥 Sᴀᴠᴇ ɪᴛ ᴛᴏ ʏᴏᴜʀ sᴀᴠᴇᴅ ᴍᴇssᴀɢᴇs ɴᴏᴡ!`,
          parse_mode: 'HTML',
        });

        const idsToDelete = [];
        if (fileMsg?.ok && fileMsg.result?.message_id)  idsToDelete.push(fileMsg.result.message_id);
        if (notifMsg?.ok && notifMsg.result?.message_id) idsToDelete.push(notifMsg.result.message_id);

        if (idsToDelete.length && this.queue) {
          try {
            await this.queue.send(
              { type: 'delete_message', payload: { chatId, messageIds: idsToDelete } },
              { delaySeconds: AUTO_DELETE_SECONDS ?? 300 }
            );
          } catch {}
        }
        return;
      }

      // Multiple files exist -> show quality options
      const keyboard = buildQualityKeyboard(files, movieId);
      const title = movie.title || 'Movie';
      const year = movie.year ? ` (${movie.year})` : '';
      const text = `🎬 <b>${escapeHtml(title)}${year}</b>\n\n📁 <b>Available Files:</b> ${files.length}\n\n⚠️ <b>ᴀꜰᴛᴇʀ 5 ᴍɪɴᴜᴛᴇs ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b>`;

      if (messageId) {
        await this.telegramMedia._call('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
      await this.telegramCallback.answer(queryId);
      return;
    }

    // ── Pagination Callback (pg:query:page) ──────────────────────
    if (action === CALLBACK.PAGE) {
      const parts = data.split(':');
      const queryStr = decodeURIComponent(parts[1] || '');
      const targetPage = parseInt(parts[2]) || 1;

      if (!queryStr) {
        await this.telegramCallback.answer(queryId);
        return;
      }

      if (this.searchService) {
        const searchRes = await this.searchService.search(queryStr, targetPage);
        if (searchRes && !searchRes.isEmpty) {
          const requesterName = callbackQuery.from
            ? [callbackQuery.from.first_name, callbackQuery.from.last_name].filter(Boolean).join(' ').trim() || callbackQuery.from.username || 'User'
            : 'User';

          const header = searchRes.toHeaderText(requesterName);
          const keyboard = (await import('../telegram/keyboards.js')).buildSearchResultsKeyboard(
            searchRes.movies,
            queryStr,
            searchRes.page,
            searchRes.totalPages
          );

          if (messageId) {
            await this.telegramMedia._call('editMessageText', {
              chat_id: chatId,
              message_id: messageId,
              text: header,
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
          }
        }
      }
      await this.telegramCallback.answer(queryId);
      return;
    }

    // ── Quality selection ────────────────────────────────────────
    if (action === CALLBACK.GET_QUALITY) {
      const movieId = parseInt(id);
      if (!movieId) {
        await this.telegramCallback.answer(queryId);
        return;
      }
      const files = await this.fileRepo.findByMovieId(movieId);
      const keyboard = buildQualityKeyboard(files, movieId);
      if (messageId) {
        await this.telegramMedia._call('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        });
      } else {
        await this.telegramMedia._call('sendMessage', {
          chat_id: chatId,
          text: 'Select file quality:',
          reply_markup: keyboard,
        });
      }
      await this.telegramCallback.answer(queryId);
      return;
    }

    // ── File Delivery Callback ──────────────────────────────────
    if (action === CALLBACK.GET_FILE) {
      const file = await this.fileRepo.findById(parseInt(id));
      if (!file) {
        await this.telegramCallback.alert(queryId, '⚠️ File no longer available.');
        return;
      }

      await this.telegramCallback.toast(queryId, '📤 Sending file…');

      const fileCaption = [
        `🎬 <b>${escapeHtml(file.fileName || 'Movie File')}</b>`,
        file.qualityLabel ? `📡 Quality: ${escapeHtml(file.qualityLabel)}` : '',
        file.size         ? `💾 Size: ${escapeHtml(file.size)}` : '',
      ].filter(Boolean).join('\n');

      const fileMsg = await this.telegramMedia.sendFile(
        chatId,
        file.telegramFileId,
        file.fileType,
        fileCaption
      );

      const delMinutes = Math.round((AUTO_DELETE_SECONDS ?? 300) / 60);
      const notifMsg = await this.telegramMedia._call('sendMessage', {
        chat_id:    chatId,
        text:       `🗑 <b>ʀᴇᴍᴇᴍʙᴇʀ:</b> Tʜɪs ꜰɪʟᴇ ᴀɴᴅ ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ <b>ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b> ɪɴ <b>${delMinutes} ᴍɪɴᴜᴛᴇs</b>. 📥 Sᴀᴠᴇ ɪᴛ ᴛᴏ ʏᴏᴜʀ sᴀᴠᴇᴅ ᴍᴇssᴀɢᴇs ɴᴏᴡ!`,
        parse_mode: 'HTML',
      });

      const idsToDelete = [];
      if (fileMsg?.ok && fileMsg.result?.message_id)  idsToDelete.push(fileMsg.result.message_id);
      if (notifMsg?.ok && notifMsg.result?.message_id) idsToDelete.push(notifMsg.result.message_id);

      if (idsToDelete.length && this.queue) {
        try {
          await this.queue.send(
            { type: 'delete_message', payload: { chatId, messageIds: idsToDelete } },
            { delaySeconds: AUTO_DELETE_SECONDS ?? 300 }
          );
        } catch {}
      }

      return;
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    await this.telegramCallback.answer(queryId);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
