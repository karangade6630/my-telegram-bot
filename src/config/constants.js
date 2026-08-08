/**
 * @fileoverview Central constants for the Telegram Movie AutoFilter Bot.
 * All magic strings, enums, and configuration values live here.
 * Never hardcode strings directly in handlers/services — import from here.
 *
 * @module config/constants
 */

// ─────────────────────────────────────────────────────────────
// BOT COMMANDS
// ─────────────────────────────────────────────────────────────

/** All registered Telegram bot commands. */
export const BOT_COMMANDS = Object.freeze({
	START: '/start',
	HELP: '/help',
	ABOUT: '/about',
	SEARCH: '/search',
	SETTINGS: '/settings',
	STATS: '/stats',
	BROADCAST: '/broadcast',
	RESETDB: '/resetdb',
	BAN: '/ban',
	UNBAN: '/unban',
	ADDADMIN: '/addadmin',
	RMADMIN: '/rmadmin',
	USERS: '/users',
	MOVIES: '/movies',
	DELMOVIE: '/delmovie',
	DELFILE: '/delfile',
	INDEX: '/index',
	REINDEX: '/reindex',
	CHANNEL: '/channel',
	BACKUP: '/backup',
	LOGS: '/logs',
	CANCEL: '/cancel',
	HISTORY: '/history',
	WATCHLIST: '/watchlist',
	FAVORITES: '/favorites',
	TRENDING: '/trending',
	RECENT: '/recent',
});

// ─────────────────────────────────────────────────────────────
// CALLBACK ACTIONS
// ─────────────────────────────────────────────────────────────

/** All callback_data action prefixes used in inline keyboards. */
export const CALLBACK = Object.freeze({
	// File delivery
	GET_FILE: 'gf', // gf:<file_id>
	GET_QUALITY: 'gq', // gq:<movie_id>:<quality>
	// Pagination
	PAGE: 'pg', // pg:<query>:<page>
	// Movie info
	MOVIE_INFO: 'mi', // mi:<movie_id>
	MOVIE_TRAILER: 'mt', // mt:<movie_id>
	// User engagement
	WATCHLIST_ADD: 'wa', // wa:<movie_id>
	WATCHLIST_RM: 'wr', // wr:<movie_id>
	FAVORITE_ADD: 'fa', // fa:<movie_id>
	FAVORITE_RM: 'fr', // fr:<movie_id>
	// Filters
	FILTER_LANG: 'fl', // fl:<lang>
	FILTER_QUAL: 'fq', // fq:<quality>
	FILTER_YEAR: 'fy', // fy:<year>
	FILTER_GENRE: 'fg', // fg:<genre>
	// Admin
	ADMIN_BAN: 'ab', // ab:<user_id>
	ADMIN_UNBAN: 'au', // au:<user_id>
	ADMIN_DEL: 'ad', // ad:<movie_id>
	CONFIRM_YES: 'cy',
	CONFIRM_NO: 'cn',
	// Navigation
	CLOSE: 'cl',
	BACK: 'bk',
	NOOP: 'noop',
});

// ─────────────────────────────────────────────────────────────
// QUALITY LABELS
// ─────────────────────────────────────────────────────────────

/** Canonical quality labels ordered by rank (lowest → highest). */
export const QUALITY_LABELS = Object.freeze(['CAM', '360p', '480p', '720p', '1080p', '2160p', '4K', 'HDR']);

/** Quality label → emoji mapping for UI. */
export const QUALITY_EMOJI = Object.freeze({
	CAM: '📹',
	'360p': '📺',
	'480p': '📺',
	'720p': '🎬',
	'1080p': '🎞',
	'2160p': '🔷',
	'4K': '🔷',
	HDR: '✨',
});

// ─────────────────────────────────────────────────────────────
// CONTENT TYPES
// ─────────────────────────────────────────────────────────────

/** Supported media content types. */
export const CONTENT_TYPES = Object.freeze({
	MOVIE: 'movie',
	SERIES: 'series',
	ANIME: 'anime',
	WEB_SERIES: 'web_series',
	SHORT: 'short',
	DOCUMENTARY: 'documentary',
});

// ─────────────────────────────────────────────────────────────
// RATE LIMITS
// ─────────────────────────────────────────────────────────────

/** Rate limit configuration (all durations in seconds). */
export const RATE_LIMITS = Object.freeze({
	SEARCH_COOLDOWN_SEC: 3,
	BUTTON_COOLDOWN_SEC: 2,
	DAILY_SEARCH_LIMIT: 50,
	DAILY_SEARCH_PREMIUM: 500,
	FLOOD_THRESHOLD: 5, // messages in FLOOD_WINDOW_SEC
	FLOOD_WINDOW_SEC: 10,
	BLOCK_DURATION_SEC: 60,
});

// ─────────────────────────────────────────────────────────────
// KV TTL VALUES (seconds)
// ─────────────────────────────────────────────────────────────

/** KV cache TTLs. */
export const KV_TTL = Object.freeze({
	SEARCH_RESULT: 300, // 5 min
	IMDB_META: 86_400, // 24 h
	POSTER: 604_800, // 7 days
	RATE_LIMIT: 86_400, // 24 h (daily counter)
	FLOOD_WINDOW: 10,
	USER_SESSION: 3_600, // 1 h
	SETTINGS: 600, // 10 min
	TRENDING: 3_600, // 1 h
	FORCE_SUB: 300, // 5 min
});

// ─────────────────────────────────────────────────────────────
// KV KEY PREFIXES
// ─────────────────────────────────────────────────────────────

/** KV namespace key prefixes — use kv.key() helper. */
export const KV_KEYS = Object.freeze({
	SEARCH: 'search:',
	IMDB: 'imdb:',
	POSTER: 'poster:',
	RATE_SEARCH: 'rate:search:',
	RATE_DAILY: 'rate:daily:',
	FLOOD: 'flood:',
	SESSION: 'session:',
	SETTINGS: 'settings:global',
	TRENDING: 'trending:movies',
	FORCE_SUB: 'forcesub:',
	USER_PREFS: 'prefs:',
});

// ─────────────────────────────────────────────────────────────
// OMDB / IMDB
// ─────────────────────────────────────────────────────────────

export const OMDB_BASE_URL = 'https://www.omdbapi.com/';
export const POSTER_API_URL = 'https://symmetrical-winner-x5pv496pqvvqfv5g7-3000.app.github.dev/api/movies';
export const IMDB_SUGGEST = 'https://v3.sg.media-imdb.com/suggestion';
export const IMDB_TITLE_BASE = 'https://www.imdb.com/title';
export const IMDB_FIND_BASE = 'https://www.imdb.com/find';

// ─────────────────────────────────────────────────────────────
// BOT BRANDING
// ─────────────────────────────────────────────────────────────

/** Bot display name used in welcome/info messages. */
export const BOT_NAME = 'Movie Time Bot';

/**
 * Welcome image URL shown on /start.
 * Replace with any publicly accessible image URL you prefer.
 * e.g. a Movie Time neon banner hosted on Telegram or Imgur.
 */
export const WELCOME_IMAGE_URL = 'https://lh3.googleusercontent.com/d/155KpcvTzfpTT6Eu-vJsUB0gZ-ly9j6-G'; // Google Drive direct image URL

/** Auto-delete timer (seconds) shown in search result footer. */
export const AUTO_DELETE_SECONDS = 300;

// ─────────────────────────────────────────────────────────────
// TELEGRAM PARSE MODES
// ─────────────────────────────────────────────────────────────

export const PARSE_MODE = Object.freeze({
	HTML: 'HTML',
	MARKDOWN: 'MarkdownV2',
	NONE: undefined,
});

// ─────────────────────────────────────────────────────────────
// SEARCH CONFIG
// ─────────────────────────────────────────────────────────────

export const SEARCH = Object.freeze({
	DEFAULT_LIMIT: 10,
	MAX_LIMIT: 20,
	MIN_QUERY_LENGTH: 2,
	MAX_QUERY_LENGTH: 100,
	FUZZY_THRESHOLD: 0.6, // Levenshtein similarity ≥ 0.6 qualifies
	RESULTS_PER_PAGE: 10,
	INLINE_RESULTS_LIMIT: 8,
});

// ─────────────────────────────────────────────────────────────
// USER ROLES
// ─────────────────────────────────────────────────────────────

export const ROLES = Object.freeze({
	USER: 'user',
	PREMIUM: 'premium',
	MODERATOR: 'moderator',
	ADMIN: 'admin',
	SUPERADMIN: 'superadmin',
});

// ─────────────────────────────────────────────────────────────
// ADMIN ACTIONS
// ─────────────────────────────────────────────────────────────

export const ADMIN_ACTIONS = Object.freeze({
	BROADCAST: 'broadcast',
	BAN: 'ban',
	UNBAN: 'unban',
	ADD_ADMIN: 'add_admin',
	REMOVE_ADMIN: 'remove_admin',
	DELETE_MOVIE: 'delete_movie',
	DELETE_FILE: 'delete_file',
	REINDEX: 'reindex',
});

// ─────────────────────────────────────────────────────────────
// BROADCAST STATUS
// ─────────────────────────────────────────────────────────────

export const BROADCAST_STATUS = Object.freeze({
	DRAFT: 'draft',
	SENDING: 'sending',
	DONE: 'done',
	FAILED: 'failed',
});

// ─────────────────────────────────────────────────────────────
// QUEUE JOB TYPES
// ─────────────────────────────────────────────────────────────

/** Types used in Cloudflare Queue messages. */
export const QUEUE_JOBS = Object.freeze({
	BROADCAST: 'broadcast',
	INDEX_FILE: 'index_file',
	DELETE_MESSAGE: 'delete_message',
	ANALYTICS: 'analytics',
	CLEANUP: 'cleanup',
	NOTIFY: 'notify',
});

// ─────────────────────────────────────────────────────────────
// ANALYTICS EVENTS
// ─────────────────────────────────────────────────────────────

export const EVENTS = Object.freeze({
	SEARCH: 'search',
	SEARCH_EMPTY: 'search_empty',
	FILE_SENT: 'file_sent',
	USER_JOINED: 'user_joined',
	USER_BANNED: 'user_banned',
	MOVIE_INDEXED: 'movie_indexed',
	BROADCAST_DONE: 'broadcast_done',
	ERROR: 'error',
	COMMAND: 'command',
	INLINE_QUERY: 'inline_query',
});

// ─────────────────────────────────────────────────────────────
// DEFAULT SETTINGS
// ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = Object.freeze({
	maintenance: false,
	force_subscribe: false,
	auto_filter: true,
	auto_index: true,
	auto_delete: false,
	auto_delete_timer: 300,
	private_mode: false,
	group_mode: true,
	max_results: 10,
	search_cooldown: 3,
	daily_search_limit: 50,
});

// ─────────────────────────────────────────────────────────────
// EMOJI UI CONSTANTS
// ─────────────────────────────────────────────────────────────

export const EMOJI = Object.freeze({
	MOVIE: '🎬',
	STAR: '⭐',
	GLOBE: '🌎',
	FILM: '🎞',
	DISK: '💾',
	CALENDAR: '📅',
	CLOCK: '🕐',
	INFO: 'ℹ️',
	SEARCH: '🔍',
	CHECK: '✅',
	CROSS: '❌',
	WARNING: '⚠️',
	FIRE: '🔥',
	CROWN: '👑',
	ROBOT: '🤖',
	LOCK: '🔒',
	HEART: '❤️',
	BOOKMARK: '🔖',
	ARROW_RIGHT: '▶️',
	LOADING: '⏳',
	QUALITY: '📡',
	DIRECTOR: '🎥',
	CAST: '🎭',
	GENRE: '🏷',
	RATING: '📊',
	COUNTRY: '🌍',
	RUNTIME: '⏱',
	LANGUAGE: '🗣',
	TRAILER: '▶️',
	DOWNLOAD: '⬇️',
	NEW: '🆕',
	TRENDING: '📈',
});

// ─────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────

export const ERROR_CODES = Object.freeze({
	NOT_FOUND: 'NOT_FOUND',
	UNAUTHORIZED: 'UNAUTHORIZED',
	RATE_LIMITED: 'RATE_LIMITED',
	BANNED: 'BANNED',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	DB_ERROR: 'DB_ERROR',
	TELEGRAM_ERROR: 'TELEGRAM_ERROR',
	OMDB_ERROR: 'OMDB_ERROR',
	MAINTENANCE: 'MAINTENANCE',
	FORCE_SUB: 'FORCE_SUB',
	DUPLICATE: 'DUPLICATE',
	INTERNAL: 'INTERNAL',
});

// ─────────────────────────────────────────────────────────────
// FILE TYPE DETECTION PATTERNS
// ─────────────────────────────────────────────────────────────

/** Regex patterns used by FilenameParser to extract metadata. */
export const FILENAME_PATTERNS = Object.freeze({
	QUALITY: /\b(480p|720p|1080p|2160p|4K|UHD|HDR|CAM|HDCAM|DVDRip|BluRay|WEBRip|WEB-DL|HDTV|BDRip)\b/i,
	YEAR: /\b(19|20)\d{2}\b/,
	SEASON: /[Ss](\d{1,2})/,
	EPISODE: /[Ee](\d{1,3})/,
	CODEC: /\b(x264|x265|HEVC|AV1|H\.264|H\.265|xvid|divx)\b/i,
	AUDIO: /\b(AAC|AC3|DTS|DD5\.1|Dolby|Atmos|TrueHD|FLAC|MP3|EAC3)\b/i,
	LANGUAGE: /\b(Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Punjabi|Dual\.Audio|Multi\.Audio|ESub)\b/i,
	DUAL_AUDIO: /dual[\s._-]?audio|dual[\s._-]?lang/i,
	HDR: /\b(HDR|HDR10|HDR10\+|Dolby\.Vision|DV)\b/i,
	HEVC: /\b(HEVC|x265|H\.265)\b/i,
	SIZE: /(\d+(?:\.\d+)?)\s*(MB|GB|KB)/i,
	EXTENSION: /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|3gp|ts|m2ts)$/i,
});

// ─────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────

export const PAGINATION = Object.freeze({
	DEFAULT_PAGE: 1,
	RESULTS_PER_PAGE: 10,
	MAX_PAGES: 20,
});

// ─────────────────────────────────────────────────────────────
// HTTP STATUS
// ─────────────────────────────────────────────────────────────

export const HTTP = Object.freeze({
	OK: 200,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
});
