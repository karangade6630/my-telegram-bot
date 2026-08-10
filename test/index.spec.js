import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src';
import { SearchService } from '../src/services/searchService.js';
import { extractQueryFromMessage } from '../src/handlers/callbackHandler.js';

describe('Movie AutoFilter worker', () => {
	it('responds with HTML on GET / (unit style)', async () => {
		const request = new Request('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const text = await response.text();
		expect(text).toContain('<!doctype html>');
		expect(text).toContain('id="root"');
	});

	it('responds with HTML on GET / (integration style)', async () => {
		const response = await SELF.fetch('http://example.com');
		const text = await response.text();
		expect(text).toContain('<!doctype html>');
		expect(text).toContain('id="root"');
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

describe('Callback pagination query parsing', () => {
	it('extracts the original search query from the styled result header', () => {
		const text = `<b>Tʜᴇ Rᴇsᴜʟᴛs Fᴏʀ</b> ☞ <b>Matrix &amp; Friends</b>\n\n<b>Rᴇǫᴜᴇsᴛᴇᴅ Bʏ</b> ☞ <b>Tester</b>`;

		expect(extractQueryFromMessage(text)).toBe('Matrix & Friends');
	});
});
