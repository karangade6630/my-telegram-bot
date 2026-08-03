/**
 * @fileoverview CallbackValidator.
 *
 * @module validation/callbackValidator
 */

export class CallbackValidator {
  static parseCallbackData(data) {
    if (!data || typeof data !== 'string') return null;
    const parts = data.split(':');
    return {
      action: parts[0],
      args: parts.slice(1)
    };
  }
}
