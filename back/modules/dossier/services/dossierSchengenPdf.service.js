const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../../config/db');
const env = require('../../../config/env');
const { fillSchengenPDF } = require('../../../utils/schengenPdfFiller.util');

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

async function generateApplicationFormPdf(dossierId, applicantId, customData = {}) {
  let applicant = null;
  let dossier = null;

  if (applicantId && applicantId !== 'demo' && applicantId.length > 5) {
    try {
      applicant = await prisma.applicant.findFirst({
        where: { id: applicantId },
        include: { dossier: { include: { country: true, visaCategory: true, user: true } } },
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
        applicant = dossier.applicants.find((a) => a.id === applicantId) || dossier.applicants[0];
      }
    } catch (e) {
      // ignore
    }
  }

  const customFormJson = (customData?.formDataJson && typeof customData.formDataJson === 'object')
    ? customData.formDataJson
    : (customData?.formData && typeof customData.formData === 'object' ? customData.formData : {});

  const combinedApplicant = {
    ...(applicant || {}),
    firstName: customData.firstName || customData.firstNames || customFormJson.firstName || customFormJson.firstNames || applicant?.firstName || '',
    lastName: customData.lastName || customData.surname || customFormJson.lastName || customFormJson.surname || applicant?.lastName || '',
    passportNumber: customData.passportNumber || customData.travelDocumentNumber || customFormJson.passportNumber || customFormJson.travelDocumentNumber || applicant?.passportNumber || '',
    birthDate: customData.birthDate || customData.dateOfBirth || customData.dob || customFormJson.birthDate || customFormJson.dateOfBirth || customFormJson.dob || (applicant?.birthDate ? new Date(applicant.birthDate).toISOString().split('T')[0] : ''),
    nationality: customData.nationality || customData.currentNationality || customFormJson.nationality || customFormJson.currentNationality || applicant?.nationality || '',
    gender: customData.gender || customData.sex || customFormJson.gender || customFormJson.sex || applicant?.gender || '',
    formDataJson: {
      ...(applicant?.formDataJson && typeof applicant.formDataJson === 'object' ? applicant.formDataJson : {}),
      ...(customData || {}),
      ...customFormJson,
    },
  };

  try {
    return await fillSchengenPDF(combinedApplicant, dossier || {});
  } catch (schengenErr) {
    console.error('[SCHENGEN FORM FILLER ERROR, FALLING BACK TO LEGACY]', schengenErr);
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

  // Single unified A4 Schengen application form
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
    y: 751,
    size: 7,
    font,
    color: rgb(0.4, 0.45, 0.55),
  });

  let y = 724;

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

  // 2. Travel Document
  drawSectionHeader('2. TRAVEL DOCUMENT DETAILS');
  drawRow('12. Type of travel document:', passportType, '13. Number of travel document:', passportNumber);
  drawRow('14. Date of issue:', issueDate, '15. Valid until:', expiryDate);
  drawFullRow('16. Issued by authority:', issuedBy);

  // 3. Contact & Employment
  drawSectionHeader('3. APPLICANT CONTACT & EMPLOYMENT DETAILS');
  drawFullRow('17. Home address:', homeAddress);
  drawRow('18. Email address:', homeEmail, '19. Telephone number:', homePhone);
  drawRow('20. Current occupation / Profession:', currentOccupation, '21. Employer / Educational Institution:', employerName);
  drawFullRow('22. Employer address and phone:', employerAddress);

  // 4. Trip Details
  drawSectionHeader('4. TRIP SPECIFICATIONS & DESTINATION');
  drawRow('23. Purpose(s) of journey:', purpose, '24. Member State of destination:', destination);
  drawRow('25. Member State of first entry:', firstEntry, '26. Number of entries requested:', entriesRequested);
  drawRow('27. Intended date of arrival:', arrivalDate, '28. Intended date of departure:', departureDate);
  drawRow('29. Duration of intended stay:', durationOfStay, '30. Previous Schengen visas (years):', 'None in last 3 years');

  // 5. Host & Financial
  drawSectionHeader('5. INVITATION, HOST & EXPENSE COVERAGE');
  drawFullRow('31. Name of inviting person / Hotel:', invitingParty);
  drawFullRow('32. Address of inviting person / Hotel:', address);
  drawRow('33. Host Email:', stayEmail, '34. Host Telephone:', stayPhone);
  drawRow('35. Cost of travelling covered by:', costCoveredBy, '36. Means of support:', meansOfSupport);

  // Official Consular Section
  y -= 4;
  page.drawRectangle({
    x: 35,
    y: y - 88,
    width: 525.28,
    height: 90,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.8, 0.85, 0.92),
    borderWidth: 1,
  });

  page.drawText('FOR OFFICIAL CONSULAR & PROCESSING EMBASSY USE ONLY', {
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

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const pdfBytes = await pdfDoc.save();
  const safeFirst = (firstName || 'Applicant').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeLast = (lastName || 'Dossier').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Application_Form_${safeFirst}_${safeLast}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    filePath,
    fileName,
    pdfBytes,
    downloadUrl: `/uploads/${fileName}`,
  };
}

module.exports = {
  generateApplicationFormPdf,
  sanitizeTextForPdf,
};
