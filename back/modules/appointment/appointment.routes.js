const express = require('express');
const router = express.Router();
const appointmentController = require('./appointment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public or semi-public slot inquiry
router.get('/slots', appointmentController.getAvailableSlots);

// Protected appointment actions
router.use(authMiddleware);

router.post('/book', appointmentController.bookAppointment);
router.patch('/:appointmentId/reschedule', appointmentController.rescheduleAppointment);
router.delete('/:appointmentId/cancel', appointmentController.cancelAppointment);
router.get('/:appointmentId/manifest-pdf', appointmentController.getManifestPdf);

module.exports = router;
