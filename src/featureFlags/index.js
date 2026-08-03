/**
 * @fileoverview FeatureFlag service.
 * Merges static defaults with runtime overrides stored in KV.
 * Usage:
 *   const flags = await FeatureFlags.load(kv);
 *   if (flags.isEnabled('FORCE_SUB')) { ... }
 *
 * @module featureFlags/index
 */

import { FEATURE_FLAGS } from './flags.js';

const KV_KEY = 'flags:overrides';

export class FeatureFlags {
  /**
   * @param {Record<string, boolean>} flags - Merged flag map.
   */
  constructor(flags) {
    this._flags = flags;
  }

  /**
   * Load flags: static defaults merged with KV overrides.
   * Falls back to static defaults if KV is unavailable.
   *
   * @param {KVNamespace|null} kv
   * @returns {Promise<FeatureFlags>}
   */
  static async load(kv) {
    let overrides = {};

    if (kv) {
      try {
        const raw = await kv.get(KV_KEY);
        if (raw) overrides = JSON.parse(raw);
      } catch {
        // KV unavailable — use static defaults only
      }
    }

    return new FeatureFlags({ ...FEATURE_FLAGS, ...overrides });
  }

  /**
   * Create an instance using only static defaults (no KV needed).
   * Useful for unit tests.
   *
   * @returns {FeatureFlags}
   */
  static defaults() {
    return new FeatureFlags({ ...FEATURE_FLAGS });
  }

  /**
   * Check if a feature flag is enabled.
   *
   * @param {string} flagName - Key from FEATURE_FLAGS.
   * @returns {boolean}
   */
  isEnabled(flagName) {
    return this._flags[flagName] === true;
  }

  /**
   * Override a flag at runtime (in-memory only, not persisted).
   *
   * @param {string}  flagName
   * @param {boolean} value
   */
  set(flagName, value) {
    this._flags[flagName] = Boolean(value);
  }

  /**
   * Persist current overrides (diff from defaults) to KV.
   *
   * @param {KVNamespace} kv
   * @returns {Promise<void>}
   */
  async persist(kv) {
    const overrides = {};
    for (const [key, val] of Object.entries(this._flags)) {
      if (FEATURE_FLAGS[key] !== val) overrides[key] = val;
    }
    await kv.put(KV_KEY, JSON.stringify(overrides));
  }

  /**
   * Return all flags as a plain object (for admin display).
   * @returns {Record<string, boolean>}
   */
  toJSON() {
    return { ...this._flags };
  }
}
