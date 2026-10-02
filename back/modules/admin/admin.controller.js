const adminService = require('./admin.service');
const ApiResponse = require('../../core/api.response');

async function getDashboardMetrics(req, res, next) {
  try {
    const metrics = await adminService.getDashboardMetrics();
    return ApiResponse.success(res, { metrics });
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getAllDossiers(req, res, next) {
  try {
    const { status, portalType, search, page, limit } = req.query;
    const data = await adminService.getAllDossiers({ status, portalType, search, page, limit });
    return ApiResponse.success(res, data);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function updateDossierDecision(req, res, next) {
  try {
    const { dossierId } = req.params;
    const { nextStatus, notes } = req.body;

    const dossier = await adminService.updateDossierStatusAndDecision({
      dossierId,
      nextStatus,
      notes,
      reviewerUserId: req.user.id,
    });

    return ApiResponse.success(res, { dossier }, 'Dossier status updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getAgentPayouts(req, res, next) {
  try {
    const payouts = await adminService.getAgentPayouts();
    return ApiResponse.success(res, { payouts }, 'Agent payout requests retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function updateAgentPayoutStatus(req, res, next) {
  try {
    const { payoutId } = req.params;
    const { status } = req.body;
    const payout = await adminService.updateAgentPayoutStatus(payoutId, status);
    return ApiResponse.success(res, { payout }, `Payout status updated to ${status}`);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

module.exports = {
  getDashboardMetrics,
  getAllDossiers,
  updateDossierDecision,
  getAgentPayouts,
  updateAgentPayoutStatus,
};
