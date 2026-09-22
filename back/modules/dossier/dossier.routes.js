const express = require('express');
const router = express.Router();
const dossierController = require('./dossier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const wizardBarrierMiddleware = require('../../middlewares/wizardBarrier.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { createDossierValidation, addApplicantsValidation } = require('./dossier.validation');

const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const prisma = require('../../config/db');

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
    // ignore
  }
  next();
}

// Application Form PDF Generation & Download (Supports both GET and POST with optionalAuth)
router.get('/:dossierId/applicants/:applicantId/application-pdf', optionalAuth, dossierController.getApplicationFormPdf);
router.post('/:dossierId/applicants/:applicantId/application-pdf', optionalAuth, dossierController.getApplicationFormPdf);
router.get('/application-pdf', optionalAuth, dossierController.getApplicationFormPdf);
router.post('/application-pdf', optionalAuth, dossierController.getApplicationFormPdf);
router.get('/:dossierId/summary-pdf', optionalAuth, dossierController.getDossierSummaryPdf);
router.get('/track/:referenceNumber', optionalAuth, dossierController.getDossierTracking);

router.use(authMiddleware);

router.post('/', createDossierValidation, validateRequest, dossierController.createDossier);
router.post('/:dossierId/applicants', addApplicantsValidation, validateRequest, dossierController.addApplicants);
router.patch('/:dossierId/applicants/:applicantId/form', dossierController.updateApplicantForm);
router.delete('/:dossierId/applicants/:applicantId', dossierController.deleteApplicant);
router.patch('/:dossierId/step', wizardBarrierMiddleware(6), dossierController.updateStep);
router.get('/my-dossiers', dossierController.getMyDossiers);
router.get('/my', dossierController.getMyDossiers);
router.get('/:dossierId/tracking', dossierController.getDossierTracking);
router.get('/:dossierId', dossierController.getDossier);

module.exports = router;

