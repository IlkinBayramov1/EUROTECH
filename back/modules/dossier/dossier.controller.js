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

async function updateApplicantForm(req, res, next) {
  try {
    const { dossierId, applicantId } = req.params;
    const applicant = await dossierService.updateApplicantForm(dossierId, applicantId, req.body.formData || req.body);
    return ApiResponse.success(res, { applicant }, 'Applicant form draft saved successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getApplicationFormPdf(req, res, next) {
  try {
    const { dossierId, applicantId } = req.params;
    const customData = { ...req.query, ...req.body };
    const result = await dossierService.generateApplicationFormPdf(dossierId, applicantId, customData);

    if (req.query.download === 'true' || req.query.download === '1') {
      return res.download(result.filePath, result.fileName);
    }

    return ApiResponse.success(res, {
      fileName: result.fileName,
      downloadUrl: result.downloadUrl,
      fileSize: result.pdfBytes.length,
    }, 'Application form PDF generated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getDossierSummaryPdf(req, res, next) {
  try {
    const { dossierId } = req.params;
    const result = await dossierService.generateDossierSummaryPdf(dossierId);

    if (req.query.download === 'true' || req.query.download === '1') {
      return res.download(result.filePath, result.fileName);
    }

    return ApiResponse.success(res, {
      fileName: result.fileName,
      downloadUrl: result.downloadUrl,
      fileSize: result.pdfBytes.length,
    }, 'Dossier summary PDF generated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function deleteApplicant(req, res, next) {
  try {
    const { dossierId, applicantId } = req.params;
    const result = await dossierService.deleteApplicant(dossierId, applicantId, req.user);
    return ApiResponse.success(res, result, 'Applicant deleted successfully');
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return ApiResponse.error(res, error.message, statusCode);
  }
}

async function getDossierTracking(req, res, next) {
  try {
    const identifier = req.params.referenceNumber || req.params.dossierId || req.query.ref;
    const result = await dossierService.getDossierTracking(identifier, req.user);
    return ApiResponse.success(res, result, 'Tracking data retrieved successfully');
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    return ApiResponse.error(res, error.message, statusCode);
  }
}

module.exports = {
  createDossier,
  addApplicants,
  updateStep,
  getDossier,
  getMyDossiers,
  updateApplicantForm,
  deleteApplicant,
  getApplicationFormPdf,
  getDossierSummaryPdf,
  getDossierTracking,
};

