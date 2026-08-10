import { handleWebhookRequest } from './routes/webhook.js';
import { QueueWorker } from './workers/queueWorker.js';
import { ScheduledWorker } from './workers/scheduledWorker.js';
import { FileRepository } from './repositories/FileRepository.js';
import { MovieRepository } from './repositories/MovieRepository.js';
import { OmdbService } from './services/omdbService.js';
import { FilenameParser } from './parsers/FilenameParser.js';

export default {
	/**
	 * HTTP Webhook & API Handler
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// API route for frontend to fetch file details
		if (request.method === 'GET' && url.pathname === '/api/file-info') {
			return await handleFileInfoRequest(request, env);
		}

		if (request.method === 'GET' && url.pathname === '/api/recent-movies') {
			return await handleRecentMoviesRequest(request, env);
		}

		if (request.method === 'POST' && url.pathname === '/webhook') {
			return await handleWebhookRequest(request, env);
		}

		// Serve static frontend assets (SPA)
		return await env.ASSETS.fetch(request);
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
	if (!tStr || isNaN(t) || (now - t > TEN_MINUTES_MS) || (t > now + 60000)) {
		return Response.json(
			{
				ok: false,
				expired: true,
				message: 'Link expired or invalid (valid for 10 minutes from Telegram).',
			},
			{ status: 410 }
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

	// ── On-demand OMDb enrichment ─────────────────────────────
	// If movie exists but is missing key metadata, try to fetch from OMDb now
	if (movie && (!movie.description || !movie.imdbRating || !movie.genre) && env.OMDB_API_KEY) {
		try {
			const omdb = new OmdbService(env.OMDB_API_KEY);
			const cleanTitle = FilenameParser.cleanMovieTitle(movie.title);
			const meta = await omdb.fetchMovieMetadata(cleanTitle, movie.year);
			if (meta) {
				const updateData = {};
				if (!movie.imdbId && meta.imdbId)              updateData.imdb_id        = meta.imdbId;
				if (!movie.imdbRating && meta.imdbRating)       updateData.imdb_rating     = meta.imdbRating;
				if (!movie.imdbVotes && meta.ratingCount)       updateData.imdb_votes      = meta.ratingCount;
				if (!movie.description && meta.description)     updateData.description     = meta.description;
				if (!movie.genre && meta.genre)                 updateData.genre           = meta.genre;
				if (!movie.director && meta.directors)          updateData.director        = meta.directors;
				if (!movie.cast && meta.cast)                   updateData.cast            = meta.cast;
				if (!movie.runtime && meta.duration)            updateData.runtime         = meta.duration;
				if (!movie.contentRating && meta.contentRating) updateData.content_rating  = meta.contentRating;
				if (!movie.posterUrl && meta.imdbId)            updateData.poster_url      = `https://img.omdbapi.com/?apikey=${env.OMDB_API_KEY}&i=${meta.imdbId}`;

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
		file: file ? {
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
		} : null,
		movie: movie ? {
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
		} : null,
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


