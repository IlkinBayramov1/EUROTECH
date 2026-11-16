const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

const { requireRoles } = require('../../middlewares/role.middleware');

// Public Webhooks & Callbacks (Signature verified, no Bearer token required)
router.post('/webhook', paymentController.handleStripeWebhook);
router.post('/local-bank/callback', paymentController.confirmLocalBankPayment);

// Authenticated Routes
router.use(authMiddleware);

// Stripe & Card Endpoints
router.post('/create-intent', paymentController.createPaymentIntent);
router.post('/confirm-mock', paymentController.confirmPaymentMock);

// Local Bank Gateway Endpoints
router.post('/local-bank/create-order', paymentController.createLocalBankOrder);

// Bank Wire / Slip Upload & Reconciliation
router.post('/bank-slip', upload.single('slip'), paymentController.submitBankPaymentSlip);
router.get('/bank-slips', requireRoles(['ADMIN', 'MANAGER', 'OPERATOR']), paymentController.getBankPaymentSlips);
router.patch('/bank-slip/:receiptId/review', requireRoles(['ADMIN', 'MANAGER', 'OPERATOR']), paymentController.reviewBankPaymentSlip);

// EuroTech Pre-Funded Multi-Currency Wallet Engine
router.get('/wallet/overview', paymentController.getWalletOverview);
router.post('/wallet/topup', paymentController.topupWallet);
router.post('/wallet/pay', paymentController.payWithWallet);

// Corporate Subscriptions
router.post('/subscribe-saas', paymentController.createSaaSSubscription);

module.exports = router;
