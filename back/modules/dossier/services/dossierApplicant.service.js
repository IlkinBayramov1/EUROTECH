const prisma = require('../../../config/db');

async function addApplicants(dossierId, applicantsData) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const createdApplicants = await Promise.all(
    applicantsData.map((applicant) => {
      let parsedBirthDate = undefined;
      if (applicant.birthDate) {
        const d = new Date(applicant.birthDate);
        if (!isNaN(d.getTime())) parsedBirthDate = d;
      }
      return prisma.applicant.create({
        data: {
          dossierId,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          passportNumber: applicant.passportNumber,
          birthDate: parsedBirthDate,
          nationality: applicant.nationality || 'AZ',
          gender: applicant.gender,
          familyRole: applicant.familyRole || undefined,
          formDataJson: applicant.formDataJson || {},
        },
      });
    })
  );

  const totalPassengers = dossier.applicants.length + createdApplicants.length;
  const prevCount = Math.max(1, dossier.applicants.length);
  const perPaxRate = prevCount > 0 ? Number(dossier.totalAmount || 0) / prevCount : Number(dossier.totalAmount || 0);
  const updatedTotal = Number((perPaxRate * totalPassengers).toFixed(2));

  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      totalAmount: updatedTotal > 0 ? updatedTotal : dossier.totalAmount,
      currentStep: 3,
    },
  });

  return createdApplicants;
}

async function updateApplicantForm(dossierId, applicantId, formData) {
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, dossierId },
  });

  if (!applicant) {
    throw new Error('Applicant not found in this dossier');
  }

  const existingForm = applicant.formDataJson && typeof applicant.formDataJson === 'object'
    ? applicant.formDataJson
    : {};

  const mergedForm = {
    ...existingForm,
    ...formData,
    lastSavedAt: new Date().toISOString(),
  };

  const updateData = {
    formDataJson: mergedForm,
  };

  if (formData.firstName) updateData.firstName = formData.firstName;
  if (formData.lastName) updateData.lastName = formData.lastName;
  if (formData.passportNumber) updateData.passportNumber = formData.passportNumber;
  if (formData.nationality) updateData.nationality = formData.nationality;
  if (formData.gender) updateData.gender = formData.gender;
  if (formData.birthDate) {
    try {
      const parsedDate = new Date(formData.birthDate);
      if (!isNaN(parsedDate.getTime())) {
        updateData.birthDate = parsedDate;
      }
    } catch (e) {
      // ignore
    }
  }

  const updatedApplicant = await prisma.applicant.update({
    where: { id: applicantId },
    data: updateData,
  });

  // Sync user's fullName if updating the primary applicant
  try {
    const dossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { applicants: { orderBy: { id: 'asc' } } },
    });
    if (dossier && dossier.userId && dossier.applicants?.length > 0 && dossier.applicants[0].id === applicantId) {
      const userUpdateData = {};
      if (formData.firstName || formData.lastName) {
        const newFullName = `${updateData.firstName || applicant.firstName || ''} ${updateData.lastName || applicant.lastName || ''}`.trim();
        if (newFullName) userUpdateData.fullName = newFullName;
      }
      if (formData.homePhone !== undefined) {
        userUpdateData.phone = formData.homePhone || null;
      }
      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: dossier.userId },
          data: userUpdateData,
        });
      }
    }
  } catch (syncErr) {
    console.error('Failed to sync user fullName/phone from primary applicant update:', syncErr);
  }

  return updatedApplicant;
}

async function deleteApplicant(dossierId, applicantId, currentUser) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: { orderBy: { id: 'asc' } } },
  });

  if (!dossier) {
    const error = new Error('Dossier not found');
    error.statusCode = 404;
    throw error;
  }

  const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const isOwner = dossier.userId === currentUser.id;
  if (!isStaff && !isOwner) {
    const error = new Error('Security Alert: Access denied');
    error.statusCode = 403;
    throw error;
  }

  const applicant = dossier.applicants.find((a) => a.id === applicantId);
  if (!applicant) {
    const error = new Error('Applicant not found in this dossier');
    error.statusCode = 404;
    throw error;
  }

  if (dossier.applicants.length > 0 && dossier.applicants[0].id === applicantId) {
    const error = new Error('Primary Applicant cannot be deleted. You may edit their details or only remove co-applicants.');
    error.statusCode = 400;
    throw error;
  }

  await prisma.applicant.delete({
    where: { id: applicantId },
  });

  const prevCount = Math.max(1, dossier.applicants.length);
  const newCount = Math.max(1, prevCount - 1);
  const perPaxRate = Number(dossier.totalAmount || 0) / prevCount;
  const updatedTotal = Number((perPaxRate * newCount).toFixed(2));

  await prisma.dossier.update({
    where: { id: dossierId },
    data: { totalAmount: updatedTotal > 0 ? updatedTotal : dossier.totalAmount },
  });

  return { message: 'Applicant deleted successfully', applicantId, updatedTotalAmount: updatedTotal };
}

module.exports = {
  addApplicants,
  updateApplicantForm,
  deleteApplicant,
};
