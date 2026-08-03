/**
 * @fileoverview Bot configuration factory.
 * Reads all Cloudflare Worker env bindings and secrets into a
 * single typed config object. Never read `env` directly outside
 * this module — always use `getBotConfig(env)`.
 *
 * @module config/index
 */

import { DEFAULT_SETTINGS } from './constants.js';

/**
 * Builds the full bot configuration from the Worker environment.
 *
 * Cloudflare Workers expose env bindings (D1, KV, Queue) and
 * secrets (BOT_TOKEN, etc.) via the `env` object passed to fetch().
 *
 * @param {object} env - Cloudflare Worker environment object.
 * @returns {BotConfig}
 */
export function getBotConfig(env) {
  return {
    // ── Telegram ─────────────────────────────────────────────
    botToken:      env.BOT_TOKEN       ?? '',
    botUsername:   env.BOT_USERNAME    ?? '',
    adminIds:      parseAdminIds(env.ADMIN_IDS ?? ''),
    webhookSecret: env.WEBHOOK_SECRET  ?? '',

    // ── External APIs ─────────────────────────────────────────
    omdbApiKey:    env.OMDB_API_KEY    ?? '',

    // ── Cloudflare Bindings ───────────────────────────────────
    database: env.DB     ?? null,   // D1 database
    cache:    env.KV     ?? null,   // KV namespace
    queue:    env.QUEUE  ?? null,   // Queue producer

    // ── Search ────────────────────────────────────────────────
    maxResults:            Number(env.MAX_RESULTS             ?? 10),
    searchCooldownSeconds: Number(env.SEARCH_COOLDOWN_SECONDS ?? 3),
    requestLimit:          Number(env.REQUEST_LIMIT           ?? 5),

    // ── Feature Flags ─────────────────────────────────────────
    settings: {
      ...DEFAULT_SETTINGS,
      ...(env.SETTINGS ? safeJsonParse(env.SETTINGS, {}) : {}),
    },

    // ── Runtime Environment ───────────────────────────────────
    isDev:       env.ENVIRONMENT === 'development',
    isProd:      env.ENVIRONMENT === 'production' || !env.ENVIRONMENT,
    environment: env.ENVIRONMENT ?? 'production',
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Parses a comma-separated string of Telegram user IDs into a Set.
 * Example: "123456,789012" → Set { '123456', '789012' }
 *
 * @param {string} raw
 * @returns {Set<string>}
 */
function parseAdminIds(raw) {
  if (!raw || typeof raw !== 'string') return new Set();
  return new Set(
    raw.split(',')
       .map(id => id.trim())
       .filter(id => id.length > 0)
  );
}

/**
 * Safe JSON.parse — returns fallback on any error.
 *
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Returns true when running inside a Cloudflare Workers runtime.
 *
 * @returns {boolean}
 */
export function isCloudflareRuntime() {
  return typeof navigator !== 'undefined' &&
         navigator.userAgent === 'Cloudflare-Workers';
}

/**
 * @typedef {object} BotConfig
 * @property {string}      botToken
 * @property {string}      botUsername
 * @property {Set<string>} adminIds
 * @property {string}      webhookSecret
 * @property {string}      omdbApiKey
 * @property {D1Database|null}  database
 * @property {KVNamespace|null} cache
 * @property {Queue|null}       queue
 * @property {number}      maxResults
 * @property {number}      searchCooldownSeconds
 * @property {number}      requestLimit
 * @property {object}      settings
 * @property {boolean}     isDev
 * @property {boolean}     isProd
 * @property {string}      environment
 */
