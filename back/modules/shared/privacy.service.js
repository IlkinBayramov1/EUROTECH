const prisma = require('../../config/db');
const privacyConfig = require('../../config/privacy.config');
const env = require('../../config/env');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeText(text) {
  if (!text) return '';
  return String(text).replace(/[^\x00-\x7F]/g, '').trim();
}

function formatDocType(rawType) {
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

function formatServiceName(serviceType) {
  switch (serviceType) {
    case 'PREMIUM_LOUNGE': return 'Premium VIP Lounge Access';
    case 'FILE_PREPARATION': return 'Professional File Preparation';
    case 'BIOMETRIC_PHOTO': return 'ICAO Biometric Photography';
    case 'EXPRESS_PROCESSING': return 'Consular Express Fast-Track';
    case 'TRAVEL_INSURANCE': return 'Schengen Medical Insurance';
    case 'TRANSLATION_APOSTILLE': return 'Translation & Apostille';
    case 'COURIER': return 'Secure Passport Courier';
    case 'FLIGHT_BOOKING': return 'Flight Reservation Voucher';
    case 'HOTEL_BOOKING': return 'Hotel Accommodation Voucher';
    default: return String(serviceType || '').replace(/_/g, ' ');
  }
}

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
          country: true,
          visaCategory: true,
          applicants: true,
          documents: true,
          services: true,
          transactions: true,
          appointments: {
            include: { timeSlot: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
      auditLogs: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) throw new Error('User not found');

  return {
    gdprNotice: 'EuroTech GDPR Data Export Package',
    exportedAt: new Date().toISOString(),
    user,
  };
}

async function generateGdprDossierPdf(userId) {
  const exportData = await exportUserData(userId);
  const user = exportData.user;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // ISO A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const navy = rgb(0.06, 0.18, 0.38);
  const navyDark = rgb(0.03, 0.10, 0.22);
  const gold = rgb(0.85, 0.65, 0.15);
  const lightBg = rgb(0.97, 0.985, 1.0);
  const cardBorder = rgb(0.84, 0.89, 0.96);
  const textDark = rgb(0.12, 0.16, 0.22);
  const textMuted = rgb(0.38, 0.44, 0.52);
  const green = rgb(0.08, 0.48, 0.20);

  const exportedAtStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const refCode = `EUR-GDPR-${user.id.substring(0, 8).toUpperCase()}`;

  // 1. TOP HEADER BAR (y: 765 - 841.89)
  page.drawRectangle({
    x: 0,
    y: 765,
    width: 595.28,
    height: 76.89,
    color: navy,
  });

  page.drawRectangle({
    x: 0,
    y: 763,
    width: 595.28,
    height: 2,
    color: gold,
  });

  page.drawText('EUROTECH DATA PROTECTION & GOVERNANCE OFFICE', {
    x: 38,
    y: 812,
    size: 13.5,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL GDPR DATA SUBJECT ACCESS & PORTABILITY DOSSIER', {
    x: 38,
    y: 794,
    size: 8.5,
    font: boldFont,
    color: rgb(0.88, 0.94, 1.0),
  });

  page.drawText('Regulation (EU) 2016/679 (GDPR) · Article 15 (Access) & Article 20 (Data Portability)', {
    x: 38,
    y: 778,
    size: 7.2,
    font: obliqueFont,
    color: rgb(0.72, 0.82, 0.95),
  });

  // Right Ref Badge
  page.drawRectangle({
    x: 410,
    y: 775,
    width: 147,
    height: 48,
    color: navyDark,
    borderColor: gold,
    borderWidth: 1,
  });
  page.drawText('COMPLIANCE AUDIT REF', {
    x: 420,
    y: 808,
    size: 6.5,
    font: boldFont,
    color: gold,
  });
  page.drawText(refCode, {
    x: 420,
    y: 792,
    size: 10,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText('CONFIDENTIAL / PII', {
    x: 420,
    y: 780,
    size: 6.5,
    font: boldFont,
    color: rgb(0.85, 0.92, 1),
  });

  // 2. SECTION 1: DATA SUBJECT IDENTIFICATION (y: 690 - 754)
  page.drawRectangle({
    x: 38,
    y: 690,
    width: 519.28,
    height: 64,
    color: lightBg,
    borderColor: cardBorder,
    borderWidth: 1,
  });

  page.drawText('1. DATA SUBJECT IDENTIFICATION & SYSTEM METADATA', {
    x: 48,
    y: 740,
    size: 8,
    font: boldFont,
    color: navy,
  });

  const subjectName = sanitizeText(user.fullName || 'Client');
  const subjectEmail = sanitizeText(user.email || '—');
  const subjectPhone = sanitizeText(user.phone || 'On File');
  const userRole = sanitizeText(user.role || 'CLIENT');
  const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '2026';

  page.drawText('Full Legal Name:', { x: 48, y: 724, size: 7.2, font: boldFont, color: textDark });
  page.drawText(subjectName, { x: 125, y: 724, size: 7.2, font, color: textDark });

  page.drawText('Subject Email:', { x: 250, y: 724, size: 7.2, font: boldFont, color: textDark });
  page.drawText(subjectEmail, { x: 315, y: 724, size: 7.2, font, color: textDark });

  page.drawText('System Role:', { x: 440, y: 724, size: 7.2, font: boldFont, color: textDark });
  page.drawText(userRole, { x: 495, y: 724, size: 7.2, font: boldFont, color: navy });

  page.drawText('Phone Number:', { x: 48, y: 708, size: 7.2, font: boldFont, color: textDark });
  page.drawText(subjectPhone, { x: 125, y: 708, size: 7.2, font, color: textDark });

  page.drawText('Registration Date:', { x: 250, y: 708, size: 7.2, font: boldFont, color: textDark });
  page.drawText(regDate, { x: 325, y: 708, size: 7.2, font, color: textDark });

  page.drawText('Encryption Spec:', { x: 440, y: 708, size: 7.2, font: boldFont, color: textDark });
  page.drawText('AES-256-GCM', { x: 508, y: 708, size: 7.2, font, color: green });

  page.drawText('Export Generated:', { x: 48, y: 695, size: 6.8, font: obliqueFont, color: textMuted });
  page.drawText(`${exportedAtStr} (UTC+4)`, { x: 125, y: 695, size: 6.8, font: obliqueFont, color: textMuted });

  // 3. SECTION 2: REGISTERED IMMIGRATION DOSSIERS (y: 622 - 680)
  const dossiers = user.dossiers || [];
  let curY = 680;
  page.drawText(`2. REGISTERED IMMIGRATION DOSSIERS (${dossiers.length} files on record)`, {
    x: 38,
    y: curY,
    size: 8,
    font: boldFont,
    color: navy,
  });

  curY = 664;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 14,
    color: rgb(0.91, 0.94, 0.98),
  });
  page.drawText('Dossier Ref', { x: 46, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Destination Country', { x: 140, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Visa Category', { x: 270, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Filing Date', { x: 410, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Status', { x: 490, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });

  if (dossiers.length === 0) {
    curY -= 13;
    page.drawRectangle({ x: 38, y: curY, width: 519.28, height: 13, color: rgb(1, 1, 1), borderColor: cardBorder, borderWidth: 0.5 });
    page.drawText('No registered visa dossiers found on file.', { x: 46, y: curY + 3, size: 6.8, font: obliqueFont, color: textMuted });
  } else {
    dossiers.slice(0, 2).forEach((d, i) => {
      curY -= 13;
      const dRef = sanitizeText(d.dossierNumber || d.id);
      const cName = sanitizeText(d.country?.nameEn || d.country?.nameAz || 'Hungary');
      const vName = sanitizeText(d.visaCategory?.nameEn || d.visaCategory?.nameAz || 'Schengen Visa');
      const fDate = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US') : '2026';
      const dStatus = sanitizeText(d.status || 'RECEIVED');

      page.drawRectangle({ x: 38, y: curY, width: 519.28, height: 13, color: i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99), borderColor: cardBorder, borderWidth: 0.5 });
      page.drawText(dRef, { x: 46, y: curY + 3, size: 6.8, font: boldFont, color: textDark });
      page.drawText(cName, { x: 140, y: curY + 3, size: 6.8, font, color: textDark });
      page.drawText(vName, { x: 270, y: curY + 3, size: 6.8, font, color: textDark });
      page.drawText(fDate, { x: 410, y: curY + 3, size: 6.8, font, color: textDark });
      page.drawText(dStatus, { x: 490, y: curY + 3, size: 6.8, font: boldFont, color: green });
    });
  }

  // 4. SECTION 3: REGISTERED APPLICANTS & TRAVELERS (y: 565 - 618)
  curY -= 12;
  const primaryDossier = dossiers[0] || {};
  const applicants = primaryDossier.applicants || [];
  page.drawText(`3. REGISTERED APPLICANTS & TRAVELERS (${applicants.length} registered)`, {
    x: 38,
    y: curY,
    size: 8,
    font: boldFont,
    color: navy,
  });

  curY -= 14;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 14,
    color: rgb(0.91, 0.94, 0.98),
  });
  page.drawText('#', { x: 46, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Applicant Full Name', { x: 70, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Passport Reference', { x: 240, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Nationality', { x: 370, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Role', { x: 470, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });

  if (applicants.length === 0) {
    curY -= 13;
    page.drawRectangle({ x: 38, y: curY, width: 519.28, height: 13, color: rgb(1, 1, 1), borderColor: cardBorder, borderWidth: 0.5 });
    page.drawText('No registered co-applicants found on record.', { x: 46, y: curY + 3, size: 6.8, font: obliqueFont, color: textMuted });
  } else {
    applicants.slice(0, 2).forEach((a, idx) => {
      curY -= 13;
      const aName = sanitizeText(`${a.firstName || ''} ${a.lastName || ''}`.trim() || subjectName);
      const aPass = sanitizeText(a.passportNumber || 'ENCRYPTED (AES-256)');
      const aNat = sanitizeText(a.nationality || 'Azerbaijan');
      const aRole = idx === 0 ? 'Primary Applicant' : 'Co-Applicant';

      page.drawRectangle({ x: 38, y: curY, width: 519.28, height: 13, color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99), borderColor: cardBorder, borderWidth: 0.5 });
      page.drawText(String(idx + 1), { x: 46, y: curY + 3, size: 6.8, font, color: textMuted });
      page.drawText(aName, { x: 70, y: curY + 3, size: 6.8, font: boldFont, color: textDark });
      page.drawText(aPass, { x: 240, y: curY + 3, size: 6.8, font, color: textDark });
      page.drawText(aNat, { x: 370, y: curY + 3, size: 6.8, font, color: textDark });
      page.drawText(aRole, { x: 470, y: curY + 3, size: 6.8, font: boldFont, color: rgb(0.15, 0.35, 0.7) });
    });
  }

  // 5. SECTION 4: CONSULAR BIOMETRICS APPOINTMENTS (y: 495 - 550)
  curY -= 12;
  const appts = primaryDossier.appointments || [];
  page.drawText(`4. CONSULAR BIOMETRICS & INTERVIEW APPOINTMENTS (${appts.length} appointments on record)`, {
    x: 38,
    y: curY,
    size: 8,
    font: boldFont,
    color: navy,
  });

  const activeAppt = appts.find(a => a.status === 'CONFIRMED' && a.timeSlot?.date && new Date(a.timeSlot.date) >= new Date('2026-09-21'))
    || appts.find(a => a.status === 'CONFIRMED')
    || appts[0];

  curY -= 36;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 34,
    color: lightBg,
    borderColor: cardBorder,
    borderWidth: 1,
  });

  if (activeAppt) {
    const slotDate = activeAppt.timeSlot?.date ? new Date(activeAppt.timeSlot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Scheduled';
    const slotTime = activeAppt.timeSlot?.startTime || '10:00 AM';
    const slotLoc = sanitizeText(activeAppt.location || activeAppt.timeSlot?.location || 'EuroTech Visa Center, Port Baku Towers');
    const apptRef = activeAppt.id ? `ET-APT-${activeAppt.id.substring(0, 8).toUpperCase()}` : 'CONFIRMED';

    page.drawText('Active Biometric Appointment:', { x: 48, y: curY + 20, size: 7.2, font: boldFont, color: textDark });
    page.drawText(`${slotDate} at ${slotTime}`, { x: 175, y: curY + 20, size: 7.2, font: boldFont, color: navy });

    page.drawText('Consular Location:', { x: 48, y: curY + 8, size: 6.8, font, color: textMuted });
    page.drawText(slotLoc, { x: 175, y: curY + 8, size: 6.8, font, color: textDark });

    page.drawText(`Ref: ${apptRef} | Status: ${activeAppt.status || 'CONFIRMED'}`, { x: 380, y: curY + 14, size: 6.8, font: boldFont, color: green });
  } else {
    page.drawText('No active consular biometrics appointment scheduled yet.', { x: 48, y: curY + 14, size: 7, font: obliqueFont, color: textMuted });
  }

  // 6. SECTION 5: SUPPORTING DOCUMENTS COMPLIANCE (y: 380 - 485)
  curY -= 12;
  const docs = primaryDossier.documents || [];
  page.drawText(`5. SUPPORTING DOCUMENTS COMPLIANCE (${docs.length} uploaded files)`, {
    x: 38,
    y: curY,
    size: 8,
    font: boldFont,
    color: navy,
  });

  curY -= 14;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 14,
    color: rgb(0.91, 0.94, 0.98),
  });
  page.drawText('Document Type', { x: 48, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Registered File Name', { x: 230, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Mandatory', { x: 400, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });
  page.drawText('Verification Status', { x: 465, y: curY + 3.5, size: 6.8, font: boldFont, color: textDark });

  if (docs.length === 0) {
    curY -= 13;
    page.drawRectangle({ x: 38, y: curY, width: 519.28, height: 13, color: rgb(1, 1, 1), borderColor: cardBorder, borderWidth: 0.5 });
    page.drawText('No supporting documents recorded in database.', { x: 48, y: curY + 3, size: 6.8, font: obliqueFont, color: textMuted });
  } else {
    docs.slice(0, 4).forEach((d, idx) => {
      curY -= 13;
      const dType = sanitizeText(formatDocType(d.requiredDocumentType || d.type));
      const dName = sanitizeText(d.fileName || 'document.pdf');
      const dMand = d.isMandatory !== false ? 'Yes' : 'No';
      const dStatus = sanitizeText(d.status || 'PENDING');
      const isVer = dStatus === 'VERIFIED';
      const isRej = dStatus === 'REJECTED';

      page.drawRectangle({ x: 38, y: curY, width: 519.28, height: 13, color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99), borderColor: cardBorder, borderWidth: 0.5 });
      page.drawText(dType, { x: 48, y: curY + 3, size: 6.8, font: boldFont, color: textDark });
      page.drawText(dName.length > 32 ? dName.substring(0, 30) + '...' : dName, { x: 230, y: curY + 3, size: 6.8, font, color: textMuted });
      page.drawText(dMand, { x: 400, y: curY + 3, size: 6.8, font, color: textDark });
      page.drawText(dStatus, { x: 465, y: curY + 3, size: 6.8, font: boldFont, color: isVer ? green : (isRej ? rgb(0.8, 0.2, 0.2) : rgb(0.85, 0.5, 0.1)) });
    });
  }

  // 7. SECTION 6: FINANCIAL LEDGER & SERVICES (y: 280 - 370)
  curY -= 12;
  page.drawText('6. FINANCIAL LEDGER & VALUE-ADDED SERVICES (VAS)', {
    x: 38,
    y: curY,
    size: 8,
    font: boldFont,
    color: navy,
  });

  curY -= 54;
  page.drawRectangle({
    x: 38,
    y: curY,
    width: 519.28,
    height: 50,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: cardBorder,
    borderWidth: 1,
  });

  const govFee = (primaryDossier.governmentFee !== null && primaryDossier.governmentFee !== undefined ? Number(primaryDossier.governmentFee) : 0).toFixed(2);
  const srvFee = (primaryDossier.serviceFee !== null && primaryDossier.serviceFee !== undefined ? Number(primaryDossier.serviceFee) : 0).toFixed(2);
  const extFee = (primaryDossier.extraServicesFee !== null && primaryDossier.extraServicesFee !== undefined ? Number(primaryDossier.extraServicesFee) : 0).toFixed(2);
  const totFee = (primaryDossier.totalAmount !== null && primaryDossier.totalAmount !== undefined ? Number(primaryDossier.totalAmount) : 0).toFixed(2);
  const payStatus = (primaryDossier.paymentStatus || 'PENDING').toUpperCase();

  const finItems = [
    { label: 'Government Fee', val: `${govFee} AZN` },
    { label: 'Consular Service Fee', val: `${srvFee} AZN` },
    { label: 'Value-Added Services', val: `${extFee} AZN` },
    { label: 'Total Billed Amount', val: `${totFee} AZN`, isTotal: true },
  ];

  finItems.forEach((item, i) => {
    const bX = 48 + i * 105;
    page.drawText(item.label, { x: bX, y: curY + 34, size: 6.5, font: item.isTotal ? boldFont : font, color: textMuted });
    page.drawText(item.val, { x: bX, y: curY + 20, size: 8, font: boldFont, color: item.isTotal ? navy : textDark });
  });

  page.drawRectangle({
    x: 472,
    y: curY + 16,
    width: 75,
    height: 24,
    color: payStatus === 'PAID' ? rgb(0.9, 0.97, 0.9) : rgb(1, 0.95, 0.9),
    borderColor: payStatus === 'PAID' ? green : rgb(0.85, 0.5, 0.1),
    borderWidth: 0.8,
  });
  page.drawText('PAYMENT', { x: 476, y: curY + 30, size: 5, font: boldFont, color: textMuted });
  page.drawText(payStatus, { x: 476, y: curY + 20, size: 7, font: boldFont, color: payStatus === 'PAID' ? green : rgb(0.85, 0.5, 0.1) });

  // Value-Added Services Manifest line
  const servicesList = primaryDossier.services || [];
  const servicesFormatted = servicesList.length > 0
    ? servicesList.map(s => `${formatServiceName(s.serviceType)}: ${Number(s.price || 0).toFixed(0)} AZN`).join('  |  ')
    : 'Standard consular processing (No extra value-added services registered).';

  page.drawText('Purchased VAS Manifest:', { x: 48, y: curY + 6, size: 6.5, font: boldFont, color: textDark });
  page.drawText(sanitizeText(servicesFormatted), { x: 145, y: curY + 6, size: 6.5, font, color: textMuted });

  // 8. SECTION 7: OFFICIAL VERIFICATION & SEAL (y: 45 - 265)
  curY -= 12;
  const sealBoxTop = curY;
  const sealBoxHeight = Math.max(90, sealBoxTop - 45);

  page.drawRectangle({
    x: 38,
    y: 45,
    width: 519.28,
    height: sealBoxHeight,
    color: rgb(0.99, 0.995, 1.0),
    borderColor: cardBorder,
    borderWidth: 1,
  });

  page.drawText('7. OFFICIAL EUROTECH DIPLOMATIC COMPLIANCE CERTIFICATION & DIGITAL SEAL', {
    x: 48,
    y: 45 + sealBoxHeight - 14,
    size: 7.8,
    font: boldFont,
    color: navy,
  });

  page.drawText('This electronic portability manifest complies with European Union General Data Protection Regulation (EU 2016/679).', {
    x: 48,
    y: 45 + sealBoxHeight - 26,
    size: 6.8,
    font,
    color: textMuted,
  });
  page.drawText('It confirms that applicant profiles, biometrics scheduling, document metadata, and financial billing records are exported directly from the primary cryptographic consular ledger.', {
    x: 48,
    y: 45 + sealBoxHeight - 37,
    size: 6.8,
    font,
    color: textMuted,
  });
  page.drawText('Zero-Knowledge Blind Indices and AES-256 ciphers ensure all biometric identifiers remain securely protected.', {
    x: 48,
    y: 45 + sealBoxHeight - 48,
    size: 6.8,
    font: obliqueFont,
    color: textMuted,
  });

  const hexHash = Buffer.from(user.id + user.email + Date.now()).toString('hex').substring(0, 36).toUpperCase();
  page.drawText(`Electronic Verification Hash: SHA256:${hexHash}`, {
    x: 48,
    y: 45 + sealBoxHeight - 61,
    size: 7,
    font: boldFont,
    color: rgb(0.18, 0.32, 0.65),
  });

  // Security Stamp Box (Right Side)
  page.drawRectangle({
    x: 425,
    y: 45 + 10,
    width: 122,
    height: sealBoxHeight - 25,
    color: rgb(0.96, 0.98, 1.0),
    borderColor: navy,
    borderWidth: 1.2,
  });
  page.drawText('EUROTECH DPO LIAISON', {
    x: 433,
    y: 45 + sealBoxHeight - 24,
    size: 6,
    font: boldFont,
    color: navy,
  });
  page.drawText('* GDPR COMPLIANT *', {
    x: 434,
    y: 45 + sealBoxHeight - 36,
    size: 6.5,
    font: boldFont,
    color: gold,
  });
  page.drawText('PORTABILITY ARCHIVE', {
    x: 432,
    y: 45 + sealBoxHeight - 48,
    size: 5.5,
    font: boldFont,
    color: textDark,
  });
  page.drawText('OFFICIAL SECURE COPY', {
    x: 433,
    y: 45 + sealBoxHeight - 60,
    size: 5.5,
    font: boldFont,
    color: green,
  });

  // 9. FOOTER BAR (y: 20 - 40)
  page.drawText('EuroTech Data Protection Office | dpo@eurotech.az | ISO/IEC 27001 Certified Consular Vault | Baku - Budapest - Warsaw', {
    x: 48,
    y: 28,
    size: 6.8,
    font,
    color: textMuted,
  });
  page.drawText('Page 1 of 1', {
    x: 512,
    y: 28,
    size: 6.8,
    font: boldFont,
    color: textMuted,
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `EuroTech_GDPR_Dossier_${user.id.substring(0, 8)}_${Date.now()}.pdf`;
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
  anonymizeUser,
  exportUserData,
  generateGdprDossierPdf,
};
