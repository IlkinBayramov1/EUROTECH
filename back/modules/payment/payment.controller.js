const paymentService = require('./payment.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');

async function createPaymentIntent(req, res, next) {
  try {
    const { dossierId } = req.body;
    const result = await paymentService.createPaymentIntent(dossierId, req.user.id);
    return ApiResponse.success(res, result, 'Payment intent created');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function confirmPaymentMock(req, res, next) {
  try {
    const { paymentIntentId } = req.body;
    const dossier = await paymentService.confirmPaymentSuccess(paymentIntentId);
    return ApiResponse.success(res, { dossier }, getText('PAYMENT_SUCCESS', req.lang));
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function createSaaSSubscription(req, res, next) {
  try {
    const { planTier } = req.body;
    const subscription = await paymentService.createSaaSSubscription(req.user.id, planTier);
    return ApiResponse.success(res, { subscription }, 'SaaS Subscription activated', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  createPaymentIntent,
  confirmPaymentMock,
  createSaaSSubscription,
};
