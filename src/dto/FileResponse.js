/**
 * @fileoverview FileResponse DTO.
 * Shapes file data for delivery callbacks.
 *
 * @module dto/FileResponse
 */

export class FileResponse {
  /**
   * @param {import('../models/File.js').File} file
   */
  constructor(file) {
    this.id             = file.id;
    this.telegramFileId = file.telegramFileId;
    this.fileType       = file.fileType;   // 'document' | 'video'
    this.quality        = file.qualityLabel;
    this.qualityEmoji   = file.qualityEmoji;
    this.language       = file.language;
    this.size           = file.size;
    this.codec          = file.codec;
    this.isHevc         = file.isHevc;
    this.isHdr          = file.isHdr;
    this.isDualAudio    = file.isDualAudio;
    this.episodeString  = file.episodeString;
    this.featureTags    = file.featureTags;
    this.audioTracks    = file.audioTracks;
    this.subtitle       = file.subtitle;
  }

  /**
   * Build caption for the sent file message.
   * @param {string} movieTitle
   * @returns {string}
   */
  buildCaption(movieTitle) {
    const parts = [`🎬 <b>${escapeHtml(movieTitle)}</b>`];
    if (this.episodeString) parts.push(`📺 <b>${this.episodeString}</b>`);
    if (this.quality)       parts.push(`📡 <b>${this.quality}</b>`);
    if (this.language)      parts.push(`🌎 ${escapeHtml(this.language)}`);
    if (this.size)          parts.push(`💾 ${escapeHtml(this.size)}`);
    if (this.featureTags.length) parts.push(`✨ ${this.featureTags.join(' | ')}`);
    return parts.join('\n');
  }

  /**
   * Create from File model.
   * @param {import('../models/File.js').File} file
   * @returns {FileResponse}
   */
  static from(file) {
    return new FileResponse(file);
  }

  toJSON() {
    return {
      id:             this.id,
      telegramFileId: this.telegramFileId,
      quality:        this.quality,
      language:       this.language,
      size:           this.size,
      fileType:       this.fileType,
      featureTags:    this.featureTags,
    };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
