const express = require('express');
const router = express.Router();
const appointmentController = require('./appointment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const prisma = require('../../config/db');

// Optional auth helper for manifest PDF downloads
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, fullName: true },
      });
      if (user) req.user = user;
    }
  } catch (e) {
    // ignore optional auth errors
  }
  next();
}

// Public or semi-public slot inquiry
router.get('/slots', appointmentController.getAvailableSlots);

// Manifest PDF download endpoints (supports both GET and POST with optional auth)
router.get('/manifest-pdf', optionalAuth, appointmentController.getManifestPdf);
router.post('/manifest-pdf', optionalAuth, appointmentController.getManifestPdf);
router.get('/:appointmentId/manifest-pdf', optionalAuth, appointmentController.getManifestPdf);

// Individual Appointment Confirmation Letter PDF endpoints
router.get('/confirmation-pdf', optionalAuth, appointmentController.getConfirmationLetterPdf);
router.post('/confirmation-pdf', optionalAuth, appointmentController.getConfirmationLetterPdf);
router.get('/:appointmentId/confirmation-pdf', optionalAuth, appointmentController.getConfirmationLetterPdf);

// Protected appointment booking actions
router.use(authMiddleware);

router.post('/book', appointmentController.bookAppointment);
router.patch('/:appointmentId/reschedule', appointmentController.rescheduleAppointment);
router.delete('/:appointmentId/cancel', appointmentController.cancelAppointment);

module.exports = router;


