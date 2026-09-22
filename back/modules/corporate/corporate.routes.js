const express = require('express');
const router = express.Router();
const corporateController = require('./corporate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

// Public guest delegation profile route
router.get('/delegation/profile', corporateController.getDelegationProfile);
router.post('/delegation/submit', corporateController.submitDelegationForm);

// Protected Corporate HR routes
router.use(authMiddleware);
router.use(requireRoles(['CORPORATE_HR', 'ADMIN', 'MANAGER']));

router.get('/dashboard/stats', corporateController.getDashboardStats);
router.get('/wallet', corporateController.getWallet);

router.post('/batches', corporateController.createBatch);
router.get('/batches', corporateController.getBatches);
router.patch('/batches/:batchId', corporateController.updateBatch);
router.delete('/batches/:batchId', corporateController.deleteBatch);
router.post('/batches/:batchId/submit', corporateController.submitBatch);
router.patch('/batches/:batchId/employees/:employeeId/form', corporateController.saveEmployeeForm);
router.post('/employees/:employeeId/delegation-link', corporateController.generateDelegationLink);
router.post('/employees/:employeeId/remind', corporateController.remindEmployee);

router.get('/employees', corporateController.getEmployees);
router.post('/employees', corporateController.addEmployee);
router.patch('/employees/:employeeId', corporateController.updateEmployee);
router.delete('/employees/:employeeId', corporateController.deleteEmployee);

router.post('/wallet/topup', corporateController.topupWallet);
router.post('/batches/:batchId/invoice', corporateController.generateInvoice);
router.post('/batches/:batchId/pay-wallet', corporateController.payWithWallet);
router.get('/invoices', corporateController.getInvoices);
router.get('/invoices/:invoiceId/pdf', corporateController.getInvoicePdf);

module.exports = router;

