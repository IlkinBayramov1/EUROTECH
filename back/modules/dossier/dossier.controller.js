const fs = require('fs');
const path = require('path');
const dossierService = require('./dossier.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');
const { sendDownloadSafely } = require('../../utils/download.util');

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
    const { download, format, ...customData } = { ...req.query, ...req.body };
    const result = await dossierService.generateApplicationFormPdf(dossierId, applicantId, customData);

    if (req.query.download === 'true' || req.query.download === '1') {
      return sendDownloadSafely(res, {
        filePath: result.filePath,
        fileName: result.fileName,
        buffer: result.pdfBytes,
        contentType: 'application/pdf',
      });
    }

    return ApiResponse.success(res, {
      fileName: result.fileName,
      downloadUrl: result.downloadUrl,
      fileUrl: result.downloadUrl,
      schengenPdfUrl: result.downloadUrl,
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
      return sendDownloadSafely(res, {
        filePath: result.filePath,
        fileName: result.fileName,
        buffer: result.pdfBytes,
        contentType: 'application/pdf',
      });
    }

    return ApiResponse.success(res, {
      fileName: result.fileName,
      downloadUrl: result.downloadUrl,
      fileUrl: result.downloadUrl,
      summaryPdfUrl: result.downloadUrl,
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

async function getApplicantDetails(req, res, next) {
  try {
    const { dossierId, applicantId } = req.params;
    const result = await dossierService.getApplicantDetails(dossierId, applicantId, req.user);
    return ApiResponse.success(res, result, 'Applicant details retrieved successfully');
  } catch (error) {
    const statusCode = error.statusCode || (error.message.includes('not found') ? 404 : 400);
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

async function getArchiveZip(req, res, next) {
  try {
    const { dossierId } = req.params;
    const prisma = require('../../config/db');
    const dossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        documents: true,
        applicants: { include: { documents: true } },
      },
    });

    if (!dossier) {
      return ApiResponse.error(res, 'Dossier not found', 404);
    }

    const { archiveDossierFiles } = require('../../utils/zip.util');
    const env = require('../../config/env');

    const uploadDir = path.resolve(env.UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const applicantNameMap = new Map();
    (dossier.applicants || []).forEach((a, idx) => {
      const fullName = `${a.firstName || 'Member'}_${a.lastName || idx + 1}`.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      applicantNameMap.set(a.id, fullName);
    });

    const seenDocIds = new Set();
    const allDocs = [];
    const pushUniqueDoc = (d) => {
      if (!d || (d.id && seenDocIds.has(d.id))) return;
      if (d.id) seenDocIds.add(d.id);
      allDocs.push(d);
    };

    (dossier.documents || []).forEach(pushUniqueDoc);
    (dossier.applicants || []).forEach((a) => {
      (a.documents || []).forEach(pushUniqueDoc);
    });

    const fileEntries = [];
    allDocs.forEach((d) => {
      let resolvedPath = null;
      if (d.filePath && fs.existsSync(d.filePath)) {
        resolvedPath = d.filePath;
      } else if (d.fileUrl) {
        const localPath = path.join(uploadDir, path.basename(d.fileUrl));
        if (fs.existsSync(localPath)) resolvedPath = localPath;
      }
      if (!resolvedPath) return;

      const ownerPrefix = d.applicantId && applicantNameMap.get(d.applicantId)
        ? `${applicantNameMap.get(d.applicantId)}_`
        : '';
      const docTypePrefix = d.requiredDocumentType
        ? `${String(d.requiredDocumentType).replace(/[^a-zA-Z0-9_-]/g, '_')}_`
        : '';
      const baseName = d.fileName
        ? String(d.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
        : path.basename(resolvedPath);

      fileEntries.push({
        filePath: resolvedPath,
        archiveName: `${ownerPrefix}${docTypePrefix}${baseName}`,
      });
    });

    // Include Summary PDF & Multi-Page Checklist PDF so consular archive is always complete
    try {
      const { generateDossierSummaryPdf } = require('./services/dossierSummaryPdf.service');
      const summaryRes = await generateDossierSummaryPdf(dossier.id);
      if (summaryRes?.filePath && fs.existsSync(summaryRes.filePath)) {
        fileEntries.push({
          filePath: summaryRes.filePath,
          archiveName: summaryRes.fileName,
        });
      }
    } catch (sumErr) {
      console.warn('Could not auto-generate summary for zip:', sumErr.message);
    }

    try {
      const { generateChecklistPdf } = require('../document/services/documentExport.service');
      const checklistRes = await generateChecklistPdf(dossier.id, null);
      if (checklistRes?.filePath && fs.existsSync(checklistRes.filePath)) {
        fileEntries.push({
          filePath: checklistRes.filePath,
          archiveName: checklistRes.fileName,
        });
      }
    } catch (chkErr) {
      console.warn('Could not auto-generate checklist for zip:', chkErr.message);
    }

    const safeRef = String(dossier.dossierNumber || dossier.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const manifestPath = path.join(uploadDir, `manifest_${safeRef}_${Date.now()}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify({
      dossierNumber: dossier.dossierNumber,
      status: dossier.status,
      portalType: dossier.portalType,
      totalAmount: dossier.totalAmount,
      applicantsCount: dossier.applicants?.length || 0,
      documentsCount: allDocs.length,
      createdAt: dossier.createdAt,
      note: 'Official Consular Electronic Archive Record',
    }, null, 2));
    fileEntries.push({
      filePath: manifestPath,
      archiveName: `manifest_${safeRef}.json`,
    });

    const archiveResult = await archiveDossierFiles(dossier.dossierNumber, fileEntries);

    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { archivedZipUrl: archiveResult.fileUrl },
    });

    if (req.query.download === 'true' || req.query.download === '1') {
      return sendDownloadSafely(res, {
        filePath: archiveResult.filePath,
        fileName: archiveResult.fileName,
        contentType: 'application/zip',
      });
    }

    return ApiResponse.success(res, {
      fileName: archiveResult.fileName,
      filePath: archiveResult.filePath,
      downloadUrl: archiveResult.fileUrl,
      fileUrl: archiveResult.fileUrl,
      archiveZipUrl: archiveResult.fileUrl,
    }, 'Dossier archive ZIP generated successfully');
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
  updateApplicantForm,
  deleteApplicant,
  getApplicantDetails,
  getApplicationFormPdf,
  getDossierSummaryPdf,
  getDossierTracking,
  getArchiveZip,
};

