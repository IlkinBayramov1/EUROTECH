/**
 * EUROTECH Dossier Module - Service Facade / Barrel
 * Aggregates all focused dossier sub-services for 100% backward compatibility.
 */

const lifecycleService = require('./services/dossierLifecycle.service');
const applicantService = require('./services/dossierApplicant.service');
const trackingService = require('./services/dossierTracking.service');
const schengenPdfService = require('./services/dossierSchengenPdf.service');
const summaryPdfService = require('./services/dossierSummaryPdf.service');

module.exports = {
  // Core Dossier Lifecycle (create, steps, fetch)
  ...lifecycleService,

  // Applicants & Anket form management
  ...applicantService,

  // Real-time Consular Timeline & Tracking
  ...trackingService,

  // Harmonised Schengen 110-field PDF Form Engine
  ...schengenPdfService,

  // Official Dossier Summary Certificate & Checklist PDF
  ...summaryPdfService,
};
