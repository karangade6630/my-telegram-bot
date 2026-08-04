import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src';
import { SearchService } from '../src/services/searchService.js';

describe('Movie AutoFilter worker', () => {
	it('responds with the bot health status on GET / (unit style)', async () => {
		const request = new Request('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Bot is running!"`);
	});

	it('responds with the bot health status on GET / (integration style)', async () => {
		const response = await SELF.fetch('http://example.com');
		expect(await response.text()).toMatchInlineSnapshot(`"Bot is running!"`);
	});
});

describe('SearchService pagination', () => {
	it('uses the requested page offset for paginated searches', async () => {
		const movieRepo = {
			searchExact: vi.fn().mockResolvedValue({ rows: [{ id: 1, title: 'Test Movie' }], total: 5 }),
			searchContains: vi.fn(),
			searchByTokens: vi.fn(),
		};

		const service = new SearchService(movieRepo);
		const result = await service.search('test movie', { page: 2, limit: 2 });

		expect(movieRepo.searchExact).toHaveBeenCalledWith('test movie', expect.objectContaining({ limit: 2, offset: 2 }));
		expect(result.page).toBe(2);
		expect(result.totalPages).toBe(3);
	});
});
