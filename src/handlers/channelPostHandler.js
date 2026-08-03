/**
 * @fileoverview ChannelPostHandler — Intercepts channel_post updates to auto-index content.
 *
 * @module handlers/channelPostHandler
 */

export class ChannelPostHandler {
  /**
   * @param {import('../services/movieIndexService.js').MovieIndexService} movieIndexService
   */
  constructor(movieIndexService) {
    this.movieIndexService = movieIndexService;
  }

  async handleChannelPost(channelPost) {
    if (!channelPost) return;
    await this.movieIndexService.indexChannelPost(channelPost);
  }
}
