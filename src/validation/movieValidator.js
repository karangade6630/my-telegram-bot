/**
 * @fileoverview MovieValidator.
 *
 * @module validation/movieValidator
 */

export class MovieValidator {
  static validate(movieData) {
    if (!movieData.title || typeof movieData.title !== 'string') {
      return { valid: false, error: 'Title is required' };
    }
    return { valid: true };
  }
}
