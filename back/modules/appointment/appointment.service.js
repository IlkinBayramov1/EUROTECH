/**
 * Appointment Service (Unified Facade)
 *
 * Modular architecture facade delegating responsibilities to specialized sub-services:
 * - appointmentBooking.service.js: Slot management, reservations, rescheduling, cancellation
 * - appointmentManifestPdf.service.js: Group biometrics and manifest PDF generation
 * - appointmentLetterPdf.service.js: Biometric appointment confirmation letter PDF generation
 */

const appointmentBookingService = require('./services/appointmentBooking.service');
const appointmentManifestPdfService = require('./services/appointmentManifestPdf.service');
const appointmentLetterPdfService = require('./services/appointmentLetterPdf.service');

module.exports = {
  ...appointmentBookingService,
  ...appointmentManifestPdfService,
  ...appointmentLetterPdfService,
};
