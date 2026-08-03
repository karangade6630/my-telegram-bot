import { normalizeMovieTitle, isNonEmptyString } from '../utils/validation.js';

export class MovieSearchService {
	constructor(repository) {
		this.repository = repository;
	}

	async search(query) {
		const normalized = normalizeMovieTitle(query);

		if (!isNonEmptyString(normalized)) {
			return [];
		}

		const sql = `
      SELECT m.id, m.title, m.language, m.genre, m.year, m.poster_url,
             f.quality, f.size, f.telegram_file_id
      FROM movies m
      LEFT JOIN movie_files mf ON mf.movie_id = m.id
      LEFT JOIN files f ON f.id = mf.file_id
      WHERE LOWER(m.title) LIKE ?
      ORDER BY m.updated_at DESC
      LIMIT 10
    `;

		const rows = await this.repository.execute(sql, [`%${normalized.toLowerCase()}%`]);
		return rows.results ?? [];
	}
}
