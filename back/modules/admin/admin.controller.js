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

async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, action, search } = req.query;
    const data = await adminService.getAuditLogs({ page, limit, action, search });
    return ApiResponse.success(res, data, 'Audit logs retrieved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getSettings(req, res, next) {
  try {
    const data = await adminService.getSystemSettings();
    return ApiResponse.success(res, data, 'System settings retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await adminService.updateSystemSettings(req.body);
    return ApiResponse.success(res, data, 'System settings updated');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function saveCountry(req, res, next) {
  try {
    const country = await adminService.saveCountry(req.body);
    return ApiResponse.success(res, { country }, 'Country saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function saveVisaCategory(req, res, next) {
  try {
    const category = await adminService.saveVisaCategory(req.body);
    return ApiResponse.success(res, { category }, 'Visa category saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function saveTimeSlot(req, res, next) {
  try {
    const slot = await adminService.saveTimeSlot(req.body);
    return ApiResponse.success(res, { slot }, 'Time slot saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getIntegrationsHealth(req, res, next) {
  try {
    const health = await adminService.getIntegrationsHealth();
    return ApiResponse.success(res, health, 'Integrations health report');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getBankSlips(req, res, next) {
  try {
    const slips = await adminService.getBankSlips();
    return ApiResponse.success(res, { slips }, 'Bank payment slips retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function reviewBankSlip(req, res, next) {
  try {
    const { receiptId } = req.params;
    const { status, notes } = req.body;
    const receipt = await adminService.reviewBankSlip(receiptId, status, notes, req.user.id);
    return ApiResponse.success(res, { receipt }, `Bank payment receipt marked as ${status}`);
  } catch (error) {
    return ApiResponse.error(res, error.message, error.statusCode || 400);
  }
}

async function getCronMonitorStatus(req, res, next) {
  try {
    const data = await adminService.getCronMonitorStatus();
    return ApiResponse.success(res, data, 'Cron monitor status retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  getDashboardMetrics,
  getAllDossiers,
  updateDossierDecision,
  getAgentPayouts,
  updateAgentPayoutStatus,
  getAuditLogs,
  getSettings,
  updateSettings,
  saveCountry,
  saveVisaCategory,
  saveTimeSlot,
  getIntegrationsHealth,
  getBankSlips,
  reviewBankSlip,
  getCronMonitorStatus,
};
