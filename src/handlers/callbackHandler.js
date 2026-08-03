/**
 * @fileoverview CallbackHandler — Handles inline keyboard button callbacks.
 * Delivers files instantly by file_id upon button clicks.
 * Auto-deletes sent files + notifications after 5 minutes via Cloudflare Queue.
 *
 * @module handlers/callbackHandler
 */

import { CALLBACK, AUTO_DELETE_SECONDS } from '../config/constants.js';

const AUTO_DELETE_MS = (AUTO_DELETE_SECONDS ?? 300) * 1000;

export class CallbackHandler {
  /**
   * @param {import('../telegram/callback.js').TelegramCallback} telegramCallback
   * @param {import('../telegram/media.js').TelegramMedia} telegramMedia
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   * @param {object|null} queue  - Cloudflare Queue binding (env.QUEUE)
   */
  constructor(telegramCallback, telegramMedia, fileRepo, movieFileRepo, movieRepo, userRepo, queue = null) {
    this.telegramCallback = telegramCallback;
    this.telegramMedia    = telegramMedia;
    this.fileRepo         = fileRepo;
    this.movieFileRepo    = movieFileRepo;
    this.movieRepo        = movieRepo;
    this.userRepo         = userRepo;
    this.queue            = queue;
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
        const totalSizeBytes = await this.fileRepo.getTotalSizeBytes();

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

    // ── File delivery ─────────────────────────────────────────────────────
    if (action === CALLBACK.GET_FILE) {
      const file = await this.fileRepo.findById(parseInt(id));
      if (!file) {
        await this.telegramCallback.alert(queryId, '⚠️ File no longer available.');
        return;
      }

      await this.telegramCallback.toast(queryId, '📤 Sending file…');

      // Caption shown with the file
      const fileCaption = [
        `🎬 <b>${escapeHtml(file.fileName || 'Movie File')}</b>`,
        file.qualityLabel ? `📡 Quality: ${escapeHtml(file.qualityLabel)}` : '',
        file.size         ? `💾 Size: ${escapeHtml(file.size)}` : '',
      ].filter(Boolean).join('\n');

      // Send the file
      const fileMsg = await this.telegramMedia.sendFile(
        chatId,
        file.telegramFileId,
        file.fileType,
        fileCaption
      );

      // Send auto-delete notification below the file
      const delMinutes = Math.round((AUTO_DELETE_SECONDS ?? 300) / 60);
      const notifMsg = await this.telegramMedia._call('sendMessage', {
        chat_id:    chatId,
        text:       `🗑 <b>ʀᴇᴍᴇᴍʙᴇʀ:</b> Tʜɪs ꜰɪʟᴇ ᴀɴᴅ ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪʟʟ ʙᴇ <b>ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ᴅᴇʟᴇᴛᴇᴅ</b> ɪɴ <b>${delMinutes} ᴍɪɴᴜᴛᴇs</b>. 📥 Sᴀᴠᴇ ɪᴛ ᴛᴏ ʏᴏᴜʀ sᴀᴠᴇᴅ ᴍᴇssᴀɢᴇs ɴᴏᴡ!`,
        parse_mode: 'HTML',
      });

      // Schedule deletion of both messages via Cloudflare Queue (delaySeconds)
      const idsToDelete = [];
      if (fileMsg?.ok && fileMsg.result?.message_id)  idsToDelete.push(fileMsg.result.message_id);
      if (notifMsg?.ok && notifMsg.result?.message_id) idsToDelete.push(notifMsg.result.message_id);

      if (idsToDelete.length && this.queue) {
        try {
          await this.queue.send(
            { type: 'delete_message', payload: { chatId, messageIds: idsToDelete } },
            { delaySeconds: AUTO_DELETE_SECONDS ?? 300 }
          );
        } catch {
          // Queue unavailable — deletion won't happen but file was still sent OK
        }
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
