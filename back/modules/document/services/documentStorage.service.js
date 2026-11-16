const path = require('path');
const fs = require('fs');
const prisma = require('../../../config/db');
const env = require('../../../config/env');
const notificationService = require('../../notification/notification.service');
const { inspectMagicBytes } = require('../../../middlewares/upload.middleware');

function parseBool(val, defaultVal = false) {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return defaultVal;
}

async function uploadDocument({ dossierId, applicantId, corporateEmployeeId, requiredDocumentType, isMandatory, isSharedWithFamily, file }) {
  let resolvedApplicantId = applicantId;
  if (dossierId) {
    const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      throw new Error('Dossier not found');
    }
    if (!resolvedApplicantId || ['primary', 'app-1', 'primary-applicant'].includes(resolvedApplicantId)) {
      const pApp = await prisma.applicant.findFirst({
        where: { dossierId },
        orderBy: { id: 'asc' },
      });
      if (pApp) resolvedApplicantId = pApp.id;
    }
  }

  // Validate magic bytes to prevent forged file extensions
  if (file && file.path) {
    const detectedType = inspectMagicBytes(file.path);
    if (!detectedType) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      const error = new Error('Security Error: Malicious or invalid file header (magic bytes mismatch).');
      error.statusCode = 400;
      throw error;
    }
  }

  const mandatoryFlag = parseBool(isMandatory, true);
  const sharedFlag = parseBool(isSharedWithFamily, false);

  // Check if an existing document for this applicant and requiredDocumentType already exists (unless type is OTHER)
  let existingDoc = null;
  if (requiredDocumentType !== 'OTHER' && (dossierId || corporateEmployeeId)) {
    existingDoc = await prisma.applicantDocument.findFirst({
      where: {
        dossierId: dossierId || undefined,
        applicantId: resolvedApplicantId || undefined,
        corporateEmployeeId: corporateEmployeeId || undefined,
        requiredDocumentType,
      },
    });
  }

  let document;
  if (existingDoc) {
    document = await prisma.applicantDocument.update({
      where: { id: existingDoc.id },
      data: {
        fileUrl: `/uploads/${file.filename}`,
        fileName: file.originalname,
        originalFileName: file.originalname,
        fileSize: file.size,
        isMandatory: mandatoryFlag,
        isSharedWithFamily: sharedFlag,
        status: 'PENDING',
        operatorNotes: null,
      },
    });
  } else {
    document = await prisma.applicantDocument.create({
      data: {
        dossierId: dossierId || null,
        applicantId: resolvedApplicantId || null,
        corporateEmployeeId: corporateEmployeeId || null,
        requiredDocumentType,
        fileUrl: `/uploads/${file.filename}`,
        fileName: file.originalname,
        originalFileName: file.originalname,
        fileSize: file.size,
        isMandatory: mandatoryFlag,
        isSharedWithFamily: sharedFlag,
        status: 'PENDING',
      },
    });
  }

  if (dossierId) {
    await prisma.dossier.update({
      where: { id: dossierId },
      data: { currentStep: 5 },
    });
  }

  return document;
}

async function reviewDocument(docIdOrPayload, maybeStatus, maybeNotes, maybeUserId) {
  let documentId, status, operatorNotes, reviewerUserId;
  if (typeof docIdOrPayload === 'object' && docIdOrPayload !== null) {
    documentId = docIdOrPayload.documentId;
    status = docIdOrPayload.status;
    operatorNotes = docIdOrPayload.operatorNotes;
    reviewerUserId = docIdOrPayload.reviewerUserId;
  } else {
    documentId = docIdOrPayload;
    status = maybeStatus;
    operatorNotes = maybeNotes;
    reviewerUserId = maybeUserId;
  }

  const document = await prisma.applicantDocument.update({
    where: { id: documentId },
    data: {
      status,
      operatorNotes,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
    },
    include: {
      dossier: {
        include: {
          user: true,
          documents: true,
        },
      },
    },
  });

  const allVerified = document.dossier.documents.every((doc) => doc.status === 'VERIFIED');

  if (allVerified) {
    await prisma.dossier.update({
      where: { id: document.dossierId },
      data: { status: 'UNDER_REVIEW' },
    });
  } else if (status === 'NEEDS_CORRECTION' || status === 'REJECTED') {
    await prisma.dossier.update({
      where: { id: document.dossierId },
      data: { status: 'NEEDS_CORRECTION' },
    });
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: reviewerUserId,
        action: 'DOCUMENT_REVIEWED',
        details: {
          documentId,
          dossierId: document.dossierId,
          docType: document.requiredDocumentType,
          status,
          operatorNotes: operatorNotes || null,
        },
      },
    });
  } catch (auditErr) {
    console.warn('Audit log creation failed in reviewDocument:', auditErr.message);
  }

  return document;
}

async function sendOperatorFeedback(dossierId, operatorNotes = '') {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      user: true,
      documents: true,
    },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  await notificationService.sendDocumentCorrectionNotification(
    dossier.user.email,
    dossier.user.fullName,
    dossier.dossierNumber,
    operatorNotes
  );

  return { message: 'Feedback email sent to client successfully' };
}

async function deleteDocument(documentId, currentUser) {
  const document = await prisma.applicantDocument.findUnique({
    where: { id: documentId },
    include: {
      dossier: {
        include: { groupBatch: true },
      },
    },
  });

  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const isOwner = document.dossier.userId === currentUser.id;
  const isGroupOwner = document.dossier.groupBatch?.userId === currentUser.id;

  if (!isStaff && !isOwner && !isGroupOwner) {
    const error = new Error('Security Alert: Access denied. Cross-tenant IDOR violation detected.');
    error.statusCode = 403;
    throw error;
  }

  if (document.status === 'VERIFIED' && !isStaff) {
    const error = new Error('Verified documents cannot be deleted by applicants. Please contact consular support.');
    error.statusCode = 400;
    throw error;
  }

  try {
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    const filePath = path.join(uploadDir, path.basename(document.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Physical file deletion warning:', err.message);
  }

  await prisma.applicantDocument.delete({
    where: { id: documentId },
  });

  return { message: 'Document deleted successfully', documentId };
}

async function toggleFamilySharing(documentId, isSharedWithFamily, user) {
  const document = await prisma.applicantDocument.findUnique({
    where: { id: documentId },
    include: { dossier: true },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (user && user.role === 'CLIENT' && document.dossier.userId !== user.id) {
    const error = new Error('Access denied: You do not own this document dossier.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.applicantDocument.update({
    where: { id: documentId },
    data: {
      isSharedWithFamily: Boolean(isSharedWithFamily),
    },
  });

  return updated;
}

module.exports = {
  uploadDocument,
  reviewDocument,
  sendOperatorFeedback,
  deleteDocument,
  toggleFamilySharing,
};
