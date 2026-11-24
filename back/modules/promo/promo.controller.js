const promoService = require('./promo.service');
const ApiResponse = require('../../core/api.response');

async function validatePromo(req, res) {
  try {
    const {
      code,
      promoCode,
      dossierId,
      groupBatchId,
      invoiceId,
      scope,
      purpose,
      source,
      cartItems,
      items,
    } = req.body || {};

    const result = await promoService.validatePromoCode({
      code: code || promoCode,
      userId: req.user.id,
      userRole: req.user.role,
      dossierId: dossierId || null,
      groupBatchId: groupBatchId || null,
      invoiceId: invoiceId || null,
      scope: scope || null,
      purpose: purpose || null,
      source: source || null,
      cartItems: cartItems || items || null,
    });

    return ApiResponse.success(res, result, 'Promo code validated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function listAdminPromos(req, res) {
  try {
    const { status, portal, search } = req.query || {};
    const promoCodes = await promoService.listPromoCodes({
      status: status || null,
      portal: portal || null,
      search: search || null,
    });
    return ApiResponse.success(res, { promoCodes }, 'Promo codes retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getAdminPromoAnalytics(req, res) {
  try {
    const analytics = await promoService.getPromoAnalytics();
    return ApiResponse.success(res, analytics, 'Promo analytics retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getAdminPromoDetail(req, res) {
  try {
    const promo = await promoService.getPromoCodeDetail(req.params.id);
    return ApiResponse.success(res, { promo }, 'Promo code details retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getAdminPromoRedemptions(req, res) {
  try {
    const result = await promoService.getPromoRedemptions(req.params.id);
    return ApiResponse.success(res, result, 'Promo redemptions retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function createAdminPromo(req, res) {
  try {
    const promo = await promoService.createPromoCode(req.body || {}, req.user.id);
    return ApiResponse.success(res, { promo }, 'Promo code created successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function updateAdminPromo(req, res) {
  try {
    const promo = await promoService.updatePromoCode(req.params.id, req.body || {}, req.user.id);
    return ApiResponse.success(res, { promo }, 'Promo code updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function toggleAdminPromoStatus(req, res) {
  try {
    const promo = await promoService.togglePromoCodeStatus(req.params.id, req.body?.status, req.user.id);
    return ApiResponse.success(res, { promo }, 'Promo code status updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function deleteAdminPromo(req, res) {
  try {
    const result = await promoService.deleteOrArchivePromoCode(req.params.id, req.user.id);
    const msg =
      result.action === 'ARCHIVED'
        ? 'Promo code has historical redemptions and was safely archived.'
        : 'Promo code deleted successfully.';
    return ApiResponse.success(res, result, msg);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  validatePromo,
  listAdminPromos,
  getAdminPromoAnalytics,
  getAdminPromoDetail,
  getAdminPromoRedemptions,
  createAdminPromo,
  updateAdminPromo,
  toggleAdminPromoStatus,
  deleteAdminPromo,
};
