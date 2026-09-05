const prisma = require('../../config/db');
const notificationService = require('../notification/notification.service');

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
  sendOperatorFeedback,
};
