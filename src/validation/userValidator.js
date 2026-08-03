/**
 * @fileoverview UserValidator.
 *
 * @module validation/userValidator
 */

import { isValidTelegramId } from '../utils/validation.js';

export class UserValidator {
  static validate(userId) {
    if (!isValidTelegramId(userId)) {
      return { valid: false, error: 'Invalid Telegram User ID' };
    }
    return { valid: true };
  }
}
