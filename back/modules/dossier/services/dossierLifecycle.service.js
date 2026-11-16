const prisma = require('../../../config/db');
const { generateDossierNumber } = require('../../../utils/dossierCode.util');
const { calculatePortalFees } = require('../../../utils/finance.util');
const { getPricingCatalog } = require('../../service/pricingConfig.service');

async function createDossier({ userId, portalType = 'INDIVIDUAL', countryId, visaCategoryId, costCenter, department, package: selectedPackage, services, applicantsCount = 1, applicants, primaryApplicant }) {
  const country = await prisma.country.findUnique({ where: { id: countryId } });
  const visaCategory = await prisma.visaCategory.findUnique({ where: { id: visaCategoryId } });

  if (!country || !visaCategory) {
    throw new Error('Invalid country or visa category');
  }

  const catalog = await getPricingCatalog();
  const effectivePax = Array.isArray(applicants) && applicants.length > 0 ? applicants.length : Math.max(1, Number(applicantsCount) || 1);
  const resolvedPkg = selectedPackage || (services && services.activePackage) || 'standard';

  const fees = calculatePortalFees({
    portalType,
    paxCount: effectivePax,
    activePackage: resolvedPkg,
    services,
    baseConsularFee: Number(visaCategory.baseFee) || catalog.baseFees?.schengenShortStayFeeEur || 80.0,
    catalog,
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
      governmentFee: fees.govFeePerPax,
      serviceFee: fees.serviceFeePerPaxForDossier,
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

  // Automatically create the primary applicant and any co-applicants in database
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const pApp = primaryApplicant || (Array.isArray(applicants) && applicants[0]) || {};
    const nameParts = (user?.fullName || '').trim().split(' ').filter(Boolean);
    const firstName = pApp.firstName || nameParts[0] || 'Müştəri';
    const lastName = pApp.lastName || nameParts.slice(1).join(' ') || '';
    const passportNumber = pApp.passportNumber || user?.passportNumber || '';
    const nationality = pApp.nationality || 'AZ';
    const gender = pApp.gender || 'MALE';
    const birthDate = pApp.birthDate || pApp.dob ? new Date(pApp.birthDate || pApp.dob) : null;

    await prisma.applicant.create({
      data: {
        dossierId: dossier.id,
        firstName,
        lastName,
        passportNumber,
        nationality,
        gender,
        birthDate: birthDate && !isNaN(birthDate.getTime()) ? birthDate : null,
        familyRole: 'PRIMARY',
        formDataJson: {
          firstName,
          lastName,
          passportNumber,
          homeEmail: user?.email || '',
          homePhone: user?.phone || '',
          nationality: nationality === 'AZ' ? 'Azerbaijan' : nationality,
          gender,
          destination: country.nameEn,
          purpose: 'Tourism',
          ...(pApp.formDataJson || {}),
        },
      },
    });

    // If co-applicants were supplied during creation, save them directly to database
    if (Array.isArray(applicants) && applicants.length > 1) {
      for (let i = 1; i < applicants.length; i++) {
        const coApp = applicants[i];
        if (!coApp || (!coApp.firstName && !coApp.lastName)) continue;
        const coDob = coApp.birthDate || coApp.dob ? new Date(coApp.birthDate || coApp.dob) : null;
        await prisma.applicant.create({
          data: {
            dossierId: dossier.id,
            firstName: coApp.firstName || 'Co-Applicant',
            lastName: coApp.lastName || '',
            passportNumber: coApp.passportNumber || '',
            nationality: coApp.nationality || 'AZ',
            gender: coApp.gender || 'MALE',
            birthDate: coDob && !isNaN(coDob.getTime()) ? coDob : null,
            familyRole: coApp.familyRole || 'SPOUSE',
            formDataJson: {
              firstName: coApp.firstName,
              lastName: coApp.lastName,
              passportNumber: coApp.passportNumber || '',
              nationality: coApp.nationality || 'Azerbaijan',
              destination: country.nameEn,
              ...(coApp.formDataJson || {}),
            },
          },
        });
      }
    }
  } catch (err) {
    console.error('Error auto-creating primary applicant for dossier:', err);
  }

  const result = await prisma.dossier.findUnique({
    where: { id: dossier.id },
    include: {
      country: true,
      visaCategory: {
        include: {
          requiredDocTypes: true,
        },
      },
      applicants: true,
    },
  });

  if (result && Array.isArray(result.applicants)) {
    result.applicants.sort((a, b) => (a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0));
  }

  return result;
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
          companyName: true,
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
      groupBatch: {
        include: {
          invoices: true,
          appointments: {
            include: { timeSlot: true },
          },
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

  if (dossier && Array.isArray(dossier.applicants)) {
    dossier.applicants.sort((a, b) => (a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0));
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
          companyName: true,
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
      groupBatch: {
        include: {
          invoices: true,
          appointments: {
            include: { timeSlot: true },
          },
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
    if (dossier.applicants && dossier.applicants.length > 0) {
      dossier.applicants.sort((a, b) => (a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0));
    }
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
