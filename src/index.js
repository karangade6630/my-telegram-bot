import { handleWebhookRequest } from './routes/webhook.js';
import { QueueWorker } from './workers/queueWorker.js';
import { ScheduledWorker } from './workers/scheduledWorker.js';
import { FileRepository } from './repositories/FileRepository.js';
import { MovieRepository } from './repositories/MovieRepository.js';
import { OmdbService } from './services/omdbService.js';
import { FilenameParser } from './parsers/FilenameParser.js';
import { mergeCommaValues } from './utils/stringUtils.js';
import cors from 'cors';

// Migration guard: when the project owner allows duplicate imdb_id values, remove the UNIQUE constraint
// from the movies.imdb_id column by rebuilding the table without UNIQUE. This migration runs once per
// worker startup (guarded) when the DB appears to have a UNIQUE index on imdb_id.
let _imdbDupMigrationDone = false;

async function ensureAllowDuplicateImdb(db) {
	if (!db || _imdbDupMigrationDone) return;
	try {
		// Check indexes on movies for a unique index covering imdb_id
		const idxListRes = await db.prepare("PRAGMA index_list('movies')").all();
		const idxList = idxListRes.results ?? idxListRes;
		let uniqueImdbIndex = null;
		for (const idx of idxList) {
			if (!idx.name) continue;
			if (idx.unique) {
				const idxInfoRes = await db.prepare(`PRAGMA index_info(${idx.name})`).all();
				const idxInfo = idxInfoRes.results ?? idxInfoRes;
				if (idxInfo.some((c) => c.name === 'imdb_id')) {
					uniqueImdbIndex = idx.name;
					break;
				}
			}
		}

		if (!uniqueImdbIndex) {
			_imdbDupMigrationDone = true;
			return;
		}

		console.info('[migrate] Removing UNIQUE constraint on movies.imdb_id by rebuilding table (using D1 transaction)');

		// Use D1's transaction API instead of manual BEGIN/COMMIT to avoid D1 errors
		await db.transaction(async (tx) => {
			// Turn off foreign keys while altering schema inside the transaction
			await tx.prepare('PRAGMA foreign_keys = OFF').run();
			// Create new table without UNIQUE on imdb_id
			await tx
				.prepare(
					`
			CREATE TABLE IF NOT EXISTS movies_new (
			  id               INTEGER PRIMARY KEY AUTOINCREMENT,
			  slug             TEXT    NOT NULL UNIQUE,
			  title            TEXT    NOT NULL,
			  original_title   TEXT,
			  year             INTEGER,
			  type             TEXT    NOT NULL DEFAULT 'movie',
			  language         TEXT,
			  genre            TEXT,
			  description      TEXT,
			  director         TEXT,
			  cast             TEXT,
			  country          TEXT,
			  runtime          TEXT,
			  content_rating   TEXT,
			  imdb_id          TEXT,
			  imdb_rating      REAL,
			  imdb_votes       TEXT,
			  trailer_url      TEXT,
			  poster_url       TEXT,
			  popularity_score INTEGER NOT NULL DEFAULT 0,
			  search_count     INTEGER NOT NULL DEFAULT 0,
			  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
			)
			`,
				)
				.run();
			// Copy data into new table (preserve columns)
			await tx
				.prepare(
					`INSERT INTO movies_new (id, slug, title, original_title, year, type, language, genre, description, director, cast, country, runtime, content_rating, imdb_id, imdb_rating, imdb_votes, trailer_url, poster_url, popularity_score, search_count, created_at, updated_at)
			SELECT id, slug, title, original_title, year, type, language, genre, description, director, cast, country, runtime, content_rating, imdb_id, imdb_rating, imdb_votes, trailer_url, poster_url, popularity_score, search_count, created_at, updated_at FROM movies`,
				)
				.run();
			// Drop old table and rename new one
			await tx.prepare('DROP TABLE movies').run();
			await tx.prepare('ALTER TABLE movies_new RENAME TO movies').run();
			// Recreate indexes (non-unique for imdb_id)
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_language ON movies(language)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_imdb_id ON movies(imdb_id)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_popularity ON movies(popularity_score DESC)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_search_count ON movies(search_count DESC)').run();
			await tx.prepare('CREATE INDEX IF NOT EXISTS idx_movies_updated ON movies(updated_at DESC)').run();
			// Re-enable foreign keys
			await tx.prepare('PRAGMA foreign_keys = ON').run();
		});
		console.info('[migrate] Migration complete: imdb_id uniqueness removed');
		_imdbDupMigrationDone = true;
	} catch (err) {
		console.error('[migrate] Migration failed', err);
		// Allow retry on the next request if migration failed
		_imdbDupMigrationDone = false;
	}
}

export default {
	/**
	 * HTTP Webhook & API Handler
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		const addCors = (resp) => {
			if (!resp) return resp;
			const headers = new Headers(resp.headers || {});
			headers.set('Access-Control-Allow-Origin', '*');
			headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
			headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
			return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
		};

		if (request.method === 'OPTIONS') {
			return addCors(new Response(null, { status: 204 }));
		}

		let response = null;

		// Ensure migration to allow duplicate imdb_id runs once before handling requests
		if (env && env.DB) {
			await ensureAllowDuplicateImdb(env.DB);
		}

		// API route for frontend to fetch file details
		if (request.method === 'GET' && url.pathname === '/api/file-info') {
			response = await handleFileInfoRequest(request, env);
		} else if (request.method === 'GET' && url.pathname === '/api/recent-movies') {
			response = await handleRecentMoviesRequest(request, env);
		} else if (request.method === 'POST' && url.pathname === '/api/admin/login') {
			response = await handleAdminLogin(request, env);
		} else if (request.method === 'GET' && url.pathname === '/api/admin/movies') {
			response = await handleAdminListMovies(request, env);
		} else if (request.method === 'POST' && url.pathname === '/api/admin/movies/update') {
			response = await handleAdminUpdateMovie(request, env);
		} else if (request.method === 'POST' && url.pathname === '/api/admin/movies/delete') {
			response = await handleAdminDeleteMovie(request, env);
		} else if (request.method === 'GET' && url.pathname === '/api/admin/omdb-search') {
			response = await handleAdminOmdbSearch(request, env);
		} else if (request.method === 'POST' && url.pathname === '/api/admin/movies/migrate-remove-imdb-unique') {
			response = await handleRunImdbMigration(request, env);
		} else if (request.method === 'GET' && url.pathname === '/api/admin/movies/migration-status') {
			response = await handleMigrationStatus(request, env);
		} else if (request.method === 'POST' && url.pathname === '/webhook') {
			response = await handleWebhookRequest(request, env);
		} else {
			response = await env.ASSETS.fetch(request);
		}

		return addCors(response);
	},

	/**
	 * Cloudflare Queue Consumer Handler
	 */
	async queue(batch, env, ctx) {
		await QueueWorker.process(batch, env);
	},

	/**
	 * Cloudflare Cron Trigger Scheduler Handler
	 */
	async scheduled(event, env, ctx) {
		await ScheduledWorker.handle(event, env);
	},
};

async function handleFileInfoRequest(request, env) {
	const url = new URL(request.url);
	const fileIdStr = url.searchParams.get('fileId');
	const movieIdStr = url.searchParams.get('movieId');
	const tStr = url.searchParams.get('t');

	const now = Date.now();
	const t = Number(tStr);
	const TEN_MINUTES_MS = 10 * 60 * 1000;

	// Check if timestamp is missing or older than 10 minutes (600,000 ms)
	if (!tStr || isNaN(t) || now - t > TEN_MINUTES_MS || t > now + 60000) {
		return Response.json(
			{
				ok: false,
				expired: true,
				message: 'Link expired or invalid (valid for 10 minutes from Telegram).',
			},
			{ status: 410 },
		);
	}

	if (!env.DB) {
		return Response.json({ ok: false, message: 'Database unavailable' }, { status: 503 });
	}

	// Run migration to allow duplicate imdb_id values if needed (one-time guard)
	await ensureAllowDuplicateImdb(env.DB);

	const fileRepo = new FileRepository(env.DB);
	const movieRepo = new MovieRepository(env.DB);

	let file = null;
	let movie = null;

	if (fileIdStr) {
		const fileId = parseInt(fileIdStr, 10);
		file = await fileRepo.findById(fileId);
		if (file && file.movieId) {
			movie = await movieRepo.findById(file.movieId);
		}
	} else if (movieIdStr) {
		const movieId = parseInt(movieIdStr, 10);
		movie = await movieRepo.findById(movieId);
		const files = await fileRepo.findByMovieId(movieId);
		if (files && files.length > 0) {
			file = files[0];
		}
	}

	if (!file && !movie) {
		return Response.json({ ok: false, message: 'Content not found' }, { status: 404 });
	}

	// ── On-demand metadata enrichment ─────────────────────────
	// If movie exists but is missing key metadata, try to fetch now
	if (movie && (!movie.description || !movie.imdbRating || !movie.genre)) {
		try {
			const omdb = new OmdbService();
			const cleanTitle = FilenameParser.cleanMovieTitle(movie.title);
			const meta = await omdb.fetchMovieMetadata(cleanTitle, movie.year);
			if (meta) {
				const updateData = {};
				if (!movie.imdbId && meta.imdbId) updateData.imdb_id = meta.imdbId;
				if (!movie.imdbRating && meta.imdbRating) updateData.imdb_rating = meta.imdbRating;
				if (!movie.imdbVotes && meta.ratingCount) updateData.imdb_votes = meta.ratingCount;
				if (!movie.description && meta.description) updateData.description = meta.description;
				if (!movie.genre && meta.genre) updateData.genre = meta.genre;
				if (!movie.director && meta.directors) updateData.director = meta.directors;
				if (!movie.cast && meta.cast) updateData.cast = meta.cast;
				if (!movie.runtime && meta.duration) updateData.runtime = meta.duration;
				if (!movie.contentRating && meta.contentRating) updateData.content_rating = meta.contentRating;
				if (!movie.posterUrl && meta.posterUrl) updateData.poster_url = meta.posterUrl;

				if (Object.keys(updateData).length > 0) {
					await movieRepo.updateMetadata(movie.id, updateData);
					// Refresh movie object with updated data
					movie = await movieRepo.findById(movie.id);
				}
			}
		} catch (_) {
			// Enrichment failure is non-fatal
		}
	}

	const botUsername = (env.BOT_USERNAME || 'movie_time_v1_bot').replace(/^@/, '');

	return Response.json({
		ok: true,
		botUsername,
		token: t,
		file: file
			? {
					id: file.id,
					fileName: file.fileName || file.qualityLabel || 'Movie File',
					size: file.size || 'N/A',
					sizeBytes: file.sizeBytes,
					quality: file.qualityLabel || file.quality || 'HD',
					resolution: file.resolution,
					language: file.language,
					audioTracks: file.audioTracks,
					subtitle: file.subtitle,
					codec: file.codec,
					isHevc: file.isHevc,
					isHdr: file.isHdr,
					isDualAudio: file.isDualAudio,
					season: file.season,
					episode: file.episode,
					episodeString: file.episodeString,
					fileType: file.fileType || 'document',
					caption: file.caption,
				}
			: null,
		movie: movie
			? {
					id: movie.id,
					title: movie.title,
					originalTitle: movie.originalTitle,
					year: movie.year,
					type: movie.type,
					language: movie.language,
					genre: movie.genre,
					description: movie.description || movie.overview,
					director: movie.director,
					cast: movie.cast,
					country: movie.country,
					runtime: movie.runtime,
					contentRating: movie.contentRating,
					imdbRating: movie.imdbRating,
					imdbVotes: movie.imdbVotes,
					imdbUrl: movie.imdbUrl,
					posterUrl: movie.posterUrl,
					trailerUrl: movie.trailerUrl,
				}
			: null,
	});
}

async function handleRecentMoviesRequest(request, env) {
	if (!env.DB) {
		return Response.json({ ok: false, movies: [] });
	}
	try {
		const movieRepo = new MovieRepository(env.DB);
		const movies = await movieRepo.getRecent(12);
		return Response.json({
			ok: true,
			movies: movies.map((m) => ({
				id: m.id,
				title: m.title,
				originalTitle: m.originalTitle,
				year: m.year,
				type: m.type,
				language: m.language,
				genre: m.genre,
				description: m.description,
				director: m.director,
				cast: m.cast,
				runtime: m.runtime,
				imdbRating: m.imdbRating,
				posterUrl: m.posterUrl,
			})),
		});
	} catch (err) {
		return Response.json({ ok: false, movies: [] });
	}
}

async function handleAdminListMovies(request, env) {
	if (!env.DB) {
		return Response.json({ ok: false, message: 'Database unavailable' }, { status: 503 });
	}
	const url = new URL(request.url);
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const limit = parseInt(url.searchParams.get('limit') || '10', 10);
	const search = url.searchParams.get('search') || '';
	const genre = url.searchParams.get('genre') || '';

	const offset = (page - 1) * limit;
	const movieRepo = new MovieRepository(env.DB);

	try {
		const { movies, total } = await movieRepo.listPaginated({ limit, offset, search, genre });
		const totalPages = Math.ceil(total / limit) || 1;

		return Response.json({
			ok: true,
			movies: movies.map((m) => ({
				id: m.id,
				slug: m.slug,
				title: m.title,
				originalTitle: m.originalTitle,
				year: m.year,
				type: m.type,
				language: m.language,
				genre: m.genre,
				description: m.description,
				director: m.director,
				cast: m.cast,
				country: m.country,
				runtime: m.runtime,
				contentRating: m.contentRating,
				imdbRating: m.imdbRating,
				imdbVotes: m.imdbVotes,
				imdbId: m.imdbId,
				posterUrl: m.posterUrl,
				trailerUrl: m.trailerUrl,
				updatedAt: m.updatedAt,
			})),
			total,
			page,
			limit,
			totalPages,
		});
	} catch (err) {
		return Response.json({ ok: false, message: err.message }, { status: 500 });
	}
}

async function handleAdminUpdateMovie(request, env) {
	if (!env.DB) {
		return Response.json({ ok: false, message: 'Database unavailable' }, { status: 503 });
	}
	// Make sure existing D1 database allows duplicate imdb_id values
	await ensureAllowDuplicateImdb(env.DB);
	try {
		const body = await request.json();
		if (!body.id) {
			return Response.json({ ok: false, message: 'Movie ID is required' }, { status: 400 });
		}

		const movieRepo = new MovieRepository(env.DB);
		const existing = await movieRepo.findById(body.id);
		if (!existing) {
			return Response.json({ ok: false, message: 'Movie not found' }, { status: 404 });
		}

		const updateData = {};
		if (body.title !== undefined) updateData.title = body.title;
		if (body.originalTitle !== undefined) updateData.original_title = body.originalTitle;
		if (body.year !== undefined) updateData.year = body.year ? parseInt(body.year, 10) : null;
		if (body.type !== undefined) updateData.type = body.type;
		if (body.language !== undefined) updateData.language = body.language;
		if (body.genre !== undefined) updateData.genre = body.genre;
		if (body.description !== undefined) updateData.description = body.description;
		if (body.director !== undefined) updateData.director = body.director;
		if (body.cast !== undefined) updateData.cast = body.cast;
		if (body.country !== undefined) updateData.country = body.country;
		if (body.runtime !== undefined) updateData.runtime = body.runtime;
		if (body.contentRating !== undefined) updateData.content_rating = body.contentRating;
		if (body.posterUrl !== undefined) updateData.poster_url = body.posterUrl;
		if (body.trailerUrl !== undefined) updateData.trailer_url = body.trailerUrl;
		if (body.imdbRating !== undefined) updateData.imdb_rating = body.imdbRating ? parseFloat(body.imdbRating) : null;
		if (body.imdbVotes !== undefined) updateData.imdb_votes = body.imdbVotes ? String(body.imdbVotes) : null;
		if (body.imdbId !== undefined) updateData.imdb_id = body.imdbId;
		if (body.slug !== undefined) updateData.slug = body.slug;

		// If preview flag is set, compute affected rows and proposed changes without applying them
		if (body.preview) {
			const preview = await movieRepo.updateAndPropagate(body.id, updateData, { simulate: true });
			return Response.json({ ok: true, preview });
		}

		// Apply the update and propagate
		const result = await movieRepo.updateAndPropagate(body.id, updateData, { propagateFields: null });
		const updatedMovie = await movieRepo.findById(body.id);
		const affected = result?.affectedIds || [body.id];

		return Response.json({ ok: true, message: 'Movie updated successfully', movie: updatedMovie, affected });
	} catch (err) {
		// If UNIQUE constraint on imdb_id is still present in this DB, retry without imdb_id as a fallback.
		if (err && typeof err.message === 'string' && /UNIQUE constraint failed:\s*movies\.imdb_id/i.test(err.message)) {
			try {
				const body = await request.json().catch(() => ({}));
				const movieRepo = new MovieRepository(env.DB);
				const updateData = {};
				if (body.title !== undefined) updateData.title = body.title;
				if (body.originalTitle !== undefined) updateData.original_title = body.originalTitle;
				if (body.year !== undefined) updateData.year = body.year ? parseInt(body.year, 10) : null;
				if (body.type !== undefined) updateData.type = body.type;
				if (body.language !== undefined) updateData.language = body.language;
				if (body.genre !== undefined) updateData.genre = body.genre;
				if (body.description !== undefined) updateData.description = body.description;
				if (body.director !== undefined) updateData.director = body.director;
				if (body.cast !== undefined) updateData.cast = body.cast;
				if (body.country !== undefined) updateData.country = body.country;
				if (body.runtime !== undefined) updateData.runtime = body.runtime;
				if (body.contentRating !== undefined) updateData.content_rating = body.contentRating;
				if (body.posterUrl !== undefined) updateData.poster_url = body.posterUrl;
				if (body.trailerUrl !== undefined) updateData.trailer_url = body.trailerUrl;
				if (body.imdbRating !== undefined) updateData.imdb_rating = body.imdbRating ? parseFloat(body.imdbRating) : null;
				if (body.imdbVotes !== undefined) updateData.imdb_votes = body.imdbVotes ? String(body.imdbVotes) : null;
				// intentionally skip imdbId/imdb_id to avoid UNIQUE conflict
				if (body.slug !== undefined) updateData.slug = body.slug;

				const result = await movieRepo.updateAndPropagate(body.id, updateData, { propagateFields: null });
				const updatedMovie = await movieRepo.findById(body.id);
				const affected = result?.affectedIds || [body.id];
				return Response.json({ ok: true, message: 'Movie updated but imdb_id skipped due to uniqueness constraint on DB', movie: updatedMovie, affected });
			} catch (err2) {
				return Response.json({ ok: false, message: 'Update failed: ' + (err2.message || String(err2)) }, { status: 500 });
			}
		}

		return Response.json({ ok: false, message: err.message }, { status: 500 });
	}
}

async function handleAdminDeleteMovie(request, env) {
	if (!env.DB) {
		return Response.json({ ok: false, message: 'Database unavailable' }, { status: 503 });
	}
	try {
		const body = await request.json();
		if (!body.id) {
			return Response.json({ ok: false, message: 'Movie ID is required' }, { status: 400 });
		}

		const movieRepo = new MovieRepository(env.DB);
		await movieRepo.delete(body.id);

		return Response.json({ ok: true, message: 'Movie deleted successfully' });
	} catch (err) {
		return Response.json({ ok: false, message: err.message }, { status: 500 });
	}
}

// Run the imdb_id-uniqueness removal migration on demand (admin-only)
async function handleRunImdbMigration(request, env) {
	if (!env.DB) return Response.json({ ok: false, message: 'Database unavailable' }, { status: 503 });
	const logs = [];
	try {
		const body = await request.json().catch(() => ({}));
		const expected = env.ADMIN_PASSWORD || 'admin123';
		if (!body.password || body.password !== expected) {
			return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
		}

		// Report current indexes
		try {
			const beforeIdxRes = await env.DB.prepare("PRAGMA index_list('movies')").all();
			const beforeIdx = beforeIdxRes.results ?? beforeIdxRes;
			logs.push({ step: 'beforeIndexList', data: beforeIdx });
		} catch (e) {
			logs.push({ step: 'beforeIndexListError', error: String(e) });
		}

		// Attempt migration steps explicitly and capture each result or error
		try {
			logs.push({ step: 'migrationStart' });
			await env.DB.prepare('PRAGMA foreign_keys = OFF').run();
			logs.push({ step: 'foreign_keys_off' });

			await env.DB.prepare('BEGIN TRANSACTION').run();
			logs.push({ step: 'begin_transaction' });

			await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS movies_new (
			  id               INTEGER PRIMARY KEY AUTOINCREMENT,
			  slug             TEXT    NOT NULL UNIQUE,
			  title            TEXT    NOT NULL,
			  original_title   TEXT,
			  year             INTEGER,
			  type             TEXT    NOT NULL DEFAULT 'movie',
			  language         TEXT,
			  genre            TEXT,
			  description      TEXT,
			  director         TEXT,
			  cast             TEXT,
			  country          TEXT,
			  runtime          TEXT,
			  content_rating   TEXT,
			  imdb_id          TEXT,
			  imdb_rating      REAL,
			  imdb_votes       TEXT,
			  trailer_url      TEXT,
			  poster_url       TEXT,
			  popularity_score INTEGER NOT NULL DEFAULT 0,
			  search_count     INTEGER NOT NULL DEFAULT 0,
			  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
			)
			`).run();
			logs.push({ step: 'create_movies_new' });

			await env.DB.prepare(`INSERT INTO movies_new (id, slug, title, original_title, year, type, language, genre, description, director, cast, country, runtime, content_rating, imdb_id, imdb_rating, imdb_votes, trailer_url, poster_url, popularity_score, search_count, created_at, updated_at)
			SELECT id, slug, title, original_title, year, type, language, genre, description, director, cast, country, runtime, content_rating, imdb_id, imdb_rating, imdb_votes, trailer_url, poster_url, popularity_score, search_count, created_at, updated_at FROM movies`).run();
			logs.push({ step: 'copy_data' });

			await env.DB.prepare('DROP TABLE movies').run();
			logs.push({ step: 'drop_old_movies' });

			await env.DB.prepare("ALTER TABLE movies_new RENAME TO movies").run();
			logs.push({ step: 'rename_new_table' });

			// recreate indexes
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_language ON movies(language)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_imdb_id ON movies(imdb_id)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_popularity ON movies(popularity_score DESC)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_search_count ON movies(search_count DESC)').run();
			await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_movies_updated ON movies(updated_at DESC)').run();
			logs.push({ step: 'recreate_indexes' });

			await env.DB.prepare('COMMIT').run();
			logs.push({ step: 'commit' });

			await env.DB.prepare('PRAGMA foreign_keys = ON').run();
			logs.push({ step: 'foreign_keys_on' });

		} catch (mErr) {
			logs.push({ step: 'migrationError', error: String(mErr) });
			try { await env.DB.prepare('ROLLBACK').run(); logs.push({ step: 'rollback' }); } catch (e) { logs.push({ step: 'rollbackError', error: String(e) }); }
			try { await env.DB.prepare('PRAGMA foreign_keys = ON').run(); } catch (e) {}
			return Response.json({ ok: false, message: 'Migration failed', logs }, { status: 500 });
		}

		// Report indexes after migration
		try {
			const afterIdxRes = await env.DB.prepare("PRAGMA index_list('movies')").all();
			const afterIdx = afterIdxRes.results ?? afterIdxRes;
			logs.push({ step: 'afterIndexList', data: afterIdx });
		} catch (e) {
			logs.push({ step: 'afterIndexListError', error: String(e) });
		}

		return Response.json({ ok: true, message: 'Migration attempted', logs });
	} catch (err) {
		return Response.json({ ok: false, message: err.message, logs }, { status: 500 });
	}
}

// Check whether the movies.imdb_id column still has a UNIQUE index on the given DB
async function handleMigrationStatus(request, env) {
	if (!env.DB) return Response.json({ ok: false, message: 'Database unavailable' }, { status: 503 });
	try {
		const idxListRes = await env.DB.prepare("PRAGMA index_list('movies')").all();
		const idxList = idxListRes.results ?? idxListRes;
		let uniqueImdb = false;
		for (const idx of idxList) {
			if (!idx.name) continue;
			// If index is marked unique, check its columns
			if (idx.unique) {
				const idxInfoRes = await env.DB.prepare(`PRAGMA index_info(${idx.name})`).all();
				const idxInfo = idxInfoRes.results ?? idxInfoRes;
				if (idxInfo.some((c) => c.name === 'imdb_id')) {
					uniqueImdb = true;
					break;
				}
			}
		}
		return Response.json({ ok: true, uniqueImdb });
	} catch (err) {
		return Response.json({ ok: false, message: err.message }, { status: 500 });
	}
}

async function handleAdminOmdbSearch(request, env) {
	const url = new URL(request.url);
	const query = url.searchParams.get('query') || url.searchParams.get('title') || '';
	const year = url.searchParams.get('year') || null;

	if (!query) {
		return Response.json({ ok: false, message: 'Search query is required' }, { status: 400 });
	}

	try {
		const omdb = new OmdbService();
		const cleanTitle = FilenameParser.cleanMovieTitle(query);
		const meta = await omdb.fetchMovieMetadata(cleanTitle, year);

		if (!meta) {
			return Response.json({ ok: false, message: 'No metadata found for query: ' + cleanTitle });
		}

		return Response.json({
			ok: true,
			result: {
				title: meta.title || cleanTitle,
				year: meta.year || year,
				type: meta.type || 'movie',
				genre: meta.genre || null,
				language: meta.language || null,
				description: meta.description || null,
				director: meta.directors || null,
				cast: meta.cast || null,
				runtime: meta.duration || null,
				contentRating: meta.contentRating || null,
				imdbRating: meta.imdbRating || null,
				imdbVotes: meta.ratingCount || null,
				imdbId: meta.imdbId || null,
				posterUrl: meta.posterUrl || null,
			},
		});
	} catch (err) {
		return Response.json({ ok: false, message: err.message }, { status: 500 });
	}
}

async function handleAdminLogin(request, env) {
	try {
		const body = await request.json();
		const expectedPassword = env.ADMIN_PASSWORD || 'admin123';
		if (body.password === expectedPassword) {
			return Response.json({
				ok: true,
				message: 'Authentication successful',
				token: 'admin_session_token_' + Date.now(),
			});
		} else {
			return Response.json({ ok: false, message: 'Invalid admin password' }, { status: 401 });
		}
	} catch (err) {
		return Response.json({ ok: false, message: 'Login failed: ' + err.message }, { status: 500 });
	}
}
