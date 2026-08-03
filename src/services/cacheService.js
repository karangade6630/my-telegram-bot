/**
 * @fileoverview CacheService — Manages KV caching and D1 fallback cache.
 * Implements ICache contract.
 *
 * @module services/cacheService
 */

import { ICache } from '../interfaces/Cache.js';
import { safeJson } from '../utils/validation.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('CacheService');

export class CacheService extends ICache {
  /**
   * @param {KVNamespace|null} kv
   * @param {import('../repositories/base/BaseRepository.js').BaseRepository} [repo]
   */
  constructor(kv, repo = null) {
    super();
    this.kv = kv;
    this.repo = repo;
  }

  async get(key) {
    if (this.kv) {
      try {
        return await this.kv.get(key);
      } catch (err) {
        logger.warn('KV get failed, falling back to D1', { key, error: err.message });
      }
    }
    if (this.repo) {
      const row = await this.repo.first('SELECT value FROM cache WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)', [key]);
      return row?.value ?? null;
    }
    return null;
  }

  async set(key, value, ttlSeconds = 300) {
    if (this.kv) {
      try {
        await this.kv.put(key, value, { expirationTtl: ttlSeconds });
        return;
      } catch (err) {
        logger.warn('KV put failed', { key, error: err.message });
      }
    }
    if (this.repo) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      await this.repo.run(
        `INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
        [key, value, expiresAt]
      );
    }
  }

  async delete(key) {
    if (this.kv) {
      try {
        await this.kv.delete(key);
      } catch (err) {
        logger.warn('KV delete failed', { key });
      }
    }
    if (this.repo) {
      await this.repo.run('DELETE FROM cache WHERE key = ?', [key]);
    }
  }

  async has(key) {
    const val = await this.get(key);
    return val !== null;
  }

  async getJson(key) {
    const raw = await this.get(key);
    return raw ? safeJson(raw) : null;
  }

  async setJson(key, value, ttlSeconds = 300) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
