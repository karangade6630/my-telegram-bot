/**
 * @fileoverview FileHelper — Format file metrics and captions.
 *
 * @module helpers/fileHelper
 */

import { FileResponse } from '../dto/FileResponse.js';

export class FileHelper {
  static formatFileCaption(fileModel, movieTitle) {
    const dto = FileResponse.from(fileModel);
    return dto.buildCaption(movieTitle);
  }
}
