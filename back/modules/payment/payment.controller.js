const paymentService = require('./payment.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');

async function createPaymentIntent(req, res) {
  try {
    const { dossierId, idempotencyKey } = req.body;
    const result = await paymentService.createPaymentIntent(dossierId, req.user.id, idempotencyKey);
    return ApiResponse.success(res, result, 'Payment intent created');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function confirmPaymentMock(req, res) {
  try {
    const { paymentIntentId } = req.body;
    const dossier = await paymentService.confirmPaymentSuccess(paymentIntentId);
    return ApiResponse.success(res, { dossier }, getText('PAYMENT_SUCCESS', req.lang));
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function handleStripeWebhook(req, res) {
  try {
    const signatureHeader = req.headers['stripe-signature'];
    const result = await paymentService.handleStripeWebhook({
      rawBody: req.rawBody,
      signatureHeader,
      eventBody: req.body,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Stripe webhook processing error:', error.message);
    return res.status(error.statusCode || 400).json({ error: error.message });
  }
}

async function createLocalBankOrder(req, res) {
  try {
    const { dossierId, returnUrl } = req.body;
    const orderData = await paymentService.createLocalBankOrder(dossierId, req.user.id, returnUrl);
    return ApiResponse.success(res, orderData, 'Local bank order created');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function confirmLocalBankPayment(req, res) {
  try {
    const result = await paymentService.confirmLocalBankPayment(req.body);
    return ApiResponse.success(res, result, 'Local bank payment processed');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function submitBankPaymentSlip(req, res) {
  try {
    const { dossierId, amount, referenceCode, fileUrl, fileName } = req.body;
    const receipt = await paymentService.submitBankPaymentSlip({
      dossierId,
      userId: req.user.id,
      amount,
      referenceCode,
      fileUrl,
      fileName,
    });
    return ApiResponse.success(res, { receipt }, 'Bank payment receipt submitted for review', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function reviewBankPaymentSlip(req, res) {
  try {
    const { receiptId } = req.params;
    const { action, adminNotes } = req.body;
    const result = await paymentService.reviewBankPaymentSlip({
      receiptId,
      adminUserId: req.user.id,
      action,
      adminNotes,
    });
    return ApiResponse.success(res, { result }, `Bank slip ${action.toLowerCase()}ed successfully`);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function createSaaSSubscription(req, res) {
  try {
    const { planTier } = req.body;
    const subscription = await paymentService.createSaaSSubscription(req.user.id, planTier);
    return ApiResponse.success(res, { subscription }, 'SaaS Subscription activated', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  createPaymentIntent,
  confirmPaymentMock,
  handleStripeWebhook,
  createLocalBankOrder,
  confirmLocalBankPayment,
  submitBankPaymentSlip,
  reviewBankPaymentSlip,
  createSaaSSubscription,
};
