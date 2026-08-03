/**
 * @fileoverview MovieHelper — Generates Telegram UI layouts and keyboards for movies.
 *
 * @module helpers/movieHelper
 */

import { buildQualityKeyboard } from '../telegram/keyboards.js';
import { MovieResponse } from '../dto/MovieResponse.js';

export class MovieHelper {
  static formatMovieSearchResult(movie, files) {
    const dto = MovieResponse.from(movie, files);
    const text = dto.toTelegramHTML();
    const keyboard = buildQualityKeyboard(files, movie.id);

    return { text, keyboard };
  }
}
