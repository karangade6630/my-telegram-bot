/**
 * @fileoverview Command Validator.
 *
 * @module validation/commandValidator
 */

import { validateSearchQuery } from '../utils/validation.js';

export class CommandValidator {
  static validateSearch(args) {
    return validateSearchQuery(args);
  }
}
