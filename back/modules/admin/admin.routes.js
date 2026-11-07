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

// Financial Management
router.get('/agent-payouts', adminController.getAgentPayouts);
router.patch('/agent-payouts/:payoutId', adminController.updateAgentPayoutStatus);
router.get('/bank-slips', adminController.getBankSlips);
router.patch('/bank-slips/:receiptId/review', adminController.reviewBankSlip);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// System Configuration & Settings
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);
router.post('/countries', adminController.saveCountry);
router.post('/categories', adminController.saveVisaCategory);
router.post('/slots', adminController.saveTimeSlot);

// System Diagnostics & Background Cron Monitor
router.get('/integrations/health', adminController.getIntegrationsHealth);
router.get('/cron-monitor', adminController.getCronMonitorStatus);

module.exports = router;
