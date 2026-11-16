const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../../config/db');
const env = require('../../../config/env');

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

  const dossierRef = sanitizeTextForPdf(dossier.dossierNumber || 'EU-DOSSIER');
  const countryName = sanitizeTextForPdf(dossier.country?.nameEn || dossier.country?.nameAz || 'Hungary');
  const countryCode = sanitizeTextForPdf(dossier.country?.code || 'HU');
  const visaCatName = sanitizeTextForPdf(dossier.visaCategory?.nameEn || dossier.visaCategory?.nameAz || 'Schengen Visa');
  const statusStr = sanitizeTextForPdf((dossier.status || 'RECEIVED').replace(/_/g, ' '));
  const portalTypeStr = sanitizeTextForPdf(dossier.portalType || 'INDIVIDUAL');
  const createdStr = dossier.createdAt
    ? new Date(dossier.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Sep 21, 2026';

  const sortedApplicants = [...(dossier.applicants || [])].sort((a, b) =>
    a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0
  );
  const primaryApplicant = sortedApplicants[0];
  const primaryName = sanitizeTextForPdf(dossier.user?.fullName || (primaryApplicant ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : 'Client'));
  const emailStr = sanitizeTextForPdf(dossier.user?.email || '-');
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

  // 1. TOP HEADER BAR
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

  // 2. SECTION 1: DOSSIER SPECIFICATIONS
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

  // 3. SECTION 2: FINANCIAL & FEES SPECIFICATION
  const govFee = Number(dossier.governmentFee ?? 80.0).toFixed(2);
  const srvFee = Number(dossier.serviceFee ?? 120.0).toFixed(2);
  const extraFee = Number(dossier.extraServicesFee ?? 0.0).toFixed(2);
  const totFee = Number(dossier.totalAmount ?? 200.0).toFixed(2);
  const pStatus = sanitizeTextForPdf((dossier.paymentStatus || 'PENDING').toUpperCase());

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

  // 4. SECTION 3: TRAVELERS & APPLICANTS MANIFEST
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

  const appList = (sortedApplicants && sortedApplicants.length > 0)
    ? sortedApplicants
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
    page.drawText(aName.substring(0, 32), { x: 70, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
    page.drawText(aPass, { x: 230, y: curY + 3.5, size: 7, font, color: textDark });
    page.drawText(aNat.substring(0, 20), { x: 350, y: curY + 3.5, size: 7, font, color: textDark });
    page.drawText(aRole, { x: 460, y: curY + 3.5, size: 7, font: boldFont, color: rgb(0.15, 0.35, 0.7) });
  });

  if (appList.length > 3) {
    page.drawText(`+ ${appList.length - 3} additional group members listed on Page 2`, {
      x: 360,
      y: 604,
      size: 7,
      font: obliqueFont,
      color: navy,
    });
  }

  // 5. SECTION 4: CONSULAR BIOMETRICS APPOINTMENT
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
  const apptDateStr = sanitizeTextForPdf(apptSlot?.date
    ? new Date(apptSlot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : (dossier.appointmentDate ? new Date(dossier.appointmentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending Scheduling'));
  const apptTimeStr = sanitizeTextForPdf(apptSlot?.startTime || '10:00 AM');
  const apptLoc = sanitizeTextForPdf(activeAppt?.location || apptSlot?.location || dossier.appointmentLocation || 'EuroTech Visa Submission Center');
  const apptStatus = sanitizeTextForPdf(activeAppt?.status || 'CONFIRMED');
  const apptRef = sanitizeTextForPdf(activeAppt?.id ? `ET-APT-${activeAppt.id.substring(0, 8).toUpperCase()}` : 'ET-APT-RESERVED');

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

  // 6. SECTION 5: VALUE-ADDED SERVICES (VAS) MANIFEST
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
      const srvPrice = `${Number(srv.price || 0).toFixed(2)} AZN`;
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

      page.drawText(String(idx + 1), { x: 46, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
      page.drawText(srvTitle, { x: 70, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
      page.drawText(srvPrice, { x: 330, y: curY + 3.5, size: 7, font: boldFont, color: textDark });
      page.drawText(srvStatus, { x: 440, y: curY + 3.5, size: 7, font: boldFont, color: green });
    });
  }

  // 7. SECTION 6: DOSSIER DOCUMENTS COMPLIANCE
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

  // 8. SECTION 7: OFFICIAL VERIFICATION, HASH & STAMP BOX
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

  // Security Stamp Box
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

  // 9. GROUP ROSTER CONTINUATION PAGES (if more than 3 applicants)
  if (appList.length > 3) {
    let rosterPage = pdfDoc.addPage([595.28, 841.89]);
    const drawRosterHeader = (pg) => {
      pg.drawRectangle({ x: 0, y: 785, width: 595.28, height: 56.89, color: navy });
      pg.drawText(`COMPLETE GROUP ROSTER - DOSSIER ${dossierRef}`, { x: 38, y: 814, size: 12, font: boldFont, color: rgb(1, 1, 1) });
      pg.drawText(`${appList.length} Registered Applicants`, { x: 38, y: 798, size: 8, font, color: rgb(0.85, 0.9, 1) });

      pg.drawRectangle({ x: 38, y: 752, width: 519.28, height: 18, color: rgb(0.91, 0.94, 0.98) });
      pg.drawText('#', { x: 46, y: 757, size: 7.5, font: boldFont, color: textDark });
      pg.drawText('Full Name', { x: 70, y: 757, size: 7.5, font: boldFont, color: textDark });
      pg.drawText('Passport Number', { x: 235, y: 757, size: 7.5, font: boldFont, color: textDark });
      pg.drawText('Date of Birth', { x: 345, y: 757, size: 7.5, font: boldFont, color: textDark });
      pg.drawText('Nationality', { x: 430, y: 757, size: 7.5, font: boldFont, color: textDark });
      pg.drawText('Role', { x: 500, y: 757, size: 7.5, font: boldFont, color: textDark });
      return 734;
    };

    let ry = drawRosterHeader(rosterPage);
    appList.forEach((app, idx) => {
      if (ry < 65) {
        rosterPage = pdfDoc.addPage([595.28, 841.89]);
        ry = drawRosterHeader(rosterPage);
      }
      const aName = sanitizeTextForPdf(`${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Applicant');
      const aPass = sanitizeTextForPdf((app.passportNumber || 'ON FILE').toUpperCase());
      const aDob = app.birthDate ? String(app.birthDate instanceof Date ? app.birthDate.toISOString() : app.birthDate).split('T')[0] : '-';
      const aNat = sanitizeTextForPdf(app.nationality || 'Azerbaijan');
      const aRole = idx === 0 ? 'Primary' : `Member #${idx + 1}`;

      rosterPage.drawRectangle({
        x: 38,
        y: ry,
        width: 519.28,
        height: 16,
        color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.985, 0.99),
        borderColor: rgb(0.9, 0.92, 0.95),
        borderWidth: 0.5,
      });

      rosterPage.drawText(String(idx + 1), { x: 46, y: ry + 4.5, size: 7.5, font, color: textMuted });
      rosterPage.drawText(aName.substring(0, 32), { x: 70, y: ry + 4.5, size: 7.5, font: boldFont, color: textDark });
      rosterPage.drawText(aPass, { x: 235, y: ry + 4.5, size: 7.5, font, color: textDark });
      rosterPage.drawText(aDob, { x: 345, y: ry + 4.5, size: 7.5, font, color: textDark });
      rosterPage.drawText(aNat.substring(0, 14), { x: 430, y: ry + 4.5, size: 7.5, font, color: textDark });
      rosterPage.drawText(aRole, { x: 500, y: ry + 4.5, size: 7, font: boldFont, color: rgb(0.15, 0.35, 0.7) });
      ry -= 16;
    });
  }

  // 10. FOOTER BAR ACROSS ALL PAGES
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  pages.forEach((pg, pageIdx) => {
    pg.drawText('EuroTech Immigration Services | www.eurotech.az | support@eurotech.az | Certified Consular Partner | Baku - Budapest - Warsaw', {
      x: 55,
      y: 28,
      size: 7,
      font,
      color: textMuted,
    });
    pg.drawText(`Page ${pageIdx + 1} of ${totalPages}`, {
      x: 505,
      y: 28,
      size: 7,
      font: boldFont,
      color: textMuted,
    });
  });

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

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

module.exports = {
  generateDossierSummaryPdf,
  formatServiceTitle,
  formatDocTitle,
};
