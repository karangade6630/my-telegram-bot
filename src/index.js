/**
 * @fileoverview Main Worker Entrypoint.
 * Delegates Webhook requests to routes/webhook.js, Queue batches to QueueWorker, and Cron to ScheduledWorker.
 *
 * @module index
 */

import { handleWebhookRequest } from './routes/webhook.js';
import { QueueWorker } from './workers/queueWorker.js';
import { ScheduledWorker } from './workers/scheduledWorker.js';

export default {
	/**
	 * HTTP Webhook Handler
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 1. Serve the React front-end page on GET /
		if (request.method === 'GET' && url.pathname === '/') {
			// env.ASSETS.fetch pulls directly from your compiled ./dist directory
			return await env.ASSETS.fetch(request);
		}

		if (request.method === 'POST' && url.pathname === '/webhook') {
			return await handleWebhookRequest(request, env);
		}

		return new Response('Not Found', { status: 404 });
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
