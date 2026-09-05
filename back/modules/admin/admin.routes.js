const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

router.use(authMiddleware);
router.use(requireRoles(['OPERATOR', 'MANAGER', 'ADMIN']));

router.get('/metrics', adminController.getDashboardMetrics);
router.get('/dossiers', adminController.getAllDossiers);
router.patch('/dossier/:dossierId/decision', adminController.updateDossierDecision);

module.exports = router;
