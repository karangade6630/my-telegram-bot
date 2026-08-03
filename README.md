# Production-Grade Telegram Movie AutoFilter Bot 🎬

An enterprise-level, production-ready, fully serverless Telegram Movie AutoFilter Bot built on **Cloudflare Workers**, **Cloudflare D1 (SQLite)**, **Cloudflare KV**, and **Cloudflare Queues**.

---

## 📌 Table of Contents
1. [Overview & Architecture](#-overview--architecture)
2. [Complete Feature List](#-complete-feature-list)
3. [Technology Stack](#-technology-stack)
4. [Project Directory Breakdown](#-project-directory-breakdown)
5. [Database Schema (D1 SQLite)](#-database-schema-d1-sqlite)
6. [Multi-Stage Search Engine](#-multi-stage-search-engine)
7. [OMDB & IMDb Multi-Stage Metadata Pipeline](#-omdb--imdb-multi-stage-metadata-pipeline)
8. [Step-by-Step Installation & Setup Guide](#-step-by-step-installation--setup-guide)
9. [How to Use (User & Admin Guide)](#-how-to-use-user--admin-guide)
10. [Security & Performance Optimizations](#-security--performance-optimizations)

---

## 🌟 Overview & Architecture

This bot is designed to handle over **100,000+ active users** using a modular, serverless architecture on Cloudflare Workers:

- **Zero Re-uploading / Zero Storage Abuse**: Files sent to users utilize Telegram's native `file_id` mechanism. Files are never downloaded or re-uploaded to third-party servers.
- **Route-Based Webhook Handler**: Isolated HTTP entry points (`src/routes/webhook.js`) for lightning-fast request routing and easy maintenance.
- **Repository Pattern & Data Decoupling**: All database interactions use prepared statements split across 9 dedicated repositories (`UserRepository`, `MovieRepository`, `FileRepository`, etc.).
- **Cache-First Performance**: Heavy queries and metadata lookups are cached in Cloudflare KV with instant fallbacks to D1.

---

## 🚀 Complete Feature List

### 👤 User Features
- **Instant AutoFilter Movie Search**: Users send a movie or series title (e.g. `Avengers Endgame`). The bot returns movie details (poster, IMDb rating, cast, genre, language) with interactive quality buttons (`480p`, `720p`, `1080p`, `4K`).
- **One-Click File Delivery**: Clicking any quality button instantly delivers the Telegram file via `file_id`.
- **Inline Mode (`@BotUsername Movie Name`)**: Search movies directly from any Telegram chat or group without adding the bot.
- **Paginated Results**: Search results with more than 5 matches feature inline `◀️ Prev` and `Next ▶️` pagination controls.
- **Multi-Category Support**: Automatically parses and tags Movies, TV Series, Anime, and Web Series.
- **User Engagement**: Support for Watchlists, Favorites, and Search History tracking.

### 🎥 Channel Auto-Indexing Engine
- **Automatic Channel Post Interception**: Add the bot as an administrator in your private file storage channels.
- **Smart Metadata Extraction**: Automatically parses filenames and captions for:
  - Movie / Series Title
  - Release Year
  - Quality (`480p`, `720p`, `1080p`, `2160p`, `CAM`)
  - Codec (`x264`, `x265`, `HEVC`, `AV1`)
  - Audio Tracks (`Hindi`, `English`, `Dual Audio`, `Multi Audio`)
  - Season & Episode numbers (`S01E05`)
  - File size & resolution
- **Duplicate Detection**: Uses Telegram `file_unique_id` to prevent duplicate file entries in D1.

### 🛡️ Admin Panel & Management
- **Dashboard Metrics (`/stats`)**: Real-time stats on total users, total movies, indexed files, and database metrics.
- **Mass User Broadcast**: Queue-backed chunked mass messaging that safely broadcasts announcements to thousands of active users without hitting Telegram rate limits.
- **User Management (`/ban`, `/unban`)**: Ban abusive users from interacting with the bot.
- **Channel Management**: Manage index source channels and force-subscribe requirements.

---

## 🛠️ Technology Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Runtime** | Cloudflare Workers | Serverless JavaScript (ES Modules, `nodejs_compat`) |
| **Database** | Cloudflare D1 | Serverless SQLite database with prepared statements |
| **Cache** | Cloudflare KV | Low-latency key-value store for search results & IMDb cache |
| **Queue** | Cloudflare Queues | Async background queue for broadcasting & background analytics |
| **Scheduler** | Cron Triggers | Daily scheduled task for log cleanup and analytics rotation |
| **API Integration** | OMDB & IMDb | Multi-stage metadata pipeline for posters, rating & cast |

---

## 📂 Project Directory Breakdown

```
my-telegram-bot/
├── wrangler.jsonc             # Cloudflare Worker configuration (D1, KV, Queue, Cron bindings)
├── package.json               # Node.js dependencies and deploy scripts
├── README.md                  # Complete project documentation
└── src/
    ├── index.js               # Worker entry point (Fetch, Queue, Scheduled handlers)
    ├── config/                # Environment bindings config & central constants
    │   ├── constants.js       # Commands, callbacks, quality labels, TTLs, emojis
    │   └── index.js           # Environment parser & config factory
    ├── database/
    │   └── schema.sql         # 24 normalized D1 database tables with indexes
    ├── dto/                   # Data Transfer Objects (MovieResponse, FileResponse, etc.)
    ├── events/                # Domain event classes (MovieIndexed, UserJoined, etc.)
    ├── featureFlags/          # Runtime feature flags & KV overrides
    ├── handlers/              # Telegram Update Handlers (Command, Callback, Inline, Admin)
    ├── helpers/               # UI formatters and keyboard builders
    ├── interfaces/            # JSDoc Contracts (Repository, Cache, Queue, Storage)
    ├── middleware/            # Security verification, Rate limiting, Ban check, Force sub
    ├── models/                # Domain Models (Movie, File, User, Channel)
    ├── parsers/               # Filename, Caption, and Movie metadata parsers
    ├── queue/                 # Cloudflare Queue job processors (BroadcastJob, AnalyticsJob)
    ├── repositories/          # D1 Data Access Layer (Movie, File, User, Channel, etc.)
    ├── routes/                # Webhook HTTP route container (`webhook.js`)
    ├── scheduler/             # Scheduled cron tasks (`CleanupScheduler.js`)
    ├── search/                # Multi-strategy search pipeline (Exact, Fuzzy, Tokenized, Ranking)
    ├── services/              # Business logic (Search, Indexing, OMDB, RateLimit, Cache)
    ├── telegram/              # Split Telegram API wrappers (messages, media, callback, chat)
    ├── utils/                 # Logger, Levenshtein string matching, Time utilities
    ├── validation/            # Domain & command validators
    └── workers/               # Worker event consumers (QueueWorker, ScheduledWorker)
```

---

## 🗄️ Database Schema (D1 SQLite)

The D1 database consists of **24 normalized tables** designed for high throughput:

- `users`: User profiles, Telegram user IDs, search counts, admin/banned/premium flags.
- `movies`: Canonical movie records (`slug`, `title`, `year`, `genre`, `imdb_id`, `imdb_rating`, `poster_url`, `popularity_score`).
- `files`: Indexed Telegram files storing `telegram_file_id`, `unique_id`, `quality`, `size`, `codec`, `language`, `channel_id`, `message_id`.
- `movie_files`: Many-to-many junction linking movies to multiple file qualities.
- `channels`: Tracked Telegram channels for auto-indexing.
- `search_history` & `watchlist` & `favorites`: User engagement tables.
- `broadcast`: Broadcast status and analytics logs.
- `force_sub`: Required channels for forced subscription checks.
- `analytics` & `logs`: Structured analytics events and system logs.

---

## 🔍 Multi-Stage Search Engine

When a user types a query like `Avengers Endgame`, the search engine executes a multi-stage fallback pipeline:

1. **Stage 1 (Exact Match)**: Executes `LOWER(title) = ?` on `movies`.
2. **Stage 2 (LIKE Contains)**: Executes `LOWER(title) LIKE ?` across `movies`.
3. **Stage 3 (Tokenized Multi-Term)**: Splits query into tokens (e.g. `['avengers', 'endgame']`) and executes `AND LIKE ?` for each token.
4. **Stage 4 (Levenshtein Fuzzy Search)**: Calculates string edit distance against candidate titles using a similarity score threshold ($\ge 0.6$).
5. **Ranking Engine**: Sorts output using a composite score based on IMDb Rating ($30\%$), Popularity Score ($25\%$), Recency ($20\%$), Exact Match ($15\%$), and Search Count ($10\%$).

---

## 🎬 OMDB & IMDb Multi-Stage Metadata Pipeline

When indexing new files or searching movies:

1. **OMDB API Query**: Queries OMDB by title and optional year.
2. **Title Variant Generator**: Generates clean variations (stripping articles, noise words, punctuation).
3. **IMDb Suggestion API Fallback**: Queries IMDb's direct suggestion API (`v3.sg.media-imdb.com/suggestion`) to extract the exact `tt` IMDb ID and poster image URL.
4. **Poster Link Storage**: High-resolution poster image URLs are stored directly in D1's `poster_url` column and cached in Cloudflare KV.

---

## 📦 Step-by-Step Installation & Setup Guide

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd my-telegram-bot
npm install
```

### 2. Configure Cloudflare Bindings
Ensure your `wrangler.jsonc` has your D1 Database ID and KV Namespace ID configured:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "movie_bot",
    "database_id": "<YOUR_D1_DATABASE_ID>",
    "remote": true
  }
],
"kv_namespaces": [
  {
    "binding": "KV",
    "id": "<YOUR_KV_NAMESPACE_ID>",
    "remote": true
  }
]
```

### 3. Initialize D1 Database Tables
Run the schema initialization against your remote Cloudflare D1 database:

```bash
npx wrangler d1 execute movie_bot --remote --file=./src/database/schema.sql
```

### 4. Set Worker Secrets
Set your sensitive credentials in Cloudflare Worker Secrets:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put OMDB_API_KEY
npx wrangler secret put ADMIN_IDS
```
*(Optionally set `WEBHOOK_SECRET` for header verification)*.

### 5. Deploy to Cloudflare Workers
```bash
npm run deploy
```

### 6. Register Telegram Webhook
Register your worker URL with Telegram Bot API:

```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"url":"https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/webhook","allowed_updates":["message","callback_query","inline_query","channel_post"]}'
```

---

## 📖 How to Use (User & Admin Guide)

### 1. User Searching for Movies
1. Open a chat with your Telegram Bot.
2. Send `/start` to view the welcome message.
3. Type any movie title, e.g.:
   ```text
   Avatar The Way of Water
   ```
4. The bot will send a card containing the Movie Title, IMDb Rating, Cast, Poster, and Quality Buttons (`480p`, `720p`, `1080p`, `4K`).
5. Click any quality button to instantly receive the video file.

### 2. Auto-Indexing Channel Files (Admins)
1. Create a private Telegram channel for storage.
2. Add your bot to the channel as an **Administrator** with permission to read messages.
3. Upload or forward video files/documents into the channel with standard naming formats:
   ```text
   Inception.2010.1080p.BluRay.x265.HEVC.Dual.Audio.mkv
   ```
4. The bot will receive a `channel_post` update, extract metadata, create database entries in D1, and link the file's `file_id` automatically.

### 3. Admin Dashboard & Operations
- **/stats**: Displays real-time database metrics (total users, total movies indexed, total files).
- **/broadcast `<message>`**: Triggers a queue-backed announcement broadcast to all users.
- **/ban `<user_id>`**: Bans a user from searching or receiving files.
- **/unban `<user_id>`**: Unbans a user.

---

## 🛡️ Security & Performance Optimizations

- **SQL Injection Prevention**: $100\%$ of D1 database interactions utilize parameterized prepared statements (`db.prepare().bind()`).
- **Flood Protection & Cooldowns**: Built-in rate-limiting service backed by KV sliding windows to prevent spam queries.
- **Serverless Scaling**: Built from the ground up to run on Cloudflare Workers with global edge latency ($< 10\text{ms}$ execution time).
