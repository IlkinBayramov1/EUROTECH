const dossierService = require('./dossier.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');

async function createDossier(req, res, next) {
  try {
    const dossier = await dossierService.createDossier({
      userId: req.user.id,
      ...req.body,
    });

    return ApiResponse.success(res, { dossier }, getText('DOSSIER_CREATED', req.lang), 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function addApplicants(req, res, next) {
  try {
    const { dossierId } = req.params;
    const applicants = await dossierService.addApplicants(dossierId, req.body.applicants);

    return ApiResponse.success(res, { applicants }, 'Applicants added successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function updateStep(req, res, next) {
  try {
    const { dossierId } = req.params;
    const { step } = req.body;
    const dossier = await dossierService.updateStep(dossierId, step);

    return ApiResponse.success(res, { dossier }, 'Wizard step updated');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getDossier(req, res, next) {
  try {
    const { dossierId } = req.params;
    const dossier = await dossierService.getDossierById(dossierId);
    return ApiResponse.success(res, { dossier });
  } catch (error) {
    return ApiResponse.error(res, error.message, 404);
  }
}

async function getMyDossiers(req, res, next) {
  try {
    const dossiers = await dossierService.getUserDossiers(req.user.id);
    return ApiResponse.success(res, { dossiers });
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  createDossier,
  addApplicants,
  updateStep,
  getDossier,
  getMyDossiers,
};
