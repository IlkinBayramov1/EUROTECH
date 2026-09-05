const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/create-intent', paymentController.createPaymentIntent);
router.post('/confirm-mock', paymentController.confirmPaymentMock);
router.post('/subscribe-saas', paymentController.createSaaSSubscription);

module.exports = router;
