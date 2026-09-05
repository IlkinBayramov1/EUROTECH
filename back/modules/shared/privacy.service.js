const prisma = require('../../config/db');
const privacyConfig = require('../../config/privacy.config');

async function anonymizeUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

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

    // 2. Anonymize Applicants
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
      },
    });

    // 3. Preserve Audit Log Integrity (Action & Timestamp preserved, PII anonymized)
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

async function exportUserData(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      phone: true,
      companyName: true,
      preferredLanguage: true,
      createdAt: true,
      dossiers: {
        include: {
          applicants: true,
          documents: true,
          services: true,
          transactions: true,
        },
      },
      auditLogs: true,
    },
  });

  if (!user) throw new Error('User not found');

  return {
    gdprNotice: 'EuroTech GDPR Data Export Package',
    exportedAt: new Date().toISOString(),
    user,
  };
}

module.exports = {
  anonymizeUser,
  exportUserData,
};
