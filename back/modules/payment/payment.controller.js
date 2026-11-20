const paymentService = require('./payment.service');
const walletService = require('./wallet.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');
const { sendDownloadSafely } = require('../../utils/download.util');

async function createPaymentIntent(req, res) {
  try {
    const { idempotencyKey } = req.body || {};
    const result = await paymentService.createPaymentIntent(req.body, req.user.id, idempotencyKey);
    return ApiResponse.success(res, result, 'Payment intent created');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function confirmPaymentMock(req, res) {
  try {
    const { paymentIntentId } = req.body;
    const result = await paymentService.confirmPaymentSuccess(paymentIntentId);
    return ApiResponse.success(res, { dossier: result, result }, getText('PAYMENT_SUCCESS', req.lang));
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getWalletOverview(req, res) {
  try {
    const overview = await walletService.getUserWalletOverview(req.user.id);
    return ApiResponse.success(res, overview, 'Wallet overview retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function topupWallet(req, res) {
  try {
    const { amount, currency, method, reference } = req.body || {};
    const result = await walletService.topupWallet({
      userId: req.user.id,
      amount,
      currency: currency || 'EUR',
      method: method || 'CARD',
      reference,
    });
    return ApiResponse.success(res, result, 'Wallet topped up successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function payWithWallet(req, res) {
  try {
    const { dossierId, groupBatchId, invoiceId } = req.body || {};
    const result = await walletService.payWithWallet({
      userId: req.user.id,
      userRole: req.user.role,
      dossierId: dossierId || null,
      groupBatchId: groupBatchId || null,
      invoiceId: invoiceId || null,
    });
    return ApiResponse.success(res, result, 'Payment settled from wallet');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function withdrawFromWallet(req, res) {
  try {
    const { amount, currency, bankName, iban, swiftBic, accountHolder } = req.body || {};
    const result = await walletService.requestWalletPayout({
      userId: req.user.id,
      amount,
      currency: currency || 'EUR',
      bankName,
      iban,
      swiftBic,
      accountHolder,
    });
    return ApiResponse.success(res, result, 'Wallet withdrawal request submitted successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function saveWalletBankDetails(req, res) {
  try {
    const { bankName, iban, swiftBic, accountHolder } = req.body || {};
    const result = await walletService.saveWalletBankDetails(req.user.id, {
      bankName,
      iban,
      swiftBic,
      accountHolder,
    });
    return ApiResponse.success(res, result, 'Wallet payout bank coordinates saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getBankSlipFile(req, res) {
  try {
    const { receiptId } = req.params;
    const { inline } = req.query;
    const fileData = await paymentService.getBankSlipFile(receiptId);
    const isInline = inline === 'true' || inline === '1';

    return sendDownloadSafely(res, {
      filePath: fileData.filePath,
      fileName: fileData.fileName,
      buffer: fileData.buffer,
      contentType: fileData.contentType || 'application/pdf',
      inline: isInline,
    });
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
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl;
    const fileName = req.file ? req.file.originalname : (req.body.fileName || 'bank-slip.pdf');
    const { dossierId, groupBatchId, invoiceId, amount, currency, referenceCode, receiptNumber, bankName, depositDate, senderName, purpose } = req.body;
    const receipt = await paymentService.submitBankPaymentSlip({
      dossierId: dossierId || null,
      groupBatchId: groupBatchId || null,
      invoiceId: invoiceId || null,
      userId: req.user.id,
      amount,
      currency: currency || 'EUR',
      referenceCode: referenceCode || receiptNumber,
      fileUrl,
      fileName,
      bankName,
      depositDate,
      senderName,
      purpose,
    });
    return ApiResponse.success(res, { receipt }, 'Bank payment receipt submitted for review', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getBankPaymentSlips(req, res) {
  try {
    const status = req.query.status;
    const slips = await paymentService.getBankPaymentSlips(status);
    return ApiResponse.success(res, { slips }, 'Bank payment slips retrieved successfully');
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
  getWalletOverview,
  topupWallet,
  payWithWallet,
  withdrawFromWallet,
  saveWalletBankDetails,
  getBankSlipFile,
  handleStripeWebhook,
  createLocalBankOrder,
  confirmLocalBankPayment,
  submitBankPaymentSlip,
  getBankPaymentSlips,
  reviewBankPaymentSlip,
  createSaaSSubscription,
};
