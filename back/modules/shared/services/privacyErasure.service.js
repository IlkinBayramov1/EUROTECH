const fs = require('fs');
const path = require('path');
const prisma = require('../../../config/db');
const privacyConfig = require('../../../config/privacy.config');
const env = require('../../../config/env');

const uploadDir = path.resolve(env.UPLOAD_DIR || './uploads');
const archiveDir = path.resolve(env.ARCHIVE_DIR || './archives');

function safelyDeleteFile(relativeOrAbsoluteUrl) {
  if (!relativeOrAbsoluteUrl) return;
  try {
    let filePath = relativeOrAbsoluteUrl;
    if (filePath.startsWith('/uploads/') || filePath.startsWith('uploads/')) {
      filePath = path.join(uploadDir, path.basename(filePath));
    } else if (filePath.startsWith('/archives/') || filePath.startsWith('archives/')) {
      filePath = path.join(archiveDir, path.basename(filePath));
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[GDPR Erasure] Could not delete physical file ${relativeOrAbsoluteUrl}:`, err.message);
  }
}

async function anonymizeUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  // Find all user dossiers & documents before database scrubbing
  const dossiers = await prisma.dossier.findMany({
    where: { userId },
    include: { documents: true },
  });
  const dossierIds = dossiers.map((d) => d.id);

  // Physically delete uploaded documents & archived ZIPs from disk
  for (const dossier of dossiers) {
    if (dossier.archivedZipUrl) {
      safelyDeleteFile(dossier.archivedZipUrl);
    }
    for (const doc of dossier.documents) {
      if (doc.fileUrl) {
        safelyDeleteFile(doc.fileUrl);
      }
    }
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Anonymize User PII
    const anonymizedEmail = `deleted_user_${user.id.substring(0, 8)}@privacy.anonymized`;
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        fullName: 'Anonymized User',
        phone: null,
        companyName: null,
        passportNumber: null,
        passportNumberEncrypted: null,
        passportNumberHash: null,
        isVerified: false,
      },
    });

    // 2. Anonymize Applicants (strip all PII, names, birth dates, nationality, and formDataJson)
    const dossiers = await tx.dossier.findMany({ where: { userId } });
    const dossierIds = dossiers.map((d) => d.id);

    await tx.applicant.updateMany({
      where: { dossierId: { in: dossierIds } },
      data: {
        firstName: 'Anonymized',
        lastName: 'Applicant',
        passportNumber: 'ANONYMIZED',
        passportNumberEncrypted: null,
        passportNumberHash: null,
        birthDate: null,
        nationality: null,
        gender: null,
        formDataJson: null,
      },
    });

    // 3. Anonymize Document references & notes
    await tx.applicantDocument.updateMany({
      where: { dossierId: { in: dossierIds } },
      data: {
        fileName: 'anonymized_document.pdf',
        fileUrl: '',
        operatorNotes: null,
      },
    });

    // 4. Anonymize Appointment notes
    await tx.appointment.updateMany({
      where: { userId },
      data: {
        notes: null,
      },
    });

    // 5. Preserve Audit Log Integrity (Action & Timestamp preserved, PII anonymized)
    await tx.auditLog.create({
      data: {
        userId,
        action: 'GDPR_RIGHT_TO_BE_FORGOTTEN_EXECUTED',
        details: { retentionPolicyDays: privacyConfig.PASSPORT_RETENTION_DAYS },
      },
    });

    return { success: true, message: 'User PII successfully anonymized according to GDPR policy.' };
  });
}

module.exports = {
  anonymizeUser,
};
