const express = require('express');
const router = express.Router();
const dossierController = require('./dossier.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const wizardBarrierMiddleware = require('../../middlewares/wizardBarrier.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { createDossierValidation, addApplicantsValidation } = require('./dossier.validation');

router.use(authMiddleware);

router.post('/', createDossierValidation, validateRequest, dossierController.createDossier);
router.post('/:dossierId/applicants', addApplicantsValidation, validateRequest, dossierController.addApplicants);
router.patch('/:dossierId/step', wizardBarrierMiddleware(6), dossierController.updateStep);
router.get('/my-dossiers', dossierController.getMyDossiers);
router.get('/:dossierId', dossierController.getDossier);

module.exports = router;
