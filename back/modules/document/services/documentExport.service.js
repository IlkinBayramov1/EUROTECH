const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../../config/db');
const env = require('../../../config/env');

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

async function generateChecklistPdf(dossierId, currentUser) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      country: true,
      visaCategory: {
        include: { requiredDocTypes: true },
      },
      applicants: true,
      documents: true,
      user: true,
    },
  });

  if (!dossier) {
    const error = new Error('Dossier not found');
    error.statusCode = 404;
    throw error;
  }

  const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const isOwner = dossier.userId === currentUser.id;
  if (!isStaff && !isOwner) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background Header Banner
  page.drawRectangle({
    x: 40,
    y: 740,
    width: 515.28,
    height: 65,
    color: rgb(0.06, 0.12, 0.22),
  });

  page.drawText('EUROTECH IMMIGRATION SERVICES', {
    x: 55,
    y: 778,
    size: 14,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL SCHENGEN VISA DOCUMENT REPOSITORY CHECKLIST', {
    x: 55,
    y: 758,
    size: 9,
    font: boldFont,
    color: rgb(0.3, 0.65, 1.0),
  });

  const currentDate = new Date().toISOString().split('T')[0];
  page.drawText(`Date: ${currentDate}`, {
    x: 440,
    y: 778,
    size: 9,
    font: boldFont,
    color: rgb(0.9, 0.9, 0.9),
  });
  page.drawText(`Dossier: ${dossier.dossierNumber}`, {
    x: 390,
    y: 758,
    size: 9,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Dossier Summary Box
  let y = 710;
  page.drawRectangle({
    x: 40,
    y: y - 55,
    width: 515.28,
    height: 55,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1,
  });

  const applicant = dossier.applicants[0] || {};
  const applicantName = sanitizeTextForPdf(`${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || dossier.user.fullName || 'N/A');
  const passportNum = applicant.passportNumber || 'N/A';
  const countryName = sanitizeTextForPdf(dossier.country?.nameEn || 'Hungary');
  const visaCategoryName = sanitizeTextForPdf(dossier.visaCategory?.nameEn || 'Schengen C (Short Stay)');

  page.drawText('PRIMARY APPLICANT:', { x: 55, y: y - 18, size: 8, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(applicantName, { x: 160, y: y - 18, size: 9, font: boldFont, color: rgb(0.08, 0.15, 0.28) });

  page.drawText('PASSPORT NUMBER:', { x: 340, y: y - 18, size: 8, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(passportNum, { x: 440, y: y - 18, size: 9, font: boldFont, color: rgb(0.08, 0.15, 0.28) });

  page.drawText('DESTINATION & VISA:', { x: 55, y: y - 38, size: 8, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(`${countryName} - ${visaCategoryName}`, { x: 160, y: y - 38, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });

  page.drawText('DOSSIER STATUS:', { x: 340, y: y - 38, size: 8, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(dossier.status, { x: 440, y: y - 38, size: 8.5, font: boldFont, color: rgb(0.1, 0.5, 0.3) });

  // Document Table Header
  y -= 80;
  page.drawRectangle({
    x: 40,
    y: y - 20,
    width: 515.28,
    height: 20,
    color: rgb(0.12, 0.23, 0.42),
  });

  page.drawText('NO', { x: 48, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('REQUIRED DOCUMENT', { x: 75, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('MANDATORY', { x: 235, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('STATUS', { x: 310, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('UPLOADED FILE / DATE', { x: 395, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  y -= 20;

  const standardDocs = [
    { code: 'PASSPORT', nameEn: 'Valid Passport Copy', isMandatory: true },
    { code: 'BIOMETRIC_PHOTO', nameEn: 'Biometric Photograph', isMandatory: true },
    { code: 'BANK_STATEMENT', nameEn: 'Proof of Financial Means', isMandatory: true },
    { code: 'EMPLOYMENT_LETTER', nameEn: 'Employment / Leave Letter', isMandatory: true },
    { code: 'ACCOMMODATION', nameEn: 'Proof of Accommodation', isMandatory: true },
    { code: 'FLIGHT_ITINERARY', nameEn: 'Flight Itinerary', isMandatory: true },
    { code: 'INSURANCE', nameEn: 'Travel Medical Insurance', isMandatory: true },
  ];

  const requiredList = (dossier.visaCategory?.requiredDocTypes && dossier.visaCategory.requiredDocTypes.length > 0)
    ? dossier.visaCategory.requiredDocTypes.map(r => ({
        code: r.code,
        nameEn: r.nameEn || r.code,
        isMandatory: r.isRequired,
      }))
    : standardDocs;

  requiredList.forEach((reqItem, idx) => {
    const uploaded = dossier.documents.find(
      d => d.requiredDocumentType === reqItem.code || d.requiredDocumentType?.toLowerCase() === reqItem.code.toLowerCase()
    );

    const isEven = idx % 2 === 0;
    page.drawRectangle({
      x: 40,
      y: y - 24,
      width: 515.28,
      height: 24,
      color: isEven ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.9, 0.92, 0.96),
      borderWidth: 0.5,
    });

    const statusText = uploaded ? uploaded.status : 'MISSING';
    const statusColor = statusText === 'VERIFIED' ? rgb(0.08, 0.55, 0.28) :
                        statusText === 'PENDING' ? rgb(0.1, 0.45, 0.8) :
                        statusText === 'REJECTED' || statusText === 'NEEDS_CORRECTION' ? rgb(0.85, 0.15, 0.15) : rgb(0.5, 0.5, 0.5);

    const fileNameText = uploaded ? sanitizeTextForPdf(uploaded.fileName).substring(0, 22) : '-';

    page.drawText(String(idx + 1), { x: 50, y: y - 16, size: 8, font, color: rgb(0.2, 0.25, 0.3) });
    page.drawText(sanitizeTextForPdf(reqItem.nameEn), { x: 75, y: y - 16, size: 8, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
    page.drawText(reqItem.isMandatory ? 'YES' : 'OPTIONAL', { x: 240, y: y - 16, size: 7.5, font, color: reqItem.isMandatory ? rgb(0.8, 0.2, 0.2) : rgb(0.4, 0.4, 0.4) });
    page.drawText(statusText, { x: 310, y: y - 16, size: 8, font: boldFont, color: statusColor });
    page.drawText(fileNameText, { x: 395, y: y - 16, size: 7.5, font, color: rgb(0.3, 0.35, 0.4) });

    y -= 24;
  });

  // Consular Compliance & Signature Section
  y -= 25;
  page.drawRectangle({
    x: 40,
    y: y - 65,
    width: 250,
    height: 65,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });
  page.drawText('LEGAL COMPLIANCE NOTICE', { x: 50, y: y - 16, size: 8, font: boldFont, color: rgb(0.1, 0.25, 0.5) });
  page.drawText('All documents uploaded to this repository are encrypted', { x: 50, y: y - 30, size: 7, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('under AES-256 and compliant with the Schengen Visa Code.', { x: 50, y: y - 42, size: 7, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('Official submission status is audited by EuroTech Consular Staff.', { x: 50, y: y - 54, size: 7, font, color: rgb(0.3, 0.35, 0.45) });

  page.drawRectangle({
    x: 305,
    y: y - 65,
    width: 250,
    height: 65,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });
  page.drawText('OFFICIAL VERIFICATION STAMP', { x: 315, y: y - 16, size: 8, font: boldFont, color: rgb(0.1, 0.25, 0.5) });
  page.drawText('EUROTECH IMMIGRATION PLATFORM', { x: 315, y: y - 32, size: 8, font: boldFont, color: rgb(0.15, 0.55, 0.3) });
  page.drawText(`VERIFIED ELECTRONIC RECORD - ${currentDate}`, { x: 315, y: y - 45, size: 7, font, color: rgb(0.4, 0.45, 0.55) });
  page.drawText(`Ref: ${dossier.dossierNumber}`, { x: 315, y: y - 56, size: 7, font: boldFont, color: rgb(0.2, 0.3, 0.4) });

  // Security Seal Footer
  page.drawRectangle({
    x: 40,
    y: 25,
    width: 515.28,
    height: 25,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });

  page.drawText('EUROTECH SECURE DOCUMENT REPOSITORY  |  CERTIFIED SUBMISSION PROTOCOL  |  SCHENGEN ANNEX I', {
    x: 65,
    y: 34,
    size: 7,
    font: boldFont,
    color: rgb(0.2, 0.35, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const fileName = `Document_Checklist_${dossier.dossierNumber}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    filePath,
    fileName,
    pdfBytes,
    downloadUrl: `/uploads/${fileName}`,
  };
}

async function exportChecklistExcel(dossierId, currentUser) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      country: true,
      visaCategory: {
        include: { requiredDocTypes: true },
      },
      applicants: true,
      documents: true,
      user: true,
    },
  });

  if (!dossier) {
    const error = new Error('Dossier not found');
    error.statusCode = 404;
    throw error;
  }

  const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const isOwner = dossier.userId === currentUser.id;
  if (!isStaff && !isOwner) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  const applicant = dossier.applicants[0] || {};
  const applicantName = `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || dossier.user.fullName || 'Müraciətçi';

  const standardDocs = [
    { code: 'PASSPORT', nameAz: 'Pasport surəti', isMandatory: true },
    { code: 'BIOMETRIC_PHOTO', nameAz: 'Biometrik foto', isMandatory: true },
    { code: 'BANK_STATEMENT', nameAz: 'Bank çıxarışı (3 ay)', isMandatory: true },
    { code: 'EMPLOYMENT_LETTER', nameAz: 'İş yerindən arayış', isMandatory: true },
    { code: 'ACCOMMODATION', nameAz: 'Otel / Yaşayış yeri təsdiqi', isMandatory: true },
    { code: 'FLIGHT_ITINERARY', nameAz: 'Uçuş bileti rezervasiyası', isMandatory: true },
    { code: 'INSURANCE', nameAz: 'Şengen Səyahət Sığortası', isMandatory: true },
  ];

  const requiredList = (dossier.visaCategory?.requiredDocTypes && dossier.visaCategory.requiredDocTypes.length > 0)
    ? dossier.visaCategory.requiredDocTypes.map(r => ({
        code: r.code,
        nameAz: r.nameAz || r.nameEn || r.code,
        isMandatory: r.isRequired,
      }))
    : standardDocs;

  const rows = [
    ['Müraciət Nömrəsi', 'Müraciətçi', 'Sənəd Kodu', 'Sənəd Adı', 'Məcburidir', 'Status', 'Fayl Adı', 'Fayl Ölçüsü (KB)', 'Yoxlanış Qeydi'],
  ];

  requiredList.forEach(reqItem => {
    const uploaded = dossier.documents.find(
      d => d.requiredDocumentType === reqItem.code || d.requiredDocumentType?.toLowerCase() === reqItem.code.toLowerCase()
    );

    const status = uploaded ? uploaded.status : 'MISSING';
    const fileName = uploaded ? uploaded.fileName : '-';
    const fileSize = uploaded ? Math.round((uploaded.fileSize || 0) / 1024) : 0;
    const notes = uploaded ? (uploaded.operatorNotes || '') : '';

    rows.push([
      dossier.dossierNumber,
      applicantName,
      reqItem.code,
      reqItem.nameAz,
      reqItem.isMandatory ? 'Bəli' : 'Xeyr',
      status,
      fileName,
      fileSize,
      notes,
    ]);
  });

  const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const fileName = `Document_Checklist_${dossier.dossierNumber}_${Date.now()}.csv`;

  return {
    csvContent,
    fileName,
  };
}

module.exports = {
  sanitizeTextForPdf,
  generateChecklistPdf,
  exportChecklistExcel,
};
