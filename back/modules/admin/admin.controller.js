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

module.exports = {
  getDashboardMetrics,
  getAllDossiers,
  updateDossierDecision,
};
