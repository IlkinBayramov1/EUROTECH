/**
 * Privacy Service (Unified Facade)
 *
 * Modular architecture facade delegating responsibilities to specialized sub-services:
 * - privacyErasure.service.js: GDPR Right to be Forgotten and PII anonymization
 * - privacyExport.service.js: User data portability export and official GDPR dossier PDF generation
 */

const privacyErasureService = require('./services/privacyErasure.service');
const privacyExportService = require('./services/privacyExport.service');

module.exports = {
  ...privacyErasureService,
  ...privacyExportService,
};
