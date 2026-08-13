-- =============================================================
-- Telegram Movie AutoFilter Bot — Production Database Schema
-- Engine : Cloudflare D1 (SQLite)
-- Version: 2.0.0
-- Notes  : All TEXT timestamps use ISO-8601 strings because
--          D1/SQLite does not have a native DATETIME type.
--          PRAGMA foreign_keys is set per-connection in JS.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- CORE USER TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT    NOT NULL UNIQUE,     -- Telegram user ID (string to avoid int overflow)
  first_name       TEXT,
  last_name        TEXT,
  username         TEXT,
  language_code    TEXT    DEFAULT 'en',
  is_admin         INTEGER NOT NULL DEFAULT 0,  -- 1 = admin
  is_banned        INTEGER NOT NULL DEFAULT 0,  -- 1 = banned
  is_premium       INTEGER NOT NULL DEFAULT 0,  -- 1 = premium (bypass rate limits)
  total_searches   INTEGER NOT NULL DEFAULT 0,
  last_active      TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE,
  role       TEXT    NOT NULL DEFAULT 'admin',  -- 'superadmin' | 'admin' | 'moderator'
  added_by   INTEGER,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS banned_users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE,
  reason     TEXT,
  banned_by  INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- CONTENT TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS movies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT    NOT NULL UNIQUE,     -- url-safe identifier e.g. "avengers-endgame-2019"
  title            TEXT    NOT NULL,
  original_title   TEXT,
  year             INTEGER,
  type             TEXT    NOT NULL DEFAULT 'movie', -- 'movie'|'series'|'anime'|'web_series'
  language         TEXT,
  genre            TEXT,                        -- comma-separated e.g. "Action, Sci-Fi"
  description      TEXT,
  director         TEXT,
  cast             TEXT,                        -- comma-separated top cast
  country          TEXT,
  runtime          TEXT,                        -- e.g. "148 min"
  content_rating   TEXT,                        -- e.g. "PG-13"
  imdb_id          TEXT,
  imdb_rating      REAL,
  imdb_votes       TEXT,
  trailer_url      TEXT,
  poster_url       TEXT,
  popularity_score INTEGER NOT NULL DEFAULT 0,  -- incremented on each search/view
  search_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS files (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_file_id TEXT    NOT NULL UNIQUE,     -- never re-upload; use this to send
  unique_id        TEXT    NOT NULL UNIQUE,     -- Telegram file_unique_id for dedup
  file_name        TEXT,
  file_type        TEXT    NOT NULL DEFAULT 'document', -- 'document'|'video'|'audio'
  quality          TEXT,                        -- '480p'|'720p'|'1080p'|'2160p'|'unknown'
  resolution       TEXT,                        -- '1920x1080' etc.
  language         TEXT,
  audio_tracks     TEXT,                        -- e.g. "English, Hindi"
  subtitle         TEXT,
  codec            TEXT,                        -- 'x264'|'x265'|'HEVC'|'AV1'
  is_hevc          INTEGER NOT NULL DEFAULT 0,
  is_hdr           INTEGER NOT NULL DEFAULT 0,
  is_dual_audio    INTEGER NOT NULL DEFAULT 0,
  season           INTEGER,
  episode          INTEGER,
  size             TEXT,                        -- human-readable e.g. "1.4 GB"
  size_bytes       INTEGER,                     -- raw bytes for sorting
  caption          TEXT,
  channel_id       TEXT,
  message_id       INTEGER,
  indexed_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS movie_files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id   INTEGER NOT NULL,
  file_id    INTEGER NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (movie_id, file_id),
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id)  REFERENCES files(id)  ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- CLASSIFICATION TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS genres (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS languages (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT                        -- ISO 639-1 code e.g. "en", "hi"
);

CREATE TABLE IF NOT EXISTS qualities (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,      -- '480p', '720p', '1080p', '2160p'
  rank  INTEGER NOT NULL DEFAULT 0 -- for sorting (higher = better)
);

-- Movie ↔ Genre (many-to-many)
CREATE TABLE IF NOT EXISTS movie_genres (
  movie_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, genre_id),
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────
-- CHANNEL / INDEXING TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channels (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_channel_id TEXT    NOT NULL UNIQUE,
  title               TEXT,
  username            TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  is_index_source     INTEGER NOT NULL DEFAULT 1, -- auto-index posts from this channel
  last_indexed_msg_id INTEGER,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─────────────────────────────────────────────────────────────
-- USER ENGAGEMENT TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  query      TEXT    NOT NULL,
  results    INTEGER NOT NULL DEFAULT 0, -- how many results returned
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  movie_id   INTEGER NOT NULL,
  added_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (user_id, movie_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  movie_id   INTEGER NOT NULL,
  added_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (user_id, movie_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS continue_watching (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  movie_id     INTEGER NOT NULL,
  file_id      INTEGER,
  progress_pct INTEGER NOT NULL DEFAULT 0, -- 0–100
  watched_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (user_id, movie_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id)  REFERENCES files(id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER,
  query        TEXT    NOT NULL,
  request_type TEXT    NOT NULL DEFAULT 'search', -- 'search'|'movie'|'file'
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- ADMIN / BROADCAST TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS broadcast (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message    TEXT    NOT NULL,
  parse_mode TEXT    NOT NULL DEFAULT 'HTML',
  created_by INTEGER,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_fail INTEGER NOT NULL DEFAULT 0,
  sent_at    TEXT,
  status     TEXT    NOT NULL DEFAULT 'draft', -- 'draft'|'sending'|'done'|'failed'
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS force_sub (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id  TEXT    NOT NULL UNIQUE,
  channel_url TEXT,
  title       TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─────────────────────────────────────────────────────────────
-- SETTINGS / FILTERS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS filters (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- CACHE TABLES (D1-side fallback when KV unavailable)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS imdb_cache (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  query      TEXT NOT NULL UNIQUE,
  payload    TEXT NOT NULL,               -- JSON blob
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS poster_cache (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_slug TEXT NOT NULL UNIQUE,
  poster_url TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─────────────────────────────────────────────────────────────
-- ANALYTICS / LOGGING TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name    TEXT    NOT NULL,          -- 'search'|'file_send'|'start'|'error'
  user_id       INTEGER,
  event_payload TEXT,                      -- JSON
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL,               -- 'info'|'warn'|'error'|'debug'
  message    TEXT NOT NULL,
  metadata   TEXT,                        -- JSON
  source     TEXT,                        -- module name
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES (covering the hot query paths)
-- ─────────────────────────────────────────────────────────────

-- Users
CREATE INDEX IF NOT EXISTS idx_users_telegram_id  ON users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username      ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_banned     ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_users_last_active   ON users(last_active);

-- Movies
CREATE INDEX IF NOT EXISTS idx_movies_title        ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_slug         ON movies(slug);
CREATE INDEX IF NOT EXISTS idx_movies_year         ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_language     ON movies(language);
CREATE INDEX IF NOT EXISTS idx_movies_type         ON movies(type);
CREATE INDEX IF NOT EXISTS idx_movies_imdb_id      ON movies(imdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_popularity   ON movies(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_movies_search_count ON movies(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_movies_updated      ON movies(updated_at DESC);

-- Files
CREATE INDEX IF NOT EXISTS idx_files_file_id       ON files(telegram_file_id);
CREATE INDEX IF NOT EXISTS idx_files_unique_id     ON files(unique_id);
CREATE INDEX IF NOT EXISTS idx_files_quality       ON files(quality);
CREATE INDEX IF NOT EXISTS idx_files_channel       ON files(channel_id);
CREATE INDEX IF NOT EXISTS idx_files_language      ON files(language);
CREATE INDEX IF NOT EXISTS idx_files_codec         ON files(codec);
CREATE INDEX IF NOT EXISTS idx_files_indexed_at    ON files(indexed_at DESC);

-- Movie ↔ Files join
CREATE INDEX IF NOT EXISTS idx_movie_files_movie   ON movie_files(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_files_file    ON movie_files(file_id);

-- Engagement
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_user      ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user      ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user       ON requests(user_id);

-- Analytics / Logs
CREATE INDEX IF NOT EXISTS idx_analytics_event     ON analytics(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_user      ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_time      ON analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level          ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_time           ON logs(created_at DESC);

-- Cache
CREATE INDEX IF NOT EXISTS idx_imdb_cache_query    ON imdb_cache(query);
CREATE INDEX IF NOT EXISTS idx_poster_cache_slug   ON poster_cache(movie_slug);

-- ─────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO qualities (label, rank) VALUES
  ('480p',  1),
  ('720p',  2),
  ('1080p', 3),
  ('2160p', 4),
  ('4K',    4),
  ('HDR',   5),
  ('CAM',   0);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('maintenance',       'false'),
  ('force_subscribe',   'false'),
  ('auto_filter',       'true'),
  ('auto_index',        'true'),
  ('auto_delete',       'false'),
  ('auto_delete_timer', '300'),
  ('welcome_message',   'Welcome to the Movie Bot! Send a movie name to search.'),
  ('private_mode',      'false'),
  ('group_mode',        'true'),
  ('max_results',       '10'),
  ('search_cooldown',   '3'),
  ('daily_search_limit','50');
