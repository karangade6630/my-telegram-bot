/**
 * @fileoverview MovieFileRepository — manages movie_files join table.
 * Split from MovieRepository to keep each repository under 200 lines.
 *
 * @module repositories/MovieFileRepository
 */

import { BaseRepository } from './base/BaseRepository.js';

export class MovieFileRepository extends BaseRepository {

  /**
   * Link a file to a movie (insert into movie_files).
   * Uses INSERT OR IGNORE to prevent duplicate links.
   *
   * @param {number}  movieId
   * @param {number}  fileId
   * @param {boolean} [isPrimary=false]
   * @param {number}  [sortOrder=0]
   * @returns {Promise<void>}
   */
  async link(movieId, fileId, isPrimary = false, sortOrder = 0) {
    if (!movieId || !fileId) return;
    await this.run(
      `INSERT OR IGNORE INTO movie_files (movie_id, file_id, is_primary, sort_order)
       VALUES (?, ?, ?, ?)`,
      [movieId, fileId, isPrimary ? 1 : 0, sortOrder]
    );
  }

  /**
   * Unlink a file from a movie.
   * @param {number} movieId
   * @param {number} fileId
   * @returns {Promise<void>}
   */
  async unlink(movieId, fileId) {
    await this.run(
      'DELETE FROM movie_files WHERE movie_id = ? AND file_id = ?',
      [movieId, fileId]
    );
  }

  /**
   * Get all file IDs linked to a movie.
   * @param {number} movieId
   * @returns {Promise<number[]>}
   */
  async getFileIds(movieId) {
    const rows = await this.all(
      'SELECT file_id FROM movie_files WHERE movie_id = ? ORDER BY sort_order ASC',
      [movieId]
    );
    return rows.map(r => r.file_id);
  }

  /**
   * Check if a movie-file link already exists.
   * @param {number} movieId
   * @param {number} fileId
   * @returns {Promise<boolean>}
   */
  async exists(movieId, fileId) {
    return super.exists(
      'movie_files',
      'movie_id = ? AND file_id = ?',
      [movieId, fileId]
    );
  }

  /**
   * Count files linked to a movie.
   * @param {number} movieId
   * @returns {Promise<number>}
   */
  async countForMovie(movieId) {
    return this.count('movie_files', 'movie_id = ?', [movieId]);
  }

  /**
   * Get the full movie + files join for a movie.
   * Used for building the quality keyboard.
   *
   * @param {number} movieId
   * @returns {Promise<object[]>}
   */
  async getMovieWithFiles(movieId) {
    return this.all(
      `SELECT m.*, f.id as file_id, f.telegram_file_id, f.file_type,
              f.quality, f.language, f.size, f.is_hevc, f.is_hdr,
              f.is_dual_audio, f.codec, f.season, f.episode, f.audio_tracks
       FROM movies m
       INNER JOIN movie_files mf ON mf.movie_id = m.id
       INNER JOIN files f        ON f.id = mf.file_id
       WHERE m.id = ?
       ORDER BY mf.sort_order ASC`,
      [movieId]
    );
  }
}
