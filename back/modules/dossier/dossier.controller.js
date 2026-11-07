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
      return res.download(result.filePath, result.fileName);
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
    const path = require('path');
    const env = require('../../config/env');
    const fs = require('fs');

    const filePaths = [];
    const allDocs = [...(dossier.documents || [])];
    (dossier.applicants || []).forEach(a => {
      if (a.documents) allDocs.push(...a.documents);
    });

    const uploadDir = path.resolve(env.UPLOAD_DIR);
    allDocs.forEach(d => {
      if (d.filePath && fs.existsSync(d.filePath)) {
        filePaths.push(d.filePath);
      } else if (d.fileUrl) {
        const localPath = path.join(uploadDir, path.basename(d.fileUrl));
        if (fs.existsSync(localPath)) filePaths.push(localPath);
      }
    });

    // If no document files uploaded yet, generate summary PDF & manifest so ZIP is never empty
    if (filePaths.length === 0) {
      try {
        const { generateDossierSummaryPdf } = require('./services/dossierSummaryPdf.service');
        const summaryRes = await generateDossierSummaryPdf(dossier.id);
        if (summaryRes?.filePath && fs.existsSync(summaryRes.filePath)) {
          filePaths.push(summaryRes.filePath);
        }
      } catch (sumErr) {
        console.warn('Could not auto-generate summary for zip:', sumErr.message);
      }

      const manifestPath = path.join(uploadDir, `manifest_${dossier.dossierNumber}.json`);
      fs.writeFileSync(manifestPath, JSON.stringify({
        dossierNumber: dossier.dossierNumber,
        status: dossier.status,
        portalType: dossier.portalType,
        totalAmount: dossier.totalAmount,
        createdAt: dossier.createdAt,
        note: 'Official Consular Electronic Archive Record'
      }, null, 2));
      filePaths.push(manifestPath);
    }

    const archiveResult = await archiveDossierFiles(dossier.dossierNumber, filePaths);

    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { archivedZipUrl: archiveResult.fileUrl },
    });

    if (req.query.download === 'true' || req.query.download === '1') {
      return res.download(archiveResult.filePath, archiveResult.fileName);
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
  getApplicationFormPdf,
  getDossierSummaryPdf,
  getDossierTracking,
  getArchiveZip,
};

