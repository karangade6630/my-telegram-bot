import { handleWebhookRequest } from './routes/webhook.js';
import { QueueWorker } from './workers/queueWorker.js';
import { ScheduledWorker } from './workers/scheduledWorker.js';
import { FileRepository } from './repositories/FileRepository.js';
import { MovieRepository } from './repositories/MovieRepository.js';
import { OmdbService } from './services/omdbService.js';
import { FilenameParser } from './parsers/FilenameParser.js';
import { mergeCommaValues } from './utils/stringUtils.js';
import cors from 'cors';

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
