const privacyService = require('./privacy.service');
const ApiResponse = require('../../core/api.response');

async function anonymizeMe(req, res, next) {
  try {
    const result = await privacyService.anonymizeUser(req.user.id);
    return ApiResponse.success(res, result, 'Your personal data has been anonymized according to GDPR policy.');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function exportMyData(req, res, next) {
  try {
    const data = await privacyService.exportUserData(req.user.id);
    return ApiResponse.success(res, data, 'User GDPR data export generated successfully.');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function exportMyDataPdf(req, res, next) {
  try {
    const result = await privacyService.generateGdprDossierPdf(req.user.id);
    if (req.query.download === 'true' || req.query.download === '1') {
      return res.download(result.filePath, result.fileName);
    }
    return ApiResponse.success(res, {
      fileName: result.fileName,
      downloadUrl: result.downloadUrl,
      fileSize: result.pdfBytes.length,
    }, 'GDPR data dossier PDF generated successfully.');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  anonymizeMe,
  exportMyData,
  exportMyDataPdf,
};
