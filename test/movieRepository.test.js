import { describe, it, expect, vi } from 'vitest';
import { MovieRepository } from '../src/repositories/MovieRepository.js';

describe('MovieRepository.updateAndPropagate', () => {
	it('returns preview changes when simulate=true', async () => {
		const repo = new MovieRepository({});

		// stub findById
		repo.findById = vi.fn().mockResolvedValue({ id: 1, title: 'Alliance', genre: 'Drama' });

		// stub all to return one matching row
		repo.all = vi.fn().mockResolvedValue([{ id: 2, title: 'Alliance S01 E01', genre: 'Drama', poster_url: null }]);

		// batch should not be called in simulate
		repo.batch = vi.fn();

		const data = { poster_url: 'https://example.com/poster.jpg', genre: 'Drama, Action' };
		const res = await repo.updateAndPropagate(1, data, { simulate: true });

		expect(res.affectedIds).toEqual([1, 2]);
		expect(res.preview).toBeDefined();
		expect(res.preview.find((p) => p.id === 1)).toBeDefined();
		expect(res.preview.find((p) => p.id === 2)).toBeDefined();
		expect(repo.batch).not.toHaveBeenCalled();
	});

	it('executes batch when simulate=false', async () => {
		const repo = new MovieRepository({});
		repo.findById = vi.fn().mockResolvedValue({ id: 10, title: 'Chum' });
		repo.all = vi.fn().mockResolvedValue([{ id: 11, title: 'Chum 2026', genre: null }]);
		repo.batch = vi.fn().mockResolvedValue([]);

		const data = { poster_url: 'https://x.jpg', genre: 'Thriller' };
		const res = await repo.updateAndPropagate(10, data, { simulate: false });

		expect(res.affectedIds).toEqual([10, 11]);
		expect(repo.batch).toHaveBeenCalled();
		expect(res.preview).toBeUndefined();
	});

	it('does not propagate matching rows when propagateFields is null', async () => {
		const repo = new MovieRepository({});
		repo.findById = vi.fn().mockResolvedValue({ id: 20, title: 'Nova' });
		repo.all = vi.fn().mockResolvedValue([{ id: 21, title: 'Nova S01', genre: 'Sci-Fi' }]);
		repo.batch = vi.fn().mockResolvedValue([]);

		const data = { poster_url: 'https://x.jpg', genre: 'Sci-Fi' };
		const res = await repo.updateAndPropagate(20, data, { propagateFields: null });

		expect(res.affectedIds).toEqual([20, 21]);
		expect(repo.batch).toHaveBeenCalled();
		const statements = repo.batch.mock.calls[0][0];
		expect(Array.isArray(statements)).toBe(true);
		expect(statements).toHaveLength(1);
		expect(statements[0].sql).toContain('UPDATE movies SET');
		expect(statements[0].sql).toContain('poster_url = ?');
		expect(statements[0].sql).toContain('genre = ?');
	});

	it('uses a capped safe LIKE pattern for long titles during preview', async () => {
		const longTitle = Array(40).fill('Star').concat(Array(40).fill('Trek')).join(' ');
		const repo = new MovieRepository({});
		repo.findById = vi.fn().mockResolvedValue({ id: 1, title: longTitle });
		repo.all = vi.fn().mockResolvedValue([]);
		repo.batch = vi.fn();

		await repo.updateAndPropagate(1, { description: 'New description' }, { simulate: true });

		expect(repo.all).toHaveBeenCalled();
		const pattern = repo.all.mock.calls[0][1][2];
		expect(typeof pattern).toBe('string');
		expect(pattern.length).toBeLessThanOrEqual(122);
		expect(pattern.startsWith('%')).toBe(true);
		expect(pattern.endsWith('%')).toBe(true);
	});

	it('allows duplicate imdb_id values to be applied when migration is enabled', async () => {
		const repo = new MovieRepository({});
		repo.findById = vi.fn().mockResolvedValue({ id: 100, title: 'Conflict Test' });
		// Simulate a match set
		repo.all = vi.fn().mockResolvedValue([{ id: 101, title: 'Conflict Test S01' }]);
		// Capture batch calls
		repo.batch = vi.fn().mockResolvedValue([]);

		const data = { imdbId: 'tt1234567', title: 'Conflict Title' };
		const res = await repo.updateAndPropagate(100, data, { simulate: false });

		expect(res.affectedIds).toEqual([100, 101]);
		// Ensure batch was called and imdb_id is included in statements (duplicates allowed)
		expect(repo.batch).toHaveBeenCalled();
		const statements = repo.batch.mock.calls[0][0];
		const sqlConcat = statements.map((s) => s.sql).join(' ');
		expect(sqlConcat.includes('imdb_id')).toBe(true);
	});
});
