const prisma = require('../../../config/db');
const { syncGroupFinancialsInTx } = require('./agentGroup.service');

async function addApplicantToGroup(groupId, userId, applicantData) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: true },
  });

  if (!group) {
    const error = new Error('Group not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  let dossier = group.dossiers[0];
  if (!dossier) {
    let country = await prisma.country.findFirst();
    if (!country) {
      country = await prisma.country.create({
        data: { code: 'HU', nameAz: 'Macaristan', nameEn: 'Hungary', nameRu: 'Vengriya' },
      });
    }
    let category = await prisma.visaCategory.findFirst({ where: { countryId: country.id } });
    if (!category) {
      category = await prisma.visaCategory.create({
        data: { countryId: country.id, code: 'SCHENGEN_TOURIST', nameAz: 'Sengen Turist', nameEn: 'Schengen Tourist', nameRu: 'Sengen Turist' },
      });
    }

    dossier = await prisma.dossier.create({
      data: {
        dossierNumber: `GRP-${group.code}-${Date.now().toString().slice(-4)}`,
        portalType: 'GROUP_AGENT',
        userId,
        groupBatchId: group.id,
        countryId: country.id,
        visaCategoryId: category.id,
      },
    });
  }

  const applicant = await prisma.applicant.create({
    data: {
      dossierId: dossier.id,
      firstName: applicantData.firstName || applicantData.name?.split(' ')[0] || 'Applicant',
      lastName: applicantData.lastName || applicantData.name?.split(' ').slice(1).join(' ') || '',
      passportNumber: applicantData.passportNumber || applicantData.passport || 'P0000000',
      formDataJson: applicantData.formData || null,
    },
  });

  await syncGroupFinancialsInTx(groupId, userId);

  return applicant;
}

async function removeApplicantFromGroup(groupId, applicantId, userId) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: { include: { applicants: true } } },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const belongs = group.dossiers.some((d) => d.applicants.some((a) => a.id === applicantId));
  if (!belongs) {
    const error = new Error('Applicant does not belong to this group');
    error.statusCode = 404;
    throw error;
  }

  const deleted = await prisma.applicant.delete({
    where: { id: applicantId },
  });

  await syncGroupFinancialsInTx(groupId, userId);

  return deleted;
}

async function saveApplicantFormInGroup(groupId, applicantId, formData, userId) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: { dossiers: { include: { applicants: true } } },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const targetApplicant = group.dossiers
    .flatMap((d) => d.applicants)
    .find((a) => a.id === applicantId);

  if (!targetApplicant) {
    const error = new Error('Applicant not found in this group');
    error.statusCode = 404;
    throw error;
  }

  const existingForm = targetApplicant.formDataJson && typeof targetApplicant.formDataJson === 'object'
    ? targetApplicant.formDataJson
    : {};

  const updateFields = {
    formDataJson: {
      ...existingForm,
      ...formData,
      lastSavedAt: new Date().toISOString(),
    },
  };

  if (formData.firstName) updateFields.firstName = formData.firstName;
  if (formData.lastName) updateFields.lastName = formData.lastName;
  if (formData.passportNumber) updateFields.passportNumber = formData.passportNumber;
  if (formData.birthDate || formData.dob) {
    const d = new Date(formData.birthDate || formData.dob);
    if (!isNaN(d.getTime())) updateFields.birthDate = d;
  }
  if (formData.nationality) updateFields.nationality = formData.nationality;
  if (formData.gender) updateFields.gender = formData.gender;

  return prisma.applicant.update({
    where: { id: applicantId },
    data: updateFields,
  });
}

async function getCustomerSelfFillData(groupId, applicantId) {
  const group = await prisma.groupBatch.findUnique({
    where: { id: groupId },
    include: {
      user: {
        select: {
          fullName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },
      dossiers: {
        include: {
          applicants: {
            where: { id: applicantId },
            include: { documents: true },
          },
        },
      },
    },
  });

  if (!group) {
    const error = new Error('Group not found or invalid link');
    error.statusCode = 404;
    throw error;
  }

  const applicant = group.dossiers?.[0]?.applicants?.[0];
  if (!applicant) {
    const error = new Error('Traveler record not found in this group');
    error.statusCode = 404;
    throw error;
  }

  return {
    group: {
      id: group.id,
      name: group.name,
      code: group.code,
      destination: group.destination,
      travelDate: group.travelDate,
      duration: group.duration,
      agencyName: group.user?.companyName || group.user?.fullName || 'EuroTech Travel Partner',
      agencyPhone: group.user?.phone,
      agencyEmail: group.user?.email,
    },
    applicant: {
      id: applicant.id,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      passportNumber: applicant.passportNumber,
      birthDate: applicant.birthDate,
      nationality: applicant.nationality,
      gender: applicant.gender,
      dossierId: applicant.dossierId,
      formDataJson: applicant.formDataJson || {},
      documents: applicant.documents || [],
    },
  };
}

async function submitCustomerSelfFill(groupId, applicantId, payload) {
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, dossier: { groupBatchId: groupId } },
    include: { dossier: true },
  });

  if (!applicant) {
    const error = new Error('Traveler not found in group');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (payload.firstName) updateData.firstName = payload.firstName;
  if (payload.lastName) updateData.lastName = payload.lastName;
  if (payload.passportNumber) updateData.passportNumber = payload.passportNumber;
  if (payload.birthDate || payload.dob) updateData.birthDate = new Date(payload.birthDate || payload.dob);
  if (payload.nationality) updateData.nationality = payload.nationality;
  if (payload.gender) updateData.gender = payload.gender;

  const currentJson = applicant.formDataJson || {};
  const mergedJson = {
    ...currentJson,
    ...(payload.formDataJson || payload.formData || {}),
    stayDuration: payload.stayDuration || currentJson.stayDuration,
    accommodation: payload.accommodation || currentJson.accommodation,
    contactEmail: payload.contactEmail || currentJson.contactEmail,
    contactPhone: payload.contactPhone || currentJson.contactPhone,
    dob: payload.birthDate || payload.dob || currentJson.dob,
    issueDate: payload.issueDate || currentJson.issueDate,
    expiryDate: payload.expiryDate || currentJson.expiryDate,
    selfFilledAt: new Date().toISOString(),
  };

  updateData.formDataJson = mergedJson;

  const updated = await prisma.applicant.update({
    where: { id: applicantId },
    data: updateData,
    include: { documents: true },
  });

  return updated;
}

module.exports = {
  addApplicantToGroup,
  removeApplicantFromGroup,
  saveApplicantFormInGroup,
  getCustomerSelfFillData,
  submitCustomerSelfFill,
};
