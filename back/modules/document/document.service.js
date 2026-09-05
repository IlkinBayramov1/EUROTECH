const prisma = require('../../config/db');
const notificationService = require('../notification/notification.service');
const { generateToken } = require('../../utils/jwt.util');

async function uploadDocument({ dossierId, applicantId, requiredDocumentType, isMandatory, file }) {
  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const document = await prisma.applicantDocument.create({
    data: {
      dossierId,
      applicantId,
      requiredDocumentType,
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
      status: 'PENDING',
    },
  });

  await prisma.dossier.update({
    where: { id: dossierId },
    data: { currentStep: 5 },
  });

  return document;
}

async function reviewDocument({ documentId, status, operatorNotes, reviewerUserId }) {
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

  return document;
}

async function getSignedUrl(documentId, currentUser) {
  const document = await prisma.applicantDocument.findUnique({
    where: { id: documentId },
    include: { dossier: true },
  });

  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const isOwner = document.dossier.userId === currentUser.id;

  if (!isStaff && !isOwner) {
    const error = new Error('Security Alert: Access denied. Cross-tenant IDOR violation detected.');
    error.statusCode = 403;
    throw error;
  }

  // Generate 15-minute temporary signed token for download
  const signedToken = generateToken({
    documentId: document.id,
    userId: currentUser.id,
    purpose: 'DOWNLOAD_SIGNED_URL',
  }, '15m');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const signedUrl = `/api/v1/documents/${document.id}/download?token=${signedToken}`;

  return {
    documentId: document.id,
    fileName: document.fileName,
    signedUrl,
    expiresAt,
  };
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

module.exports = {
  uploadDocument,
  reviewDocument,
  getSignedUrl,
  sendOperatorFeedback,
};
