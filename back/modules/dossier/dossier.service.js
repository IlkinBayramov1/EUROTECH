const prisma = require('../../config/db');
const { generateDossierNumber } = require('../../utils/dossierCode.util');

async function createDossier({ userId, portalType, countryId, visaCategoryId, costCenter, department }) {
  const country = await prisma.country.findUnique({ where: { id: countryId } });
  const visaCategory = await prisma.visaCategory.findUnique({ where: { id: visaCategoryId } });

  if (!country || !visaCategory) {
    throw new Error('Invalid country or visa category');
  }

  let serviceFee = 120.0;
  if (portalType === 'CORPORATE') {
    serviceFee = 150.0;
  } else if (portalType === 'GROUP_AGENT') {
    serviceFee = 90.0;
  }

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
      governmentFee: visaCategory.baseFee,
      serviceFee,
      totalAmount: visaCategory.baseFee + serviceFee,
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

  return dossier;
}

async function addApplicants(dossierId, applicantsData) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const createdApplicants = await Promise.all(
    applicantsData.map((applicant) =>
      prisma.applicant.create({
        data: {
          dossierId,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          passportNumber: applicant.passportNumber,
          birthDate: applicant.birthDate ? new Date(applicant.birthDate) : undefined,
          nationality: applicant.nationality || 'AZ',
          gender: applicant.gender,
          formDataJson: applicant.formDataJson || {},
        },
      })
    )
  );

  if (dossier.portalType === 'GROUP_AGENT') {
    const totalPassengers = dossier.applicants.length + createdApplicants.length;
    const governmentFee = dossier.governmentFee;
    const serviceFee = 90.0;
    const updatedTotal = (governmentFee + serviceFee) * totalPassengers + dossier.extraServicesFee;

    await prisma.dossier.update({
      where: { id: dossierId },
      data: {
        totalAmount: updatedTotal,
        currentStep: 3,
      },
    });
  } else {
    await prisma.dossier.update({
      where: { id: dossierId },
      data: { currentStep: 3 },
    });
  }

  return createdApplicants;
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
      country: true,
      visaCategory: {
        include: {
          dynamicFields: true,
          requiredDocTypes: true,
        },
      },
      applicants: true,
      documents: true,
      services: true,
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
  return prisma.dossier.findMany({
    where: { userId },
    include: {
      country: true,
      visaCategory: true,
      applicants: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  createDossier,
  addApplicants,
  updateStep,
  getDossierById,
  getUserDossiers,
};
