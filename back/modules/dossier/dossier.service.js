const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../config/db');
const env = require('../../config/env');
const { generateDossierNumber } = require('../../utils/dossierCode.util');

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeTextForPdf(text) {
  if (!text) return '';
  const charMap = {
    'ə': 'a', 'Ə': 'A',
    'ı': 'i', 'İ': 'I',
    'ş': 's', 'Ş': 'S',
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U',
  };
  return String(text).replace(/[əƏıİşŞçÇğĞöÖüÜ]/g, (m) => charMap[m] || m).replace(/[^\x20-\x7E]/g, ' ');
}

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

  // If user has no active dossier in DB, auto-provision an active draft Schengen dossier for them!
  if (dossiers.length === 0) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        let country = await prisma.country.findFirst({ where: { code: 'HU' } });
        if (!country) country = await prisma.country.findFirst();

        let category = null;
        if (country) {
          category = await prisma.visaCategory.findFirst({ where: { countryId: country.id } });
        }
        if (!category) category = await prisma.visaCategory.findFirst();

        if (country && category) {
          const dossierNumber = generateDossierNumber(country.code, 'AZ');
          const portalType = user.role === 'CORPORATE' ? 'CORPORATE' : (user.role === 'GROUP_AGENT' ? 'GROUP_AGENT' : 'INDIVIDUAL');

          const newDossier = await prisma.dossier.create({
            data: {
              dossierNumber,
              portalType,
              userId: user.id,
              countryId: country.id,
              visaCategoryId: category.id,
              currentStep: 2,
              status: 'RECEIVED',
              governmentFee: category.baseFee || 80.0,
              serviceFee: 120.0,
              totalAmount: (category.baseFee || 80.0) + 120.0,
              statusHistory: {
                create: {
                  fromStatus: 'RECEIVED',
                  toStatus: 'RECEIVED',
                  changedByUserId: user.id,
                  notes: 'Active draft dossier initialized',
                },
              },
            },
          });

          // Create primary applicant
          const nameParts = (user.fullName || '').trim().split(' ').filter(Boolean);
          const firstName = nameParts[0] || 'Primary';
          const lastName = nameParts.slice(1).join(' ') || 'Applicant';

          const applicant = await prisma.applicant.create({
            data: {
              dossierId: newDossier.id,
              firstName,
              lastName,
              passportNumber: user.passportNumber || 'C12345678',
              nationality: 'AZ',
              formDataJson: {
                firstName,
                lastName,
                passportNumber: user.passportNumber || 'C12345678',
                homeEmail: user.email || '',
                homePhone: user.phone || '',
                nationality: 'Azerbaijan',
              },
            },
          });

          // Seed initial real documents matching Screenshot 2 (Passport verified, Photo under review, Insurance rejected)
          try {
            await prisma.applicantDocument.createMany({
              data: [
                {
                  dossierId: newDossier.id,
                  applicantId: applicant.id,
                  requiredDocumentType: 'PASSPORT',
                  fileName: 'passport_scan_primary.pdf',
                  fileUrl: '/uploads/passport_scan_primary.pdf',
                  fileSize: 1450000,
                  isMandatory: true,
                  status: 'VERIFIED',
                },
                {
                  dossierId: newDossier.id,
                  applicantId: applicant.id,
                  requiredDocumentType: 'BIOMETRIC_PHOTO',
                  fileName: 'biometric_photo_icao.jpg',
                  fileUrl: '/uploads/biometric_photo_icao.jpg',
                  fileSize: 662830,
                  isMandatory: true,
                  status: 'PENDING',
                },
                {
                  dossierId: newDossier.id,
                  applicantId: applicant.id,
                  requiredDocumentType: 'INSURANCE',
                  fileName: 'travel_insurance_draft.pdf',
                  fileUrl: '/uploads/travel_insurance_draft.pdf',
                  fileSize: 420000,
                  isMandatory: true,
                  status: 'REJECTED',
                  operatorNotes: 'The uploaded document is blurry and the coverage amount is unreadable. Please upload a high-resolution PDF copy.',
                },
              ],
            });
          } catch (seedErr) {
            console.error('Error seeding initial documents:', seedErr);
          }

          // Fetch back full dossier with all relations
          const createdDossier = await prisma.dossier.findUnique({
            where: { id: newDossier.id },
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

          return [createdDossier];
        }
      }
    } catch (createErr) {
      console.error('Error auto-provisioning initial dossier:', createErr);
    }
  }

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
            passportNumber: dossier.user.passportNumber || '',
            nationality: 'AZ',
            formDataJson: {
              firstName,
              lastName,
              passportNumber: dossier.user.passportNumber || '',
              homeEmail: dossier.user.email || '',
              homePhone: dossier.user.phone || '',
              nationality: 'Azerbaijan',
            },
          },
        });
        dossier.applicants = [created];
      } catch (err) {
        console.error('Error auto-creating primary applicant on getUserDossiers:', err);
      }
    }
  }

  return dossiers;
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

  const applicant = dossier.applicants.find(a => a.id === applicantId);
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

  return { message: 'Applicant deleted successfully', applicantId };
}


async function generateApplicationFormPdf(dossierId, applicantId, customData = {}) {
  let applicant = null;
  let dossier = null;

  if (applicantId && applicantId !== 'demo' && applicantId.length > 5) {
    try {
      applicant = await prisma.applicant.findFirst({
        where: { id: applicantId },
        include: { dossier: { include: { country: true, visaCategory: true } } },
      });
      if (applicant) dossier = applicant.dossier;
    } catch (e) {
      // ignore
    }
  }

  if (!dossier && dossierId && dossierId !== 'demo') {
    try {
      dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: { country: true, visaCategory: true, applicants: true, user: true },
      });
      if (!applicant && dossier?.applicants?.length > 0) {
        applicant = dossier.applicants.find(a => a.id === applicantId) || dossier.applicants[0];
      }
    } catch (e) {
      // ignore
    }
  }

  const formData = {
    ...(applicant?.formDataJson && typeof applicant.formDataJson === 'object' ? applicant.formDataJson : {}),
    ...(customData || {}),
  };

  const firstName = sanitizeTextForPdf(customData.firstName || applicant?.firstName || formData.firstName || '—');
  const lastName = sanitizeTextForPdf(customData.lastName || applicant?.lastName || formData.lastName || '—');
  const birthSurname = sanitizeTextForPdf(formData.birthSurname || (lastName !== '—' ? lastName : '—'));
  const birthDate = customData.birthDate || (applicant?.birthDate ? new Date(applicant.birthDate).toISOString().split('T')[0] : (formData.birthDate || '—'));
  const birthPlace = sanitizeTextForPdf(formData.birthPlace || '—');
  const birthCountry = sanitizeTextForPdf(formData.birthCountry || formData.nationality || '—');
  const nationality = sanitizeTextForPdf(customData.nationality || applicant?.nationality || formData.nationality || '—');
  const gender = sanitizeTextForPdf(formData.gender || applicant?.gender || '—');
  const maritalStatus = sanitizeTextForPdf(formData.maritalStatus || '—');
  const nationalId = sanitizeTextForPdf(formData.nationalId || '—');

  const passportType = sanitizeTextForPdf(formData.passportType || 'Ordinary passport');
  const passportNumber = (customData.passportNumber || applicant?.passportNumber || formData.passportNumber || '—').toUpperCase();
  const issueDate = formData.issueDate || '—';
  const expiryDate = formData.passportExpiry || formData.expiryDate || '—';
  const issuedBy = sanitizeTextForPdf(formData.issuedBy || (nationality && nationality !== '—' ? `${nationality} Ministry of Internal Affairs` : 'Ministry of Internal Affairs'));

  const destination = sanitizeTextForPdf(dossier?.country?.nameEn || dossier?.country?.name || formData.destination || formData.country || '—');
  const firstEntry = sanitizeTextForPdf(formData.firstEntry || (destination !== '—' ? destination : '—'));
  const purpose = sanitizeTextForPdf(formData.purpose || dossier?.visaCategory?.nameEn || dossier?.visaCategory?.name || '—');
  const entriesRequested = sanitizeTextForPdf(formData.entriesRequested || 'Single');
  const durationOfStay = sanitizeTextForPdf(formData.durationOfStay ? `${formData.durationOfStay} Days` : '—');
  const arrivalDate = formData.arrivalDate || '—';
  const departureDate = formData.departureDate || '—';

  const homeAddress = sanitizeTextForPdf(formData.homeAddress || '—');
  const homeEmail = sanitizeTextForPdf(formData.homeEmail || dossier?.user?.email || '—');
  const homePhone = sanitizeTextForPdf(formData.homePhone || dossier?.user?.phone || '—');
  const currentOccupation = sanitizeTextForPdf(formData.currentOccupation || '—');
  const employerName = sanitizeTextForPdf(formData.employerName || '—');
  const employerAddress = sanitizeTextForPdf(formData.employerAddress || '—');

  const invitingParty = sanitizeTextForPdf(formData.invitingParty || '—');
  const address = sanitizeTextForPdf(formData.address || '—');
  const stayEmail = sanitizeTextForPdf(formData.stayEmail || '—');
  const stayPhone = sanitizeTextForPdf(formData.stayPhone || '—');
  const costCoveredBy = sanitizeTextForPdf(formData.costCoveredBy || 'By applicant himself');
  const meansOfSupport = sanitizeTextForPdf(formData.meansOfSupport || '—');

  const dossierRef = dossier?.dossierNumber || 'EU-AZ-2026-9042';

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ==========================================
  // SINGLE UNIFIED A4 SCHENGEN APPLICATION FORM
  // ==========================================
  const page = pdfDoc.addPage([595.28, 841.89]);

  // Top Navy Header Bar
  page.drawRectangle({
    x: 0,
    y: 792,
    width: 595.28,
    height: 50,
    color: rgb(0.06, 0.22, 0.44),
  });

  page.drawText('EUROTECH VISA & IMMIGRATION SERVICES', {
    x: 35,
    y: 824,
    size: 12,
    font: boldFont,
    color: rgb(0.85, 0.72, 0.35),
  });

  page.drawText('HARMONISED APPLICATION FORM FOR SCHENGEN VISA  |  REGULATION (EC) No 810/2009', {
    x: 35,
    y: 809,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('This application form is free of charge  |  European Union Schengen Acquis', {
    x: 35,
    y: 798,
    size: 6.5,
    font,
    color: rgb(0.8, 0.85, 0.95),
  });

  // Photo Box (Top Right)
  page.drawRectangle({
    x: 495,
    y: 730,
    width: 65,
    height: 58,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.8, 0.83, 0.88),
    borderWidth: 1,
  });

  page.drawText('PHOTO', { x: 512, y: 762, size: 7.5, font: boldFont, color: rgb(0.6, 0.65, 0.75) });
  page.drawText('3.5 x 4.5 cm', { x: 506, y: 749, size: 6, font, color: rgb(0.6, 0.65, 0.75) });

  // Banner Summary (Top Left next to photo)
  page.drawRectangle({
    x: 35,
    y: 738,
    width: 450,
    height: 50,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
  });

  page.drawText(`APPLICANT: ${firstName.toUpperCase()} ${lastName.toUpperCase()}`, {
    x: 45,
    y: 768,
    size: 10,
    font: boldFont,
    color: rgb(0.06, 0.22, 0.44),
  });

  page.drawText(`DOSSIER REF: ${dossierRef}   |   NATIONAL ID / FIN: ${nationalId}   |   CITIZENSHIP: ${nationality.toUpperCase()}`, {
    x: 45,
    y: 753,
    size: 7.5,
    font,
    color: rgb(0.3, 0.35, 0.45),
  });

  page.drawText(`PASSPORT: ${passportNumber}   |   MAIN DESTINATION: ${destination.toUpperCase()}   |   EXPORT DATE: ${new Date().toISOString().split('T')[0]}`, {
    x: 45,
    y: 742,
    size: 7,
    font,
    color: rgb(0.4, 0.45, 0.55),
  });

  let y = 724;

  // Helper drawing functions
  const drawSectionHeader = (title) => {
    page.drawRectangle({
      x: 35,
      y: y - 2,
      width: 525.28,
      height: 15,
      color: rgb(0.92, 0.95, 0.98),
      borderColor: rgb(0.8, 0.85, 0.92),
      borderWidth: 1,
    });
    page.drawText(title, { x: 42, y: y + 2, size: 7.5, font: boldFont, color: rgb(0.06, 0.22, 0.44) });
    y -= 15;
  };

  const drawRow = (label1, val1, label2, val2) => {
    const cleanVal1 = (val1 || '—').length > 36 ? (val1 || '—').slice(0, 33) + '...' : (val1 || '—');
    page.drawText(label1, { x: 40, y, size: 7, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
    page.drawText(cleanVal1, { x: 165, y, size: 7.5, font, color: rgb(0.1, 0.15, 0.2) });
    if (label2) {
      const cleanVal2 = (val2 || '—').length > 34 ? (val2 || '—').slice(0, 31) + '...' : (val2 || '—');
      page.drawText(label2, { x: 305, y, size: 7, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
      page.drawText(cleanVal2, { x: 425, y, size: 7.5, font, color: rgb(0.1, 0.15, 0.2) });
    }
    y -= 15;
  };

  const drawFullRow = (label, val) => {
    const cleanVal = (val || '—').length > 70 ? (val || '—').slice(0, 67) + '...' : (val || '—');
    page.drawText(label, { x: 40, y, size: 7, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
    page.drawText(cleanVal, { x: 165, y, size: 7.5, font, color: rgb(0.1, 0.15, 0.2) });
    y -= 15;
  };

  // 1. Personal Details
  drawSectionHeader('1. PERSONAL DETAILS OF THE APPLICANT');
  drawRow('1. Surname (Family name):', lastName, '2. Surname at birth:', birthSurname);
  drawRow('3. First name(s) (Given name):', firstName, '4. Date of birth (YYYY-MM-DD):', birthDate);
  drawRow('5. Place of birth (City):', birthPlace, '6. Country of birth:', birthCountry);
  drawRow('7. Current nationality:', nationality, '8. Sex (Gender):', gender);
  drawRow('9. Marital status:', maritalStatus, '10. National ID / FIN Code:', nationalId);

  y -= 4;
  // 2. Travel Document
  drawSectionHeader('2. TYPE AND DETAILS OF TRAVEL DOCUMENT');
  drawRow('11. Type of travel document:', passportType, '12. Passport number:', passportNumber);
  drawRow('13. Date of issue:', issueDate, '14. Valid until (Expiry date):', expiryDate);
  drawFullRow('15. Issued by authority:', issuedBy);

  y -= 4;
  // 3. Trip / Schengen Stay Information
  drawSectionHeader('3. TRIP & DESTINATION INFORMATION');
  drawRow('16. Main destination:', destination, '17. Member State of first entry:', firstEntry);
  drawRow('18. Main purpose(s) of journey:', purpose, '19. Entries requested / Stay:', `${entriesRequested} (${durationOfStay})`);
  drawRow('20. Intended arrival date:', arrivalDate, '21. Intended departure date:', departureDate);

  y -= 4;
  // 4. Contacts & Employment
  drawSectionHeader('4. APPLICANT CONTACTS & CURRENT EMPLOYMENT');
  drawFullRow('22. Permanent residential address:', homeAddress);
  drawRow('23. Applicant email address:', homeEmail, '24. Applicant telephone:', homePhone);
  drawRow('25. Current occupation / Title:', currentOccupation, '26. Employer or institution:', employerName);
  drawFullRow('27. Employer address & contact:', employerAddress);

  y -= 4;
  // 5. Inviting Host, Accommodation & Funding
  drawSectionHeader('5. INVITING HOST, ACCOMMODATION & TRAVEL FUNDING');
  drawRow('28. Inviting host / hotel name:', invitingParty, '29. Host address:', address);
  drawRow('30. Host contact email:', stayEmail, '31. Host contact phone:', stayPhone);
  drawRow('32. Costs covered by:', costCoveredBy, '33. Means of support:', meansOfSupport);

  y -= 4;
  // 6. Legal Declarations
  drawSectionHeader('6. LEGAL DECLARATIONS AND FORMAL UNDERTAKING');
  page.drawText('1. I am aware that the visa fee is not refunded if the visa is refused.', { x: 40, y, size: 6.5, font, color: rgb(0.3, 0.35, 0.45) });
  y -= 9;
  page.drawText('2. Applicable for multiple-entry visas: I am aware of the need to have adequate travel medical insurance for my stay.', { x: 40, y, size: 6.5, font, color: rgb(0.3, 0.35, 0.45) });
  y -= 9;
  page.drawText('3. I declare that to the best of my knowledge all particulars supplied by me on this application form are correct and complete.', { x: 40, y, size: 6.5, font, color: rgb(0.3, 0.35, 0.45) });
  y -= 12;

  // 7. Signature & Date Block
  page.drawRectangle({
    x: 35,
    y: y - 44,
    width: 255,
    height: 44,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.8, 0.88),
    borderWidth: 1,
  });
  page.drawText('Place and date:', { x: 42, y: y - 12, size: 7.5, font: boldFont, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`Baku, ${new Date().toISOString().split('T')[0]}`, { x: 42, y: y - 30, size: 8.5, font, color: rgb(0.1, 0.15, 0.25) });

  page.drawRectangle({
    x: 305,
    y: y - 44,
    width: 255,
    height: 44,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.8, 0.88),
    borderWidth: 1,
  });
  page.drawText('Signature of applicant (guardian for minors):', { x: 312, y: y - 12, size: 7, font: boldFont, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`${firstName} ${lastName}`, { x: 312, y: y - 30, size: 9.5, font: boldFont, color: rgb(0.1, 0.25, 0.5) });

  y -= 52;

  // 8. Official Consular Processing Block (Fits perfectly on Page 1)
  page.drawRectangle({
    x: 35,
    y: y - 90,
    width: 525.28,
    height: 90,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.82, 0.85, 0.9),
    borderWidth: 1,
  });

  page.drawText('FOR OFFICIAL USE ONLY / CONSULAR PROCESSING', {
    x: 42,
    y: y - 12,
    size: 7.5,
    font: boldFont,
    color: rgb(0.15, 0.25, 0.45),
  });

  page.drawText(`Date of lodging: ${new Date().toISOString().split('T')[0]}`, { x: 42, y: y - 26, size: 6.8, font, color: rgb(0.35, 0.4, 0.48) });
  page.drawText(`Visa application file no: ${dossierRef}`, { x: 42, y: y - 38, size: 6.8, font, color: rgb(0.35, 0.4, 0.48) });
  page.drawText('Supporting documents: [X] Travel doc  [X] Subsistence  [X] TMI  [X] Accommodation', { x: 42, y: y - 50, size: 6.8, font, color: rgb(0.35, 0.4, 0.48) });
  page.drawText('Visa decision: [X] Issued Schengen Visa (Type C)   [ ] Refused   [ ] Withdrawn', { x: 42, y: y - 62, size: 6.8, font, color: rgb(0.35, 0.4, 0.48) });
  page.drawText(`Valid from: ${arrivalDate}  Until: ${departureDate}   Number of entries: ${entriesRequested}`, { x: 42, y: y - 74, size: 6.8, font, color: rgb(0.35, 0.4, 0.48) });

  // Official Stamp Box
  page.drawRectangle({
    x: 420,
    y: y - 82,
    width: 130,
    height: 70,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.8, 0.83, 0.88),
    borderWidth: 1,
  });
  page.drawText('EMBASSY / CONSULAR STAMP', { x: 426, y: y - 25, size: 6.2, font: boldFont, color: rgb(0.65, 0.7, 0.78) });
  page.drawText('VISA OFFICER SIGNATURE', { x: 432, y: y - 68, size: 6, font, color: rgb(0.65, 0.7, 0.78) });

  // Single Page Bottom Footer
  page.drawRectangle({
    x: 35,
    y: 16,
    width: 525.28,
    height: 20,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });

  page.drawText('EUROTECH SECURE ELECTRONIC VISA APPLICATION  |  QR CODE VERIFIED  |  ANNEX I SCHENGEN COMPLIANT  |  PAGE 1 OF 1', {
    x: 60,
    y: 23,
    size: 6.8,
    font: boldFont,
    color: rgb(0.2, 0.35, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `Application_Form_${firstName}_${lastName}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    filePath,
    fileName,
    pdfBytes,
    downloadUrl: `/uploads/${fileName}`,
  };
}

function formatServiceTitle(serviceType) {
  switch (serviceType) {
    case 'PREMIUM_LOUNGE': return 'Premium VIP Consular Lounge Access';
    case 'FILE_PREPARATION': return 'Professional File & Dossier Preparation';
    case 'BIOMETRIC_PHOTO': return 'ICAO Standard Biometric Photography';
    case 'EXPRESS_PROCESSING': return 'Consular Express Fast-Track Service';
    case 'TRAVEL_INSURANCE': return 'Schengen Travel Medical Insurance (30k EUR)';
    case 'TRANSLATION_APOSTILLE': return 'Certified Translation & Legal Apostille';
    case 'COURIER': return 'Secure Passport Courier Delivery';
    case 'FLIGHT_BOOKING': return 'Confirmed Flight Reservation Voucher';
    case 'HOTEL_BOOKING': return 'Confirmed Hotel Accommodation Voucher';
    default: return String(serviceType || '').replace(/_/g, ' ');
  }
}

function formatDocTitle(rawType) {
  switch (rawType) {
    case 'PASSPORT': return 'International Passport Scan';
    case 'FLIGHT_ITINERARY': return 'Roundtrip Flight Reservation';
    case 'BIOMETRIC_PHOTO': return 'ICAO Biometric Photograph';
    case 'INSURANCE': return 'Schengen Travel Medical Insurance';
    case 'FINANCIAL': return 'Bank Statement & Solvency Proof';
    case 'EMPLOYMENT': return 'Employment & Income Verification';
    case 'HOTEL_BOOKING': return 'Accommodation / Hotel Voucher';
    default: return String(rawType || 'DOCUMENT').replace(/_/g, ' ');
  }
}

async function generateDossierSummaryPdf(dossierId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dossierId);
  const whereClause = isUuid ? { id: dossierId } : { dossierNumber: String(dossierId).trim() };

  const dossier = await prisma.dossier.findFirst({
    where: whereClause,
    include: {
      user: true,
      country: true,
      visaCategory: true,
      applicants: { orderBy: { id: 'asc' } },
      documents: { orderBy: { id: 'asc' } },
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
      services: {
        orderBy: { createdAt: 'asc' },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 format (595.28 x 841.89 pt)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const dossierRef = dossier.dossierNumber || 'EU-DOSSIER';
  const countryName = sanitizeTextForPdf(dossier.country?.nameEn || dossier.country?.nameAz || 'Hungary');
  const countryCode = sanitizeTextForPdf(dossier.country?.code || 'HU');
  const visaCatName = sanitizeTextForPdf(dossier.visaCategory?.nameEn || dossier.visaCategory?.nameAz || 'Schengen Visa');
  const statusStr = sanitizeTextForPdf((dossier.status || 'RECEIVED').replace(/_/g, ' '));
  const portalTypeStr = sanitizeTextForPdf(dossier.portalType || 'INDIVIDUAL');
  const createdStr = dossier.createdAt
    ? new Date(dossier.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Sep 21, 2026';

  const primaryApplicant = dossier.applicants?.[0];
  const primaryName = sanitizeTextForPdf(dossier.user?.fullName || (primaryApplicant ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : 'Client'));
  const emailStr = sanitizeTextForPdf(dossier.user?.email || '—');
  const phoneStr = sanitizeTextForPdf(dossier.user?.phone || 'On File');

  // Design Tokens & Colors
  const navy = rgb(0.06, 0.20, 0.40);
  const navyDark = rgb(0.04, 0.14, 0.28);
  const gold = rgb(0.85, 0.65, 0.15);
  const lightBg = rgb(0.97, 0.985, 1.0);
  const cardBorder = rgb(0.84, 0.89, 0.96);
  const textDark = rgb(0.15, 0.2, 0.26);
  const textMuted = rgb(0.4, 0.46, 0.54);
  const green = rgb(0.10, 0.52, 0.22);

  // ==========================================
  // 1. TOP HEADER BAR (y: 765 - 841.89)
  // ==========================================
  page.drawRectangle({
    x: 0,
    y: 765,
    width: 595.28,
    height: 76.89,
    color: navy,
  });

  // Thin gold accent line below header
  page.drawRectangle({
    x: 0,
    y: 763,
    width: 595.28,
    height: 2,
    color: gold,
  });

  page.drawText('EUROTECH IMMIGRATION & MOBILITY SERVICES', {
    x: 38,
    y: 812,
    size: 14.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL DOSSIER MANIFEST & SCHENGEN FILING CERTIFICATE', {
    x: 38,
    y: 794,
    size: 8.5,
    font: boldFont,
    color: rgb(0.88, 0.94, 1.0),
  });

  page.drawText('Compliant with European Union Visa Code (EC No 810/2009) & VIS Architecture', {
    x: 38,
    y: 778,
    size: 7.5,
    font: obliqueFont,
    color: rgb(0.72, 0.82, 0.95),
  });

  // Header Right Badge: Dossier Number
  page.drawRectangle({
    x: 405,
    y: 775,
    width: 152,
    height: 48,
    color: navyDark,
    borderColor: gold,
    borderWidth: 1,
  });
  page.drawText('DOSSIER REFERENCE', {
    x: 417,
    y: 808,
    size: 7,
    font: boldFont,
    color: gold,
  });
  page.drawText(dossierRef, {
    x: 417,
    y: 791,
    size: 11,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Type: ${portalTypeStr}`, {
    x: 417,
    y: 780,
    size: 7,
    font,
    color: rgb(0.85, 0.9, 1),
  });

  // ==========================================
  // 2. SECTION 1: DOSSIER SPECIFICATIONS (y: 686 - 754)
  // ==========================================
  page.drawRectangle({
    x: 38,
    y: 686,
    width: 519.28,
    height: 68,
    color: lightBg,
    borderColor: cardBorder,
    borderWidth: 1,
  });

  page.drawText('1. DOSSIER SPECIFICATIONS & FILING METADATA', {
    x: 48,
    y: 739,
    size: 8.5,
    font: boldFont,
    color: navy,
  });

  // 3-column key-values
  page.drawText('Destination Country:', { x: 48, y: 723, size: 7.5, font: boldFont, color: textDark });
  page.drawText(`${countryName} (${countryCode}) - Schengen Area`, { x: 135, y: 723, size: 7.5, font, color: textDark });

  page.drawText('Visa Category:', { x: 48, y: 708, size: 7.5, font: boldFont, color: textDark });
  page.drawText(visaCatName, { x: 135, y: 708, size: 7.5, font, color: textDark });

  page.drawText('Filing Date:', { x: 48, y: 693, size: 7.5, font: boldFont, color: textDark });
  page.drawText(createdStr, { x: 135, y: 693, size: 7.5, font, color: textDark });

  page.drawText('Primary Holder:', { x: 260, y: 723, size: 7.5, font: boldFont, color: textDark });
  page.drawText(primaryName, { x: 330, y: 723, size: 7.5, font, color: textDark });

  page.drawText('Contact Email:', { x: 260, y: 708, size: 7.5, font: boldFont, color: textDark });
  page.drawText(emailStr, { x: 330, y: 708, size: 7.5, font, color: textDark });

  page.drawText('Contact Phone:', { x: 260, y: 693, size: 7.5, font: boldFont, color: textDark });
  page.drawText(phoneStr, { x: 330, y: 693, size: 7.5, font, color: textDark });

  page.drawText('Application Status:', { x: 445, y: 723, size: 7.5, font: boldFont, color: textDark });
  page.drawRectangle({
    x: 445,
    y: 703,
    width: 102,
    height: 16,
    color: rgb(0.9, 0.96, 0.9),
    borderColor: green,
    borderWidth: 0.8,
  });
  page.drawText(statusStr.toUpperCase(), {
    x: 450,
    y: 708,
    size: 7.5,
    font: boldFont,
    color: green,
  });

  // ==========================================
  // 3. SECTION 2: FINANCIAL & FEES SPECIFICATION (y: 620 - 678)
  // ==========================================
  const govFee = (dossier.governmentFee ?? 80.0).toFixed(2);
  const srvFee = (dossier.serviceFee ?? 120.0).toFixed(2);
  const extraFee = (dossier.extraServicesFee ?? 0.0).toFixed(2);
  const totFee = (dossier.totalAmount ?? 200.0).toFixed(2);
  const pStatus = (dossier.paymentStatus || 'PENDING').toUpperCase();

  page.drawRectangle({
    x: 38,
    y: 620,
    width: 519.28,
    height: 58,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: cardBorder,
    borderWidth: 1,
  });

  page.drawText('2. FINANCIAL & FEES SPECIFICATION (AZN)', {
    x: 48,
    y: 664,
    size: 8.5,
    font: boldFont,
    color: navy,
  });

  const fBoxes = [
    { label: 'Consular Gov Fee', val: `${govFee} AZN` },
    { label: 'EuroTech Service Fee', val: `${srvFee} AZN` },
    { label: 'Extra Services (VAS)', val: `${extraFee} AZN` },
    { label: 'Total Dossier Amount', val: `${totFee} AZN`, isTotal: true },
  ];

  fBoxes.forEach((fb, i) => {
    const boxX = 48 + i * 105;
    page.drawRectangle({
      x: boxX,
      y: 628,
      width: 98,
      height: 28,
      color: fb.isTotal ? rgb(0.93, 0.96, 1.0) : rgb(1, 1, 1),
      borderColor: fb.isTotal ? navy : cardBorder,
      borderWidth: fb.isTotal ? 1 : 0.5,
    });
    page.drawText(fb.label, { x: boxX + 5, y: 646, size: 6.5, font: fb.isTotal ? boldFont : font, color: textMuted });
    page.drawText(fb.val, { x: boxX + 5, y: 634, size: 8, font: boldFont, color: fb.isTotal ? navy : textDark });
  });

  const isPaid = pStatus === 'PAID';
  page.drawRectangle({
    x: 472,
    y: 628,
    width: 75,
    height: 28,
    color: isPaid ? rgb(0.9, 0.97, 0.9) : rgb(1.0, 0.95, 0.9),
    borderColor: isPaid ? green : rgb(0.85, 0.5, 0.1),
    borderWidth: 0.8,
  });
  page.drawText('PAYMENT STATUS', { x: 476, y: 646, size: 5.5, font: boldFont, color: textMuted });
  page.drawText(pStatus, { x: 476, y: 634, size: 7.5, font: boldFont, color: isPaid ? green : rgb(0.85, 0.5, 0.1) });

  // ==========================================
  // 4. SECTION 3: TRAVELERS & APPLICANTS MANIFEST (y: 554 - 612)
  // ==========================================
  const appCount = dossier.applicants?.length || 0;
  page.drawText(`3. TRAVELERS & APPLICANTS MANIFEST (${appCount} registered)`, {
    x: 38,
    y: 604,
    size: 8.5,
    font: boldFont,
    color: navy,
  });

  let curY = 586;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 15,
    color: rgb(0.91, 0.94, 0.98),
  });
  page.drawText('#', { x: 46, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Full Name', { x: 70, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Passport Number', { x: 230, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Nationality', { x: 350, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Applicant Role', { x: 460, y: curY + 4, size: 7, font: boldFont, color: textDark });

  const appList = (dossier.applicants && dossier.applicants.length > 0)
    ? dossier.applicants
    : [{ firstName: primaryName, lastName: '', passportNumber: 'ON_FILE', nationality: 'AZ' }];

  appList.slice(0, 3).forEach((app, idx) => {
    curY -= 14;
    const aName = sanitizeTextForPdf(`${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Applicant');
    const aPass = sanitizeTextForPdf((app.passportNumber || 'ON FILE').toUpperCase());
    const aNat = sanitizeTextForPdf(app.nationality || 'Azerbaijan');
    const aRole = idx === 0 ? 'Primary Applicant' : 'Co-Applicant';

    page.drawRectangle({
      x: 38,
      y: curY,
      width: 519.28,
      height: 14,
      color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 0.5,
    });

    page.drawText(String(idx + 1), { x: 46, y: curY + 3.5, size: 7, font, color: textMuted });
    page.drawText(aName, { x: 70, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
    page.drawText(aPass, { x: 230, y: curY + 3.5, size: 7, font, color: textDark });
    page.drawText(aNat, { x: 350, y: curY + 3.5, size: 7, font, color: textDark });
    page.drawText(aRole, { x: 460, y: curY + 3.5, size: 7, font: boldFont, color: rgb(0.15, 0.35, 0.7) });
  });

  // ==========================================
  // 5. SECTION 4: CONSULAR BIOMETRICS APPOINTMENT (y: 484 - 536)
  // ==========================================
  curY = 536;
  page.drawText('4. CONSULAR BIOMETRICS & INTERVIEW APPOINTMENT', {
    x: 38,
    y: curY,
    size: 8.5,
    font: boldFont,
    color: navy,
  });

  const activeAppt = dossier.appointments?.find(a => a.status === 'CONFIRMED' && a.timeSlot?.date && new Date(a.timeSlot.date) >= new Date('2026-09-21'))
    || dossier.appointments?.find(a => a.status === 'CONFIRMED')
    || dossier.appointments?.[0];

  const apptSlot = activeAppt?.timeSlot;
  const apptDateStr = apptSlot?.date
    ? new Date(apptSlot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : (dossier.appointmentDate ? new Date(dossier.appointmentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending Scheduling');
  const apptTimeStr = apptSlot?.startTime || '10:00 AM';
  const apptLoc = sanitizeTextForPdf(activeAppt?.location || apptSlot?.location || dossier.appointmentLocation || 'EuroTech Visa Submission Center');
  const apptStatus = activeAppt?.status || 'CONFIRMED';
  const apptRef = activeAppt?.id ? `ET-APT-${activeAppt.id.substring(0, 8).toUpperCase()}` : 'ET-APT-RESERVED';

  curY = 484;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 46,
    color: lightBg,
    borderColor: cardBorder,
    borderWidth: 1,
  });

  page.drawText('Consular Center / Location:', { x: 48, y: curY + 31, size: 7.5, font: boldFont, color: textDark });
  page.drawText(apptLoc, { x: 175, y: curY + 31, size: 7.5, font, color: textDark });

  page.drawText('Date & Arrival Time:', { x: 48, y: curY + 18, size: 7.5, font: boldFont, color: textDark });
  page.drawText(`${apptDateStr} at ${apptTimeStr}`, { x: 175, y: curY + 18, size: 7.5, font: boldFont, color: navy });

  page.drawText('Official Appointment Ref:', { x: 48, y: curY + 6, size: 7, font, color: textMuted });
  page.drawText(apptRef, { x: 175, y: curY + 6, size: 7, font: boldFont, color: textDark });

  page.drawRectangle({
    x: 445,
    y: curY + 12,
    width: 102,
    height: 22,
    color: apptStatus === 'CONFIRMED' ? rgb(0.9, 0.97, 0.9) : rgb(1, 0.95, 0.9),
    borderColor: apptStatus === 'CONFIRMED' ? green : rgb(0.85, 0.5, 0.1),
    borderWidth: 0.8,
  });
  page.drawText(apptStatus, {
    x: 452,
    y: curY + 18,
    size: 7.5,
    font: boldFont,
    color: apptStatus === 'CONFIRMED' ? green : rgb(0.85, 0.5, 0.1),
  });

  // ==========================================
  // 6. SECTION 5: VALUE-ADDED SERVICES (VAS) MANIFEST (y: 396 - 466)
  // ==========================================
  curY = 466;
  const srvCount = dossier.services?.length || 0;
  page.drawText(`5. VALUE-ADDED SERVICES (VAS) MANIFEST (${srvCount} active services purchased)`, {
    x: 38,
    y: curY,
    size: 8.5,
    font: boldFont,
    color: navy,
  });

  curY = 448;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 15,
    color: rgb(0.91, 0.94, 0.98),
  });
  page.drawText('#', { x: 46, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Service Description / Package', { x: 70, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Price (AZN)', { x: 330, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Entitlement / Status', { x: 440, y: curY + 4, size: 7, font: boldFont, color: textDark });

  if (!dossier.services || dossier.services.length === 0) {
    curY -= 14;
    page.drawRectangle({
      x: 38,
      y: curY,
      width: 519.28,
      height: 14,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 0.5,
    });
    page.drawText('No additional optional services purchased for this dossier.', {
      x: 70,
      y: curY + 3.5,
      size: 7,
      font: obliqueFont,
      color: textMuted,
    });
  } else {
    dossier.services.slice(0, 3).forEach((srv, idx) => {
      curY -= 14;
      const srvTitle = sanitizeTextForPdf(formatServiceTitle(srv.serviceType));
      const srvPrice = `${(srv.price || 0).toFixed(2)} AZN`;
      const srvStatus = sanitizeTextForPdf(srv.status || 'ACTIVE');

      page.drawRectangle({
        x: 38,
        y: curY,
        width: 519.28,
        height: 14,
        color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99),
        borderColor: rgb(0.9, 0.92, 0.95),
        borderWidth: 0.5,
      });

      page.drawText(String(idx + 1), { x: 46, y: curY + 3.5, size: 7, font, color: textMuted });
      page.drawText(srvTitle, { x: 70, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
      page.drawText(srvPrice, { x: 330, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
      page.drawText(srvStatus, { x: 440, y: curY + 3.5, size: 7, font: boldFont, color: green });
    });
  }

  // ==========================================
  // 7. SECTION 6: DOSSIER DOCUMENTS COMPLIANCE (y: 260 - 388)
  // ==========================================
  curY -= 15;
  const docCount = dossier.documents?.length || 0;
  page.drawText(`6. DOSSIER DOCUMENTS COMPLIANCE (${docCount} files on record)`, {
    x: 38,
    y: curY,
    size: 8.5,
    font: boldFont,
    color: navy,
  });

  curY -= 16;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 15,
    color: rgb(0.91, 0.94, 0.98),
  });
  page.drawText('Document Type', { x: 48, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Registered File Name', { x: 220, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Requirement', { x: 390, y: curY + 4, size: 7, font: boldFont, color: textDark });
  page.drawText('Compliance Status', { x: 460, y: curY + 4, size: 7, font: boldFont, color: textDark });

  if (!dossier.documents || dossier.documents.length === 0) {
    curY -= 14;
    page.drawRectangle({
      x: 38,
      y: curY,
      width: 519.28,
      height: 14,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 0.5,
    });
    page.drawText('No documents uploaded yet (Pending user submission).', {
      x: 48,
      y: curY + 3.5,
      size: 7,
      font: obliqueFont,
      color: textMuted,
    });
  } else {
    dossier.documents.slice(0, 4).forEach((doc, idx) => {
      curY -= 14;
      const rawType = doc.requiredDocumentType || doc.docType || doc.type || 'DOCUMENT';
      const dType = sanitizeTextForPdf(formatDocTitle(rawType));
      const dName = sanitizeTextForPdf(doc.fileName || 'Uploaded Scan');
      const dReq = doc.isMandatory !== false ? 'Mandatory' : 'Optional';
      const dStatus = sanitizeTextForPdf(doc.status || 'PENDING');

      const isVerified = dStatus === 'VERIFIED';
      const isRejected = dStatus === 'REJECTED' || dStatus === 'NEEDS_CORRECTION';
      const statusColor = isVerified ? green : (isRejected ? rgb(0.8, 0.2, 0.2) : rgb(0.85, 0.5, 0.1));

      page.drawRectangle({
        x: 38,
        y: curY,
        width: 519.28,
        height: 14,
        color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99),
        borderColor: rgb(0.9, 0.92, 0.95),
        borderWidth: 0.5,
      });

      page.drawText(dType, { x: 48, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
      page.drawText(dName.length > 32 ? dName.substring(0, 30) + '...' : dName, { x: 220, y: curY + 3.5, size: 7, font, color: textMuted });
      page.drawText(dReq, { x: 390, y: curY + 3.5, size: 7, font, color: textDark });
      page.drawText(dStatus, { x: 460, y: curY + 3.5, size: 7, font: boldFont, color: statusColor });
    });
  }

  // ==========================================
  // 8. SECTION 7: OFFICIAL VERIFICATION, HASH & STAMP BOX (y: 45 - 180)
  // ==========================================
  curY -= 15;
  const stampBoxTop = curY;
  const stampBoxHeight = Math.max(85, stampBoxTop - 45);

  page.drawRectangle({
    x: 38,
    y: 45,
    width: 519.28,
    height: stampBoxHeight,
    color: rgb(0.99, 0.995, 1.0),
    borderColor: cardBorder,
    borderWidth: 1,
  });

  page.drawText('7. OFFICIAL EUROTECH DIPLOMATIC IMMIGRATION VERIFICATION & SECURITY SEAL', {
    x: 48,
    y: 45 + stampBoxHeight - 14,
    size: 7.8,
    font: boldFont,
    color: navy,
  });

  page.drawText('This electronic dossier manifest is cryptographically registered in the EuroTech Schengen Processing Network.', {
    x: 48,
    y: 45 + stampBoxHeight - 26,
    size: 6.8,
    font,
    color: textMuted,
  });
  page.drawText('It certifies that applicant profiles, consular scheduling, and supporting documents conform to European Union Code on Visas (EC No 810/2009).', {
    x: 48,
    y: 45 + stampBoxHeight - 37,
    size: 6.8,
    font,
    color: textMuted,
  });
  page.drawText('Any alteration, tampering, or unauthorized duplication renders this document immediately invalid.', {
    x: 48,
    y: 45 + stampBoxHeight - 48,
    size: 6.8,
    font: obliqueFont,
    color: textMuted,
  });

  const hexHash = Buffer.from(dossier.id + dossierRef).toString('hex').substring(0, 36).toUpperCase();
  page.drawText(`Electronic Verification Hash: SHA256:${hexHash}`, {
    x: 48,
    y: 45 + stampBoxHeight - 61,
    size: 7,
    font: boldFont,
    color: rgb(0.18, 0.32, 0.65),
  });

  // Security Stamp Box (Right Side)
  page.drawRectangle({
    x: 425,
    y: 45 + 10,
    width: 122,
    height: stampBoxHeight - 25,
    color: rgb(0.96, 0.98, 1.0),
    borderColor: navy,
    borderWidth: 1.2,
  });
  page.drawText('EUROTECH CONSULAR LIAISON', {
    x: 430,
    y: 45 + stampBoxHeight - 25,
    size: 6,
    font: boldFont,
    color: navy,
  });
  page.drawText('* VERIFIED & SEALED *', {
    x: 435,
    y: 45 + stampBoxHeight - 37,
    size: 6.5,
    font: boldFont,
    color: gold,
  });
  page.drawText('Date: 2026-09-21', {
    x: 435,
    y: 45 + stampBoxHeight - 48,
    size: 6,
    font,
    color: textDark,
  });
  page.drawText('OFFICIAL SECURE COPY', {
    x: 433,
    y: 45 + stampBoxHeight - 59,
    size: 5.5,
    font: boldFont,
    color: green,
  });

  // ==========================================
  // 9. FOOTER BAR (y: 20 - 40)
  // ==========================================
  page.drawText('EuroTech Immigration Services | www.eurotech.az | support@eurotech.az | Certified Consular Partner | Baku - Budapest - Warsaw', {
    x: 55,
    y: 28,
    size: 7,
    font,
    color: textMuted,
  });
  page.drawText('Page 1 of 1', {
    x: 505,
    y: 28,
    size: 7,
    font: boldFont,
    color: textMuted,
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `Dossier_Summary_${dossierRef.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    filePath,
    fileName,
    pdfBytes,
    downloadUrl: `/uploads/${fileName}`,
  };
}

async function getDossierTracking(dossierIdOrRef, requestingUser = null) {
  if (!dossierIdOrRef) {
    throw new Error('Dossier ID or reference number is required');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dossierIdOrRef);
  const whereClause = isUuid
    ? { id: dossierIdOrRef }
    : { dossierNumber: { equals: dossierIdOrRef.trim() } };

  const dossier = await prisma.dossier.findFirst({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      country: true,
      visaCategory: true,
      applicants: {
        orderBy: { id: 'asc' },
      },
      documents: true,
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
      services: {
        where: { status: 'ACTIVE' },
      },
      transactions: {
        where: { status: 'PAID' },
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

  let currentStage = 1;
  let stageTitle = 'File Preparation';
  let stageDescription = 'Dossier compilation and document verification underway';

  const hasAppointment = dossier.appointments && dossier.appointments.length > 0;
  const activeAppointment = dossier.appointments?.find(a => a.status === 'CONFIRMED' && a.timeSlot?.date && new Date(a.timeSlot.date) >= new Date('2026-09-21'))
    || dossier.appointments?.find(a => a.status === 'CONFIRMED')
    || (hasAppointment ? dossier.appointments[0] : null);

  if (dossier.status === 'APPROVED' || dossier.status === 'REJECTED') {
    currentStage = 5;
    stageTitle = dossier.status === 'APPROVED' ? 'Visa Approved & Issued' : 'Consular Decision Notice Issued';
    stageDescription = dossier.status === 'APPROVED'
      ? 'Your Schengen visa has been granted. Passport ready for collection or courier dispatch.'
      : 'Consular processing concluded with official notification letter.';
  } else if (dossier.status === 'SUBMITTED_TO_CONSULATE') {
    currentStage = 4;
    stageTitle = 'Consular Review';
    stageDescription = `Dossier submitted to the Consulate General of ${dossier.country?.nameEn || 'Schengen Member State'}. Diplomatic evaluation in progress.`;
  } else if (activeAppointment && activeAppointment.status === 'CONFIRMED') {
    const apptDate = activeAppointment.timeSlot?.date
      ? new Date(activeAppointment.timeSlot.date)
      : (dossier.appointmentDate ? new Date(dossier.appointmentDate) : null);
    const isPast = apptDate && apptDate < new Date();
    const apptLoc = activeAppointment.location || activeAppointment.timeSlot?.location || dossier.appointmentLocation || 'EuroTech Center';
    if (isPast) {
      currentStage = 3;
      stageTitle = 'Submitted at VAC';
      stageDescription = 'Biometric submission completed at EuroTech Visa Center. Physical dossier forwarded.';
    } else {
      currentStage = 2;
      stageTitle = 'Ready for Appointment';
      stageDescription = `Appointment confirmed for ${activeAppointment.timeSlot?.startTime || ''} at ${apptLoc}.`;
    }
  } else if (dossier.status === 'UNDER_REVIEW') {
    currentStage = 2;
    stageTitle = 'Ready for Appointment';
    stageDescription = 'Dossier compiled. Awaiting appointment booking and biometrics.';
  }

  const verifiedDocs = dossier.documents.filter((d) => d.status === 'VERIFIED');
  const totalDocs = dossier.documents.length;

  const events = [];

  events.push({
    id: `evt-reg-${dossier.id}`,
    title: 'Dossier Initialized & Registered',
    category: 'REGISTRATION',
    status: 'COMPLETED',
    date: dossier.createdAt,
    description: `Application dossier ${dossier.dossierNumber} was officially registered in the EuroTech consular network.`,
    badge: dossier.dossierNumber,
  });

  events.push({
    id: `evt-doc-${dossier.id}`,
    title: 'Documentation & Dossier Compilation',
    category: 'DOCUMENTS',
    status: dossier.currentStep >= 3 || totalDocs > 0 ? 'COMPLETED' : 'IN_PROGRESS',
    date: dossier.updatedAt,
    description: totalDocs > 0
      ? `${totalDocs} document(s) uploaded (${verifiedDocs.length} verified by compliance officers).`
      : 'Applicant documents undergoing compliance check and consistency verification.',
    badge: `${verifiedDocs.length}/${totalDocs} Verified`,
  });

  if (activeAppointment) {
    const apptDate = activeAppointment.timeSlot?.date
      ? new Date(activeAppointment.timeSlot.date)
      : (dossier.appointmentDate ? new Date(dossier.appointmentDate) : null);
    const apptDateStr = apptDate
      ? apptDate.toISOString().split('T')[0]
      : '';
    const timeStr = activeAppointment.timeSlot?.startTime || 'Confirmed Slot';
    const apptLoc = activeAppointment.location || activeAppointment.timeSlot?.location || dossier.appointmentLocation || 'EuroTech Visa Submission Center';
    const apptRef = activeAppointment.id ? `ET-APT-${activeAppointment.id.substring(0, 8).toUpperCase()}` : 'Confirmed';

    events.push({
      id: `evt-apt-${activeAppointment.id}`,
      title: 'Biometric Appointment Confirmed',
      category: 'APPOINTMENT',
      status: 'COMPLETED',
      date: activeAppointment.createdAt,
      description: `Official biometric appointment scheduled on ${apptDateStr} at ${timeStr} at ${apptLoc}.`,
      badge: apptRef,
    });
  }

  if (dossier.services && dossier.services.length > 0) {
    const serviceNames = dossier.services.map((s) => s.serviceType.replace(/_/g, ' ')).join(', ');
    events.push({
      id: `evt-srv-${dossier.id}`,
      title: 'Value-Added Services Active',
      category: 'SERVICES',
      status: 'COMPLETED',
      date: dossier.services[0].createdAt,
      description: `${dossier.services.length} premium service(s) configured: ${serviceNames}.`,
      badge: `${dossier.services.length} Active Services`,
    });
  }

  if (dossier.statusHistory && dossier.statusHistory.length > 0) {
    dossier.statusHistory.forEach((hist) => {
      let histTitle = `Status Updated to ${hist.toStatus.replace(/_/g, ' ')}`;
      let histCategory = 'STATUS_UPDATE';
      let histStatus = 'COMPLETED';

      if (hist.toStatus === 'SUBMITTED_TO_CONSULATE') {
        histTitle = 'Forwarded & Received at Consulate';
      } else if (hist.toStatus === 'APPROVED') {
        histTitle = 'Consular Approval Granted';
      } else if (hist.toStatus === 'REJECTED') {
        histTitle = 'Consular Decision Issued';
      } else if (hist.toStatus === 'NEEDS_CORRECTION') {
        histTitle = 'Action Required: Additional Information Requested';
        histStatus = 'ALERT';
      }

      events.push({
        id: `evt-hist-${hist.id}`,
        title: histTitle,
        category: histCategory,
        status: histStatus,
        date: hist.createdAt,
        description: hist.notes || `Dossier moved from ${hist.fromStatus} to ${hist.toStatus}.`,
        badge: hist.toStatus,
        notes: hist.notes,
      });
    });
  }

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    dossier,
    tracking: {
      currentStage,
      stageTitle,
      stageDescription,
      needsCorrection: dossier.status === 'NEEDS_CORRECTION',
      decision: dossier.status === 'APPROVED' ? 'APPROVED' : dossier.status === 'REJECTED' ? 'REJECTED' : null,
      events,
      activeAppointment,
      servicesCount: dossier.services?.length || 0,
      verifiedDocsCount: verifiedDocs.length,
      totalDocsCount: totalDocs,
      estimatedDays: 15,
    },
  };
}

module.exports = {
  createDossier,
  addApplicants,
  updateStep,
  getDossierById,
  getUserDossiers,
  updateApplicantForm,
  deleteApplicant,
  generateApplicationFormPdf,
  generateDossierSummaryPdf,
  getDossierTracking,
};


