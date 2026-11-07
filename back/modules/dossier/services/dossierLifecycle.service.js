const prisma = require('../../../config/db');
const { generateDossierNumber } = require('../../../utils/dossierCode.util');
const { calculatePortalFees } = require('../../../utils/finance.util');

async function createDossier({ userId, portalType = 'INDIVIDUAL', countryId, visaCategoryId, costCenter, department, package: selectedPackage, services, applicantsCount = 1 }) {
  const country = await prisma.country.findUnique({ where: { id: countryId } });
  const visaCategory = await prisma.visaCategory.findUnique({ where: { id: visaCategoryId } });

  if (!country || !visaCategory) {
    throw new Error('Invalid country or visa category');
  }

  const fees = calculatePortalFees({
    portalType,
    paxCount: Math.max(1, Number(applicantsCount) || 1),
    activePackage: selectedPackage || (services && services.activePackage) || 'standard',
    services,
    baseConsularFee: Number(visaCategory.baseFee) || 80.0,
  });

  const dossierNumber = generateDossierNumber(country.code, 'AZ');

  const dossier = await prisma.dossier.create({
    data: {
      dossierNumber,
      portalType,
      userId,
      countryId,
      visaCategoryId,
      currentStep: 1,
      status: 'RECEIVED',
      costCenter,
      department,
      governmentFee: Number(visaCategory.baseFee) || 80.0,
      serviceFee: fees.serviceFeePerPax,
      extraServicesFee: fees.extraServicesTotalForDossier,
      totalAmount: fees.grandTotalEur,
      statusHistory: {
        create: {
          fromStatus: 'RECEIVED',
          toStatus: 'RECEIVED',
          changedByUserId: userId,
          notes: 'Dossier initialized at Step 1',
        },
      },
    },
    include: {
      country: true,
      visaCategory: true,
    },
  });

  // Automatically create the primary applicant in database using user details
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const nameParts = (user.fullName || '').trim().split(' ').filter(Boolean);
      const firstName = nameParts[0] || 'Müştəri';
      const lastName = nameParts.slice(1).join(' ') || '';
      await prisma.applicant.create({
        data: {
          dossierId: dossier.id,
          firstName,
          lastName,
          passportNumber: user.passportNumber || '',
          nationality: 'AZ',
          formDataJson: {
            firstName,
            lastName,
            passportNumber: user.passportNumber || '',
            homeEmail: user.email || '',
            homePhone: user.phone || '',
            nationality: 'Azerbaijan',
          },
        },
      });
    }
  } catch (err) {
    console.error('Error auto-creating primary applicant for dossier:', err);
  }

  return await prisma.dossier.findUnique({
    where: { id: dossier.id },
    include: {
      country: true,
      visaCategory: true,
      applicants: true,
    },
  });
}

async function updateStep(dossierId, step) {
  return prisma.dossier.update({
    where: { id: dossierId },
    data: { currentStep: step },
  });
}

async function getDossierById(dossierId) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          passportNumber: true,
          role: true,
          preferredLanguage: true,
        },
      },
      country: true,
      visaCategory: {
        include: {
          dynamicFields: true,
          requiredDocTypes: true,
        },
      },
      applicants: {
        orderBy: { id: 'asc' },
      },
      documents: true,
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
      services: true,
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  return dossier;
}

async function getUserDossiers(userId) {
  let dossiers = await prisma.dossier.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          passportNumber: true,
          role: true,
          preferredLanguage: true,
        },
      },
      country: true,
      visaCategory: {
        include: {
          dynamicFields: true,
          requiredDocTypes: true,
        },
      },
      applicants: {
        orderBy: { id: 'asc' },
      },
      documents: true,
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
      services: true,
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Ensure every existing dossier in DB has at least 1 primary applicant in database
  for (const dossier of dossiers) {
    if ((!dossier.applicants || dossier.applicants.length === 0) && dossier.user) {
      try {
        const nameParts = (dossier.user.fullName || '').trim().split(' ').filter(Boolean);
        const firstName = nameParts[0] || 'Müştəri';
        const lastName = nameParts.slice(1).join(' ') || '';
        const created = await prisma.applicant.create({
          data: {
            dossierId: dossier.id,
            firstName,
            lastName,
            passportNumber: dossier.user.passportNumber || 'A00000000',
            familyRole: 'PRIMARY',
            formDataJson: {
              firstName,
              lastName,
              passportNumber: dossier.user.passportNumber || '',
              homeEmail: dossier.user.email || '',
              homePhone: dossier.user.phone || '',
            },
          },
        });
        dossier.applicants = [created];
      } catch (err) {}
    }
  }

  return dossiers;
}

module.exports = {
  createDossier,
  updateStep,
  getDossierById,
  getUserDossiers,
};
