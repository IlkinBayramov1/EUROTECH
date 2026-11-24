const express = require('express');
const vcmsController = require('./vcms.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

// ============================================================================
// ADMIN VCMS & APPOINTMENT ROUTER (/api/v1/admin/vcms/* & /api/v1/admin/*)
// ============================================================================
const adminVcmsRouter = express.Router();
adminVcmsRouter.use(authMiddleware);
adminVcmsRouter.use(requireRoles(['ADMIN', 'MANAGER', 'OPERATOR']));

// 1. Destinations, Visa Types & Purposes
adminVcmsRouter.get('/destinations', vcmsController.listDestinations);
adminVcmsRouter.post('/destinations', vcmsController.createCountry);
adminVcmsRouter.get('/destinations/:countryId', vcmsController.getCountryDetail);
adminVcmsRouter.patch('/destinations/:countryId', vcmsController.updateCountry);
adminVcmsRouter.delete('/destinations/:countryId', vcmsController.deleteCountry);

adminVcmsRouter.post('/destinations/:countryId/visa-types', vcmsController.createVisaType);
adminVcmsRouter.patch('/visa-types/:visaTypeId', vcmsController.updateVisaType);
adminVcmsRouter.delete('/visa-types/:visaTypeId', vcmsController.deleteVisaType);

adminVcmsRouter.post('/visa-types/:visaTypeId/purposes', vcmsController.createVisaPurpose);
adminVcmsRouter.patch('/purposes/:purposeId', vcmsController.updateVisaPurpose);
adminVcmsRouter.delete('/purposes/:purposeId', vcmsController.deleteVisaPurpose);
adminVcmsRouter.post('/purposes/:purposeId/duplicate', vcmsController.duplicateVisaPurpose);
adminVcmsRouter.get('/purposes/:purposeId/workspace', vcmsController.getPurposeWorkspace);

// 2. Central Question Pool & Purpose Question Configurations
adminVcmsRouter.get('/question-pool', vcmsController.listQuestionPool);
adminVcmsRouter.post('/question-pool', vcmsController.createGlobalQuestion);
adminVcmsRouter.patch('/question-pool/:questionId', vcmsController.updateGlobalQuestion);
adminVcmsRouter.post('/question-pool/:questionId/duplicate', vcmsController.duplicateGlobalQuestion);

adminVcmsRouter.post('/purposes/:purposeId/categories', vcmsController.createQuestionCategory);
adminVcmsRouter.patch('/purposes/:purposeId/categories/reorder', vcmsController.reorderQuestionCategories);
adminVcmsRouter.post('/purposes/:purposeId/questions/attach', vcmsController.attachQuestionsFromPool);
adminVcmsRouter.post('/purposes/:purposeId/questions/create-and-attach', vcmsController.createAndAttachQuestion);
adminVcmsRouter.patch('/purpose-questions/:configId', vcmsController.updatePurposeQuestionConfig);
adminVcmsRouter.patch('/purposes/:purposeId/questions/reorder', vcmsController.reorderPurposeQuestions);
adminVcmsRouter.delete('/purpose-questions/:configId', vcmsController.detachPurposeQuestion);

// 3. Central Document Pool & Purpose Document Configurations
adminVcmsRouter.get('/document-categories', vcmsController.listDocumentCategories);
adminVcmsRouter.get('/document-pool', vcmsController.listDocumentPool);
adminVcmsRouter.post('/document-pool', vcmsController.createGlobalDocument);
adminVcmsRouter.patch('/document-pool/:documentId', vcmsController.updateGlobalDocument);

adminVcmsRouter.post('/purposes/:purposeId/documents/attach', vcmsController.attachDocumentsFromPool);
adminVcmsRouter.post('/purposes/:purposeId/documents/create-and-attach', vcmsController.createAndAttachDocument);
adminVcmsRouter.patch('/purpose-documents/:configId', vcmsController.updatePurposeDocumentConfig);
adminVcmsRouter.patch('/purposes/:purposeId/documents/reorder', vcmsController.reorderPurposeDocuments);
adminVcmsRouter.delete('/purpose-documents/:configId', vcmsController.detachPurposeDocument);

// 4. Visa Application Centres, Embassies & Locations
adminVcmsRouter.get('/visa-offices', vcmsController.listVisaOffices);
adminVcmsRouter.post('/visa-centres', vcmsController.saveVisaCentre);
adminVcmsRouter.patch('/visa-centres/:id', vcmsController.saveVisaCentre);
adminVcmsRouter.post('/embassies', vcmsController.saveEmbassy);
adminVcmsRouter.patch('/embassies/:id', vcmsController.saveEmbassy);

// 5. Publish, Version Control, Rollback, Import & Export
adminVcmsRouter.post('/destinations/:countryId/publish', vcmsController.publishCountry);
adminVcmsRouter.post('/destinations/:countryId/versions/:versionId/rollback', vcmsController.rollbackCountryVersion);
adminVcmsRouter.post('/import/questions', vcmsController.importQuestions);
adminVcmsRouter.get('/export/purpose/:purposeId', vcmsController.exportPurpose);

// 6. Appointment Management (8 Sub-sections)
adminVcmsRouter.get('/appointments/providers', vcmsController.listAppointmentProviders);
adminVcmsRouter.post('/appointments/providers', vcmsController.saveAppointmentProvider);
adminVcmsRouter.patch('/appointments/providers/:providerId', vcmsController.saveAppointmentProvider);
adminVcmsRouter.put('/appointments/providers/:providerId/visa-mappings', vcmsController.updateProviderVisaMappings);

adminVcmsRouter.get('/appointments/schedules', vcmsController.listAppointmentSchedules);
adminVcmsRouter.post('/appointments/schedules', vcmsController.createOrUpdateSchedule);
adminVcmsRouter.patch('/appointments/schedules/:scheduleId', vcmsController.createOrUpdateSchedule);
adminVcmsRouter.post('/appointments/schedules/:scheduleId/preview', vcmsController.previewScheduleGeneration);
adminVcmsRouter.post('/appointments/schedules/:scheduleId/generate', vcmsController.generateScheduleSlots);
adminVcmsRouter.post('/appointments/schedules/:scheduleId/publish', vcmsController.publishSchedule);
adminVcmsRouter.post('/appointments/schedules/:scheduleId/status', vcmsController.closeOrArchiveSchedule);

adminVcmsRouter.get('/appointments/calendar', vcmsController.getAppointmentCalendar);
adminVcmsRouter.get('/appointments/excluded-dates', vcmsController.listScheduleExceptions);
adminVcmsRouter.post('/appointments/excluded-dates', vcmsController.createScheduleException);
adminVcmsRouter.delete('/appointments/excluded-dates/:exceptionId', vcmsController.deleteScheduleException);

adminVcmsRouter.post('/appointments/slots/manual', vcmsController.createManualSlot);
adminVcmsRouter.patch('/appointments/slots/:slotId', vcmsController.updateSlot);
adminVcmsRouter.delete('/appointments/slots/:slotId', vcmsController.deleteSlot);

adminVcmsRouter.get('/appointments/bookings', vcmsController.listBookings);
adminVcmsRouter.patch('/appointments/bookings/:appointmentId/status', vcmsController.updateBookingStatus);
adminVcmsRouter.patch('/appointments/bookings/:appointmentId/reschedule', vcmsController.adminRescheduleBooking);

// 7. User Management
adminVcmsRouter.get('/users', vcmsController.listUsers);
adminVcmsRouter.post('/users', vcmsController.createUserByAdmin);
adminVcmsRouter.patch('/users/:userId', vcmsController.updateUserByAdmin);

// ============================================================================
// PUBLIC / PORTAL VCMS ROUTER (/api/v1/vcms/*)
// ============================================================================
const publicVcmsRouter = express.Router();

publicVcmsRouter.get('/countries', vcmsController.getPublicCountries);
publicVcmsRouter.get('/purposes/:purposeId/form-schema', vcmsController.getPublicPurposeSchema);
publicVcmsRouter.post('/purposes/:purposeId/form-schema', vcmsController.getPublicPurposeSchema);
publicVcmsRouter.get('/available-slots', vcmsController.getCustomerPublishedSlots);

// Applicant question answers (supports both authenticated portal users and self-fill token flow)
publicVcmsRouter.get('/dossiers/:dossierId/applicants/:applicantId/answers', vcmsController.getApplicantAnswers);
publicVcmsRouter.put('/dossiers/:dossierId/applicants/:applicantId/answers', vcmsController.saveApplicantAnswers);

publicVcmsRouter.get('/my-appointment-notifications', authMiddleware, vcmsController.getMyAppointmentNotifications);
publicVcmsRouter.patch(
  '/my-appointment-notifications/:notificationId/read',
  authMiddleware,
  vcmsController.markMyAppointmentNotificationRead
);

module.exports = {
  adminVcmsRouter,
  publicVcmsRouter,
};
