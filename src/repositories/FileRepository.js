/**
 * @fileoverview FileRepository — CRUD for the files table.
 * Handles file_id deduplication via unique_id.
 *
 * @module repositories/FileRepository
 */

import { BaseRepository } from './base/BaseRepository.js';
import { File as FileModel } from '../models/File.js';
import { nowISO }           from '../utils/timeUtils.js';

export class FileRepository extends BaseRepository {

  /**
   * Find a file by its D1 id.
   * @param {number} id
   * @returns {Promise<FileModel|null>}
   */
  async findById(id) {
    const row = await this.first('SELECT * FROM files WHERE id = ?', [id]);
    return row ? FileModel.fromRow(row) : null;
  }

  /**
   * Find a file by its Telegram file_unique_id (for deduplication).
   * @param {string} uniqueId
   * @returns {Promise<FileModel|null>}
   */
  async findByUniqueId(uniqueId) {
    const row = await this.first(
      'SELECT * FROM files WHERE unique_id = ?',
      [uniqueId]
    );
    return row ? FileModel.fromRow(row) : null;
  }

  /**
   * Find an existing file record by unique_id OR exact file_name (+ size_bytes if available).
   * Used for deduplicating uploaded or forwarded files with the exact same name.
   *
   * @param {string} uniqueId
   * @param {string|null} fileName
   * @param {number|null} sizeBytes
   * @returns {Promise<FileModel|null>}
   */
  async findDuplicateFile(uniqueId, fileName = null, sizeBytes = null) {
    if (uniqueId) {
      const byUnique = await this.findByUniqueId(uniqueId);
      if (byUnique) return byUnique;
    }

    if (fileName && fileName.trim()) {
      const name = fileName.trim();
      if (sizeBytes) {
        const byNameAndSize = await this.first(
          'SELECT * FROM files WHERE LOWER(file_name) = LOWER(?) AND size_bytes = ?',
          [name, sizeBytes]
        );
        if (byNameAndSize) return FileModel.fromRow(byNameAndSize);
      }
      const byName = await this.first(
        'SELECT * FROM files WHERE LOWER(file_name) = LOWER(?)',
        [name]
      );
      if (byName) return FileModel.fromRow(byName);
    }

    return null;
  }

  /**
   * Find a file by Telegram file_id.
   * @param {string} telegramFileId
   * @returns {Promise<FileModel|null>}
   */
  async findByFileId(telegramFileId) {
    const row = await this.first(
      'SELECT * FROM files WHERE telegram_file_id = ?',
      [telegramFileId]
    );
    return row ? FileModel.fromRow(row) : null;
  }

  /**
   * Get all files for a movie (via movie_files join).
   * @param {number} movieId
   * @returns {Promise<FileModel[]>}
   */
  async findByMovieId(movieId) {
    const rows = await this.all(
      `SELECT f.*
       FROM files f
       INNER JOIN movie_files mf ON mf.file_id = f.id
       WHERE mf.movie_id = ?
       ORDER BY mf.sort_order ASC, f.indexed_at DESC`,
      [movieId]
    );
    return FileModel.fromRows(rows);
  }

  /**
   * Insert a new file. Uses INSERT OR IGNORE to skip duplicates (by unique_id).
   *
   * @param {object} data  - Plain file row object (from File.toRow())
   * @returns {Promise<number|null>} inserted file id, or null if duplicate
   */
  async insert(data) {
    const result = await this.run(
      `INSERT OR IGNORE INTO files
         (telegram_file_id, unique_id, file_name, file_type, quality, resolution,
          language, audio_tracks, subtitle, codec, is_hevc, is_hdr, is_dual_audio,
          season, episode, size, size_bytes, caption, channel_id, message_id,
          indexed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.telegram_file_id, data.unique_id, data.file_name ?? null,
        data.file_type ?? 'document', data.quality ?? null, data.resolution ?? null,
        data.language ?? null, data.audio_tracks ?? null, data.subtitle ?? null,
        data.codec ?? null,
        data.is_hevc ? 1 : 0, data.is_hdr ? 1 : 0, data.is_dual_audio ? 1 : 0,
        data.season ?? null, data.episode ?? null,
        data.size ?? null, data.size_bytes ?? null,
        data.caption ?? null, data.channel_id ?? null, data.message_id ?? null,
        nowISO(), nowISO(),
      ]
    );
    if (result.meta?.changes > 0 && result.meta?.last_row_id) {
      return result.meta.last_row_id;
    }
    const existing = await this.findByUniqueId(data.unique_id);
    return existing?.id ?? null;
  }

  /**
   * Delete a file by id. Cascades to movie_files.
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    await this.run('DELETE FROM files WHERE id = ?', [id]);
  }

  /**
   * Count total indexed files.
   * @returns {Promise<number>}
   */
  async countAll() {
    return this.count('files');
  }

  /**
   * Get total storage size of all indexed files in bytes.
   * @returns {Promise<number>}
   */
  async getTotalSizeBytes() {
    const row = await this.first('SELECT SUM(size_bytes) as total FROM files');
    return row?.total ?? 0;
  }

  /**
   * Count files indexed from a specific channel.
   * @param {string} channelId
   * @returns {Promise<number>}
   */
  async countByChannel(channelId) {
    return this.count('files', 'channel_id = ?', [channelId]);
  }
}
