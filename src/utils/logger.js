/**
 * @fileoverview Structured logger for Cloudflare Workers.
 * Uses console.log/warn/error (Workers-compatible).
 * Outputs JSON lines in production for log analytics.
 * Supports levels: debug | info | warn | error.
 *
 * @module utils/logger
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

export class Logger {
	/**
	 * @param {string} source    - Module name for context e.g. 'SearchService'
	 * @param {string} [minLevel] - Minimum log level (default: 'info')
	 */
	constructor(source, minLevel = 'info') {
		this.source = source;
		this.minLevel = LEVELS[minLevel] ?? LEVELS.info;
	}

	// ─── Public Methods ────────────────────────────────────────

	/**
	 * Debug log — verbose internal state.
	 * @param {string} message
	 * @param {object} [meta]
	 */
	debug(message, meta) {
		this._log('debug', message, meta);
	}

	/**
	 * Info log — normal operations.
	 * @param {string} message
	 * @param {object} [meta]
	 */
	info(message, meta) {
		this._log('info', message, meta);
	}

	/**
	 * Warn log — unexpected but recoverable.
	 * @param {string} message
	 * @param {object} [meta]
	 */
	warn(message, meta) {
		this._log('warn', message, meta);
	}

	/**
	 * Error log — failures requiring attention.
	 * @param {string} message
	 * @param {object} [meta]
	 */
	error(message, meta) {
		this._log('error', message, meta);
	}

	/**
	 * Create a child logger with a sub-source name.
	 * @param {string} childName
	 * @returns {Logger}
	 */
	child(childName) {
		return new Logger(`${this.source}:${childName}`, Object.keys(LEVELS)[this.minLevel]);
	}

	// ─── Private ────────────────────────────────────────────────

	/**
	 * @param {'debug'|'info'|'warn'|'error'} level
	 * @param {string} message
	 * @param {object} [meta]
	 */
	_log(level, message, meta) {
		if ((LEVELS[level] ?? 0) < this.minLevel) return;

		const entry = {
			ts: new Date().toISOString(),
			level,
			source: this.source,
			msg: message,
			...(meta ? { meta } : {}),
		};

		const output = JSON.stringify(entry);

		switch (level) {
			case 'debug':
				console.debug(output);
				break;
			case 'warn':
				console.warn(output);
				break;
			case 'error':
				console.error(output);
				break;
			default:
				console.log(output);
				break;
		}
	}
}
