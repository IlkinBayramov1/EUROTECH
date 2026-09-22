const appointmentService = require('./appointment.service');
const ApiResponse = require('../../core/api.response');

async function getAvailableSlots(req, res, next) {
  try {
    const { date, location } = req.query;
    const slots = await appointmentService.getAvailableSlots({ date, location });
    return ApiResponse.success(res, { slots }, 'Available time slots retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function bookAppointment(req, res, next) {
  try {
    const { dossierId, groupBatchId, timeSlotId, location, notes } = req.body;
    const appointment = await appointmentService.bookAppointment({
      userId: req.user.id,
      dossierId,
      groupBatchId,
      timeSlotId,
      location,
      notes,
    });
    return ApiResponse.success(res, { appointment }, 'Appointment booked successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const { newTimeSlotId } = req.body;
    const appointment = await appointmentService.rescheduleAppointment({
      appointmentId,
      newTimeSlotId,
      currentUser: req.user,
    });
    return ApiResponse.success(res, { appointment }, 'Appointment rescheduled successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentService.cancelAppointment({
      appointmentId,
      currentUser: req.user,
    });
    return ApiResponse.success(res, { appointment }, 'Appointment cancelled successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getManifestPdf(req, res, next) {
  try {
    const appointmentId = req.params.appointmentId || req.body?.appointmentId || req.query?.appointmentId;
    const groupBatchId = req.query?.groupBatchId || req.body?.groupBatchId;
    const customGroupInfo = req.body?.groupInfo;
    const result = await appointmentService.generateManifestPdf({
      appointmentId,
      groupBatchId,
      customGroupInfo,
      currentUser: req.user,
    });
    return ApiResponse.success(res, result, 'Group appointment manifest PDF generated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getConfirmationLetterPdf(req, res, next) {
  try {
    const appointmentId = req.params.appointmentId || req.body?.appointmentId || req.query?.appointmentId;
    const customAppointmentInfo = req.body?.appointmentInfo || req.query;
    const result = await appointmentService.generateConfirmationLetterPdf({
      appointmentId,
      customAppointmentInfo,
      currentUser: req.user,
    });
    return ApiResponse.success(res, result, 'Official appointment confirmation letter generated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  getAvailableSlots,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getManifestPdf,
  getConfirmationLetterPdf,
};

