const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

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
router.post('/bank-slip', paymentController.submitBankPaymentSlip);
router.patch('/bank-slip/:receiptId/review', paymentController.reviewBankPaymentSlip);

// Corporate Subscriptions
router.post('/subscribe-saas', paymentController.createSaaSSubscription);

module.exports = router;
