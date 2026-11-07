/**
 * Document Service (Unified Facade)
 *
 * Modular architecture facade delegating responsibilities to specialized sub-services:
 * - documentStorage.service.js: Upload, review, correction feedback, deletion, family sharing
 * - documentSignedUrl.service.js: Temporary signed URL generation and secure download token verification
 * - documentExport.service.js: Document checklist PDF and CSV/Excel exports
 */

const documentStorageService = require('./services/documentStorage.service');
const documentSignedUrlService = require('./services/documentSignedUrl.service');
const documentExportService = require('./services/documentExport.service');

module.exports = {
  ...documentStorageService,
  ...documentSignedUrlService,
  ...documentExportService,
};
