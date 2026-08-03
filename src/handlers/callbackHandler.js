/**
 * @fileoverview CallbackHandler — Handles inline keyboard button callbacks.
 * Delivers files instantly by file_id upon button clicks.
 *
 * @module handlers/callbackHandler
 */

import { CALLBACK } from '../config/constants.js';

export class CallbackHandler {
  /**
   * @param {import('../telegram/callback.js').TelegramCallback} telegramCallback
   * @param {import('../telegram/media.js').TelegramMedia} telegramMedia
   * @param {import('../repositories/FileRepository.js').FileRepository} fileRepo
   * @param {import('../repositories/MovieFileRepository.js').MovieFileRepository} movieFileRepo
   * @param {import('../repositories/MovieRepository.js').MovieRepository} movieRepo
   */
  constructor(telegramCallback, telegramMedia, fileRepo, movieFileRepo, movieRepo) {
    this.telegramCallback = telegramCallback;
    this.telegramMedia = telegramMedia;
    this.fileRepo = fileRepo;
    this.movieFileRepo = movieFileRepo;
    this.movieRepo = movieRepo;
  }

  async handleCallback(callbackQuery) {
    const queryId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;

    if (!data || !chatId) return;

    const [action, id] = data.split(':');

    if (action === CALLBACK.GET_FILE) {
      const file = await this.fileRepo.findById(parseInt(id));
      if (!file) {
        await this.telegramCallback.alert(queryId, 'File no longer available.');
        return;
      }

      await this.telegramCallback.toast(queryId, 'Sending file...');
      await this.telegramMedia.sendFile(
        chatId,
        file.telegramFileId,
        file.fileType,
        `🎬 <b>${file.fileName || 'Movie File'}</b>\n📡 Quality: ${file.qualityLabel}\n💾 Size: ${file.size || 'N/A'}`
      );
    } else if (action === CALLBACK.CLOSE) {
      await this.telegramCallback.answer(queryId);
    } else {
      await this.telegramCallback.answer(queryId);
    }
  }
}
