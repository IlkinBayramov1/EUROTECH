const express = require('express');
const router = express.Router();
const corporateController = require('./corporate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

// Public guest delegation profile route
router.get('/delegation/profile', corporateController.getDelegationProfile);

// Protected Corporate HR routes
router.use(authMiddleware);
router.use(requireRoles(['CORPORATE_HR', 'ADMIN', 'MANAGER']));

router.post('/batches', corporateController.createBatch);
router.get('/batches', corporateController.getBatches);
router.post('/employees/:employeeId/delegation-link', corporateController.generateDelegationLink);

router.get('/employees', corporateController.getEmployees);
router.post('/employees', corporateController.addEmployee);

router.post('/batches/:batchId/invoice', corporateController.generateInvoice);
router.post('/batches/:batchId/pay-wallet', corporateController.payWithWallet);
router.get('/invoices', corporateController.getInvoices);

module.exports = router;
