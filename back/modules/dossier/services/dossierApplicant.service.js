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
  let applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, dossierId },
  });

  if (!applicant) {
    if (['primary', 'app-1', 'primary-applicant', 'undefined', 'null'].includes(String(applicantId))) {
      applicant = await prisma.applicant.findFirst({
        where: { dossierId, familyRole: 'PRIMARY' },
        orderBy: { id: 'asc' },
      });
    }
  }

  if (!applicant) {
    applicant = await prisma.applicant.findFirst({
      where: { dossierId },
      orderBy: { id: 'asc' },
    });
  }

  if (!applicant) {
    throw new Error('Applicant not found in this dossier');
  }

  const existingForm = applicant.formDataJson && typeof applicant.formDataJson === 'object'
    ? applicant.formDataJson
    : {};

  // Extract all incoming or alias fields
  const rawFirstName = formData.firstName || formData.firstNames || formData.givenName;
  const rawLastName = formData.lastName || formData.surname || formData.familyName;
  const rawBirthSurname = formData.birthSurname || formData.surnameAtBirth;
  const rawPassport = formData.passportNumber || formData.travelDocumentNumber;
  const rawNationality = formData.nationality || formData.currentNationality;
  const rawGender = formData.gender || formData.sex;
  const rawDob = formData.birthDate || formData.dateOfBirth || formData.dob;
  const rawBirthPlace = formData.birthPlace || formData.placeOfBirth;
  const rawBirthCountry = formData.birthCountry || formData.countryOfBirth;
  const rawMaritalStatus = formData.maritalStatus || formData.civilStatus;
  const rawPassportType = formData.passportType || formData.travelDocumentType;
  const rawPassportExpiry = formData.passportExpiry || formData.expirationDate;
  const rawPurpose = formData.purpose || formData.mainPurpose;
  const rawDestination = formData.destination || formData.destinationMemberState;
  const rawFirstEntry = formData.firstEntry || formData.firstEntryMemberState;
  const rawEntries = formData.entriesRequested || formData.numberOfEntries;
  const rawArrival = formData.arrivalDate || formData.intendedArrivalDate;
  const rawDeparture = formData.departureDate || formData.intendedDepartureDate;
  const rawDuration = formData.durationOfStay || formData.intendedDurationOfStay;
  const rawInvitingParty = formData.invitingParty || formData.hotelName || formData.invitingOrgName;
  const rawAddress = formData.address || formData.hotelAddress || formData.invitingAddress;
  const rawPhone = formData.homePhone !== undefined ? formData.homePhone : (formData.applicantPhone !== undefined ? formData.applicantPhone : formData.phone);
  const rawEmail = formData.homeEmail !== undefined ? formData.homeEmail : (formData.applicantEmail !== undefined ? formData.applicantEmail : formData.email);
  const rawHomeAddress = formData.homeAddress !== undefined ? formData.homeAddress : formData.applicantAddress;

  const mergedForm = {
    ...existingForm,
    ...formData,
    lastSavedAt: new Date().toISOString(),
  };

  // Cross-mirror all aliases in mergedForm so both conventions are always 100% in sync
  if (rawFirstName) {
    mergedForm.firstName = rawFirstName;
    mergedForm.firstNames = rawFirstName;
  }
  if (rawLastName) {
    mergedForm.lastName = rawLastName;
    mergedForm.surname = rawLastName;
  }
  if (rawBirthSurname !== undefined) {
    mergedForm.birthSurname = rawBirthSurname;
    mergedForm.surnameAtBirth = rawBirthSurname;
  }
  if (rawPassport) {
    mergedForm.passportNumber = rawPassport;
    mergedForm.travelDocumentNumber = rawPassport;
  }
  if (rawNationality) {
    mergedForm.nationality = rawNationality;
    mergedForm.currentNationality = rawNationality;
  }
  if (rawGender) {
    mergedForm.gender = rawGender;
    mergedForm.sex = rawGender;
  }
  if (rawDob) {
    const dobString = String(rawDob).split('T')[0];
    mergedForm.birthDate = dobString;
    mergedForm.dateOfBirth = dobString;
    mergedForm.dob = dobString;
  }
  if (rawBirthPlace !== undefined) {
    mergedForm.birthPlace = rawBirthPlace;
    mergedForm.placeOfBirth = rawBirthPlace;
  }
  if (rawBirthCountry !== undefined) {
    mergedForm.birthCountry = rawBirthCountry;
    mergedForm.countryOfBirth = rawBirthCountry;
  }
  if (rawMaritalStatus !== undefined) {
    mergedForm.maritalStatus = rawMaritalStatus;
    mergedForm.civilStatus = rawMaritalStatus;
  }
  if (rawPassportType !== undefined) {
    mergedForm.passportType = rawPassportType;
    mergedForm.travelDocumentType = rawPassportType;
  }
  if (rawPassportExpiry !== undefined) {
    mergedForm.passportExpiry = rawPassportExpiry;
    mergedForm.expirationDate = rawPassportExpiry;
  }
  if (rawPurpose !== undefined) {
    mergedForm.purpose = rawPurpose;
    mergedForm.mainPurpose = rawPurpose;
  }
  if (rawDestination !== undefined) {
    mergedForm.destination = rawDestination;
    mergedForm.destinationMemberState = rawDestination;
  }
  if (rawFirstEntry !== undefined) {
    mergedForm.firstEntry = rawFirstEntry;
    mergedForm.firstEntryMemberState = rawFirstEntry;
  }
  if (rawEntries !== undefined) {
    mergedForm.entriesRequested = rawEntries;
    mergedForm.numberOfEntries = rawEntries;
  }
  if (rawArrival !== undefined) {
    mergedForm.arrivalDate = rawArrival;
    mergedForm.intendedArrivalDate = rawArrival;
  }
  if (rawDeparture !== undefined) {
    mergedForm.departureDate = rawDeparture;
    mergedForm.intendedDepartureDate = rawDeparture;
  }
  if (rawDuration !== undefined) {
    mergedForm.durationOfStay = rawDuration;
    mergedForm.intendedDurationOfStay = rawDuration;
  }
  if (rawInvitingParty !== undefined) {
    mergedForm.invitingParty = rawInvitingParty;
    mergedForm.hotelName = rawInvitingParty;
  }
  if (rawAddress !== undefined) {
    mergedForm.address = rawAddress;
    mergedForm.hotelAddress = rawAddress;
  }
  if (rawPhone !== undefined) {
    mergedForm.homePhone = rawPhone;
    mergedForm.applicantPhone = rawPhone;
    mergedForm.phone = rawPhone;
  }
  if (rawEmail !== undefined) {
    mergedForm.homeEmail = rawEmail;
    mergedForm.applicantEmail = rawEmail;
    mergedForm.email = rawEmail;
  }
  if (rawHomeAddress !== undefined) {
    mergedForm.homeAddress = rawHomeAddress;
    mergedForm.applicantAddress = rawHomeAddress;
  }

  const updateData = {
    formDataJson: mergedForm,
  };

  if (rawFirstName) updateData.firstName = rawFirstName;
  if (rawLastName) updateData.lastName = rawLastName;
  if (rawPassport) updateData.passportNumber = rawPassport;
  if (rawNationality) updateData.nationality = rawNationality;
  if (rawGender) updateData.gender = rawGender;
  if (rawDob) {
    try {
      const parsedDate = new Date(rawDob);
      if (!isNaN(parsedDate.getTime())) {
        updateData.birthDate = parsedDate;
      }
    } catch (e) {
      // ignore
    }
  }

  const updatedApplicant = await prisma.applicant.update({
    where: { id: applicant.id },
    data: updateData,
  });

  // Sync user's fullName if updating the primary applicant
  try {
    const dossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { applicants: { orderBy: { id: 'asc' } } },
    });
    if (dossier && dossier.userId && dossier.applicants?.length > 0 && dossier.applicants[0].id === applicant.id) {
      const userUpdateData = {};
      if (rawFirstName || rawLastName) {
        const newFullName = `${updateData.firstName || applicant.firstName || ''} ${updateData.lastName || applicant.lastName || ''}`.trim();
        if (newFullName) userUpdateData.fullName = newFullName;
      }
      if (rawPhone !== undefined) {
        userUpdateData.phone = rawPhone || null;
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

async function getApplicantDetails(dossierId, applicantId, currentUser) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      country: true,
      visaCategory: {
        include: {
          requiredDocTypes: true,
          dynamicFields: true,
        },
      },
      groupBatch: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          companyName: true,
          phone: true,
          role: true,
        },
      },
      applicants: {
        include: {
          documents: {
            orderBy: { createdAt: 'desc' },
          },
          services: true,
        },
      },
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!dossier) {
    const error = new Error('Dossier not found');
    error.statusCode = 404;
    throw error;
  }

  if (currentUser) {
    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
    const isOwner = dossier.userId === currentUser.id;
    const isGroupOwner = dossier.groupBatch && dossier.groupBatch.userId === currentUser.id;
    if (!isStaff && !isOwner && !isGroupOwner) {
      const error = new Error('Security Alert: Access denied to this applicant application');
      error.statusCode = 403;
      throw error;
    }
  }

  if (dossier.applicants && dossier.applicants.length > 0) {
    dossier.applicants.sort((a, b) => (a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0));
  }

  let targetApplicant = null;
  if (!applicantId || ['primary', 'app-1', 'primary-applicant', 'undefined', 'null'].includes(String(applicantId))) {
    targetApplicant = dossier.applicants[0] || null;
  } else {
    targetApplicant = dossier.applicants.find(a => a.id === applicantId) || null;
  }

  if (!targetApplicant) {
    if (dossier.applicants.length === 0 && dossier.user) {
      const nameParts = (dossier.user.fullName || '').trim().split(' ').filter(Boolean);
      const firstName = nameParts[0] || 'Applicant';
      const lastName = nameParts.slice(1).join(' ') || '';
      targetApplicant = await prisma.applicant.create({
        data: {
          dossierId: dossier.id,
          firstName,
          lastName,
          passportNumber: 'A00000000',
          familyRole: 'PRIMARY',
          formDataJson: {
            firstName,
            lastName,
            homeEmail: dossier.user.email || '',
            homePhone: dossier.user.phone || '',
            destination: dossier.country?.nameEn || 'Schengen Member State',
            purpose: 'Tourism',
          },
        },
        include: { documents: true, services: true },
      });
      dossier.applicants = [targetApplicant];
    } else {
      const error = new Error('Applicant not found in this dossier');
      error.statusCode = 404;
      throw error;
    }
  }

  return {
    applicant: targetApplicant,
    dossier: {
      id: dossier.id,
      dossierNumber: dossier.dossierNumber,
      portalType: dossier.portalType,
      status: dossier.status,
      currentStep: dossier.currentStep,
      country: dossier.country,
      visaCategory: dossier.visaCategory,
      groupBatch: dossier.groupBatch,
      user: dossier.user,
      appointment: dossier.appointments?.[0] || null,
    },
    allApplicants: dossier.applicants.map(a => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      passportNumber: a.passportNumber,
      familyRole: a.familyRole,
      birthDate: a.birthDate,
      gender: a.gender,
      documentsCount: a.documents?.length || 0,
      verifiedDocsCount: a.documents?.filter(d => d.status === 'VERIFIED').length || 0,
      formDataJson: a.formDataJson || {},
    })),
  };
}

module.exports = {
  addApplicants,
  updateApplicantForm,
  deleteApplicant,
  getApplicantDetails,
};
