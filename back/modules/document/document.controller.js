const documentService = require('./document.service');
const ApiResponse = require('../../core/api.response');

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'File is required', 400);
    }

    const { dossierId, applicantId, requiredDocumentType, isMandatory } = req.body;
    const document = await documentService.uploadDocument({
      dossierId,
      applicantId,
      requiredDocumentType,
      isMandatory,
      file: req.file,
    });

    return ApiResponse.success(res, { document }, 'Document uploaded successfully', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function reviewDocument(req, res, next) {
  try {
    const { documentId } = req.params;
    const { status, operatorNotes } = req.body;

    const document = await documentService.reviewDocument({
      documentId,
      status,
      operatorNotes,
      reviewerUserId: req.user.id,
    });

    return ApiResponse.success(res, { document }, 'Document reviewed successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function sendFeedback(req, res, next) {
  try {
    const { dossierId } = req.params;
    const { operatorNotes } = req.body;

    const result = await documentService.sendOperatorFeedback(dossierId, operatorNotes);
    return ApiResponse.success(res, result, 'Feedback sent to customer');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

module.exports = {
  uploadDocument,
  reviewDocument,
  sendFeedback,
};
