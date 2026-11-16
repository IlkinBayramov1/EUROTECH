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

function getChecklistRequiredDocs(dossier) {
  const standardDocs = [
    { code: 'PASSPORT', nameEn: 'Valid Passport Copy', nameAz: 'Pasport surəti', isMandatory: true },
    { code: 'BIOMETRIC_PHOTO', nameEn: 'Biometric Photograph', nameAz: 'Biometrik foto', isMandatory: true },
    { code: 'BANK_STATEMENT', nameEn: 'Proof of Financial Means', nameAz: 'Bank çıxarışı (3 ay)', isMandatory: true },
    { code: 'EMPLOYMENT_LETTER', nameEn: 'Employment / Leave Letter', nameAz: 'İş yerindən arayış', isMandatory: true },
    { code: 'ACCOMMODATION', nameEn: 'Proof of Accommodation', nameAz: 'Otel / Yaşayış yeri təsdiqi', isMandatory: true },
    { code: 'FLIGHT_ITINERARY', nameEn: 'Flight Itinerary', nameAz: 'Uçuş bileti rezervasiyası', isMandatory: true },
    { code: 'INSURANCE', nameEn: 'Travel Medical Insurance', nameAz: 'Şengen Səyahət Sığortası', isMandatory: true },
  ];

  if (dossier.visaCategory?.requiredDocTypes && dossier.visaCategory.requiredDocTypes.length > 0) {
    return dossier.visaCategory.requiredDocTypes.map((r) => ({
      code: r.code,
      nameEn: r.nameEn || r.code,
      nameAz: r.nameAz || r.nameEn || r.code,
      isMandatory: r.isRequired,
    }));
  }
  return standardDocs;
}

function resolveApplicantChecklistRows(applicant, isSingleApplicant, dossierDocs, requiredList) {
  const rows = [];
  const usedDocIds = new Set();

  requiredList.forEach((reqItem) => {
    const reqLower = String(reqItem.code || '').toLowerCase();
    let uploaded = dossierDocs.find(
      (d) =>
        applicant.id &&
        d.applicantId === applicant.id &&
        String(d.requiredDocumentType || '').toLowerCase() === reqLower
    );

    if (!uploaded) {
      uploaded = dossierDocs.find(
        (d) =>
          (d.isSharedWithFamily || !d.applicantId || isSingleApplicant) &&
          String(d.requiredDocumentType || '').toLowerCase() === reqLower
      );
    }

    if (uploaded) usedDocIds.add(uploaded.id);
    rows.push({
      code: reqItem.code,
      titleEn: reqItem.nameEn,
      titleAz: reqItem.nameAz || reqItem.nameEn,
      isMandatory: reqItem.isMandatory,
      uploaded,
    });
  });

  // Include extra/additional uploaded documents belonging to this applicant
  dossierDocs.forEach((d) => {
    if (usedDocIds.has(d.id)) return;
    const belongsToApplicant = applicant.id ? d.applicantId === applicant.id : !d.applicantId;
    const isSharedDossierDoc = !d.applicantId && isSingleApplicant;
    if (belongsToApplicant || isSharedDossierDoc) {
      usedDocIds.add(d.id);
      const label = String(d.requiredDocumentType || 'OTHER').replace(/_/g, ' ');
      rows.push({
        code: d.requiredDocumentType || 'OTHER',
        titleEn: label,
        titleAz: label,
        isMandatory: !!d.isMandatory,
        uploaded: d,
      });
    }
  });

  return rows;
}

function drawChecklistPageHeader(page, { font, boldFont, dossier, applicant, memberIndex, totalMembers, isContinuation, currentDate }) {
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

  const dossierNumSafe = sanitizeTextForPdf(dossier.dossierNumber || dossier.id);
  page.drawText(`Date: ${currentDate}`, {
    x: 440,
    y: 778,
    size: 9,
    font: boldFont,
    color: rgb(0.9, 0.9, 0.9),
  });
  page.drawText(`Dossier: ${dossierNumSafe}`, {
    x: 390,
    y: 758,
    size: 9,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Member / Dossier Summary Box
  const y = 725;
  page.drawRectangle({
    x: 40,
    y: y - 70,
    width: 515.28,
    height: 70,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1,
  });

  const applicantName = sanitizeTextForPdf(
    `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || dossier.user?.fullName || 'N/A'
  );
  const passportNum = sanitizeTextForPdf(applicant.passportNumber || 'N/A');
  const dobStr = applicant.birthDate ? String(applicant.birthDate instanceof Date ? applicant.birthDate.toISOString() : applicant.birthDate).split('T')[0] : 'N/A';
  const nationalityStr = sanitizeTextForPdf(applicant.nationality || 'AZ');
  const countryName = sanitizeTextForPdf(dossier.country?.nameEn || 'Hungary');
  const visaCategoryName = sanitizeTextForPdf(dossier.visaCategory?.nameEn || 'Schengen C (Short Stay)');
  const statusStr = sanitizeTextForPdf(dossier.status || 'RECEIVED');
  const memberRoleLabel = totalMembers > 1
    ? `GROUP MEMBER ${memberIndex + 1} OF ${totalMembers}${isContinuation ? ' (CONT.)' : ''}`
    : (isContinuation ? 'PRIMARY APPLICANT (CONT.)' : 'PRIMARY APPLICANT');

  page.drawText(`${memberRoleLabel}:`, { x: 55, y: y - 16, size: 7.5, font: boldFont, color: rgb(0.12, 0.32, 0.62) });
  page.drawText(applicantName.substring(0, 32), { x: 180, y: y - 16, size: 9, font: boldFont, color: rgb(0.08, 0.15, 0.28) });

  page.drawText('PASSPORT NUMBER:', { x: 350, y: y - 16, size: 7.5, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(passportNum, { x: 450, y: y - 16, size: 9, font: boldFont, color: rgb(0.08, 0.15, 0.28) });

  page.drawText('DATE OF BIRTH:', { x: 55, y: y - 35, size: 7.5, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(dobStr, { x: 180, y: y - 35, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });

  page.drawText('NATIONALITY:', { x: 350, y: y - 35, size: 7.5, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(nationalityStr, { x: 450, y: y - 35, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });

  page.drawText('DESTINATION & VISA:', { x: 55, y: y - 54, size: 7.5, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(`${countryName} - ${visaCategoryName}`.substring(0, 38), { x: 180, y: y - 54, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });

  page.drawText('DOSSIER STATUS:', { x: 350, y: y - 54, size: 7.5, font: boldFont, color: rgb(0.3, 0.4, 0.5) });
  page.drawText(statusStr, { x: 450, y: y - 54, size: 8.5, font: boldFont, color: rgb(0.1, 0.5, 0.3) });

  // Document Table Header
  const tableTopY = 640;
  page.drawRectangle({
    x: 40,
    y: tableTopY - 20,
    width: 515.28,
    height: 20,
    color: rgb(0.12, 0.23, 0.42),
  });

  page.drawText('NO', { x: 48, y: tableTopY - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('REQUIRED DOCUMENT', { x: 75, y: tableTopY - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('MANDATORY', { x: 235, y: tableTopY - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('STATUS', { x: 310, y: tableTopY - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('UPLOADED FILE / DATE', { x: 395, y: tableTopY - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  return tableTopY - 20;
}

function drawChecklistComplianceSection(page, { font, boldFont, y, dossierNumber, currentDate }) {
  const safeDossierNumber = sanitizeTextForPdf(dossierNumber);
  const boxY = Math.max(62, y - 80);

  page.drawRectangle({
    x: 40,
    y: boxY,
    width: 250,
    height: 62,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });
  page.drawText('LEGAL COMPLIANCE NOTICE', { x: 50, y: boxY + 47, size: 8, font: boldFont, color: rgb(0.1, 0.25, 0.5) });
  page.drawText('All documents uploaded to this repository are encrypted', { x: 50, y: boxY + 33, size: 7, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('under AES-256 and compliant with the Schengen Visa Code.', { x: 50, y: boxY + 21, size: 7, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('Official submission status is audited by EuroTech Consular Staff.', { x: 50, y: boxY + 9, size: 7, font, color: rgb(0.3, 0.35, 0.45) });

  page.drawRectangle({
    x: 305,
    y: boxY,
    width: 250,
    height: 62,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });
  page.drawText('OFFICIAL VERIFICATION STAMP', { x: 315, y: boxY + 47, size: 8, font: boldFont, color: rgb(0.1, 0.25, 0.5) });
  page.drawText('EUROTECH IMMIGRATION PLATFORM', { x: 315, y: boxY + 32, size: 8, font: boldFont, color: rgb(0.15, 0.55, 0.3) });
  page.drawText(`VERIFIED ELECTRONIC RECORD - ${currentDate}`, { x: 315, y: boxY + 20, size: 7, font, color: rgb(0.4, 0.45, 0.55) });
  page.drawText(`Ref: ${safeDossierNumber}`, { x: 315, y: boxY + 8, size: 7, font: boldFont, color: rgb(0.2, 0.3, 0.4) });
}

async function generateChecklistPdf(dossierId, currentUser = null) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      country: true,
      visaCategory: {
        include: { requiredDocTypes: true },
      },
      applicants: {
        orderBy: { id: 'asc' },
      },
      documents: {
        orderBy: { id: 'asc' },
      },
      user: true,
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
    if (!isStaff && !isOwner) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const currentDate = new Date().toISOString().split('T')[0];

  const sortedApplicants = [...(dossier.applicants || [])].sort((a, b) =>
    a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0
  );

  const applicantsList = sortedApplicants.length > 0
    ? sortedApplicants
    : [{
        id: null,
        firstName: dossier.user?.fullName || 'Client',
        lastName: '',
        passportNumber: 'N/A',
        nationality: 'AZ',
        birthDate: null,
      }];

  const isSingleApplicant = applicantsList.length === 1;
  const requiredList = getChecklistRequiredDocs(dossier);

  // Generate dedicated page(s) inside the same PDF document for EACH group/dossier member
  applicantsList.forEach((applicant, memberIdx) => {
    const memberRows = resolveApplicantChecklistRows(applicant, isSingleApplicant, dossier.documents || [], requiredList);

    let page = pdfDoc.addPage([595.28, 841.89]);
    let y = drawChecklistPageHeader(page, {
      font,
      boldFont,
      dossier,
      applicant,
      memberIndex: memberIdx,
      totalMembers: applicantsList.length,
      isContinuation: false,
      currentDate,
    });

    memberRows.forEach((row, idx) => {
      if (y - 24 < 140) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = drawChecklistPageHeader(page, {
          font,
          boldFont,
          dossier,
          applicant,
          memberIndex: memberIdx,
          totalMembers: applicantsList.length,
          isContinuation: true,
          currentDate,
        });
      }

      const uploaded = row.uploaded;
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

      const statusText = sanitizeTextForPdf(uploaded ? uploaded.status : 'MISSING');
      const statusColor = statusText === 'VERIFIED' ? rgb(0.08, 0.55, 0.28) :
                          statusText === 'PENDING' ? rgb(0.1, 0.45, 0.8) :
                          statusText === 'REJECTED' || statusText === 'NEEDS_CORRECTION' ? rgb(0.85, 0.15, 0.15) : rgb(0.5, 0.5, 0.5);

      const fileNameText = uploaded ? sanitizeTextForPdf(uploaded.fileName).substring(0, 22) : '-';

      page.drawText(String(idx + 1), { x: 50, y: y - 16, size: 8, font, color: rgb(0.2, 0.25, 0.3) });
      page.drawText(sanitizeTextForPdf(row.titleEn).substring(0, 28), { x: 75, y: y - 16, size: 8, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
      page.drawText(row.isMandatory ? 'YES' : 'OPTIONAL', { x: 240, y: y - 16, size: 7.5, font, color: row.isMandatory ? rgb(0.8, 0.2, 0.2) : rgb(0.4, 0.4, 0.4) });
      page.drawText(statusText, { x: 310, y: y - 16, size: 8, font: boldFont, color: statusColor });
      page.drawText(fileNameText, { x: 395, y: y - 16, size: 7.5, font, color: rgb(0.3, 0.35, 0.4) });

      y -= 24;
    });

    drawChecklistComplianceSection(page, {
      font,
      boldFont,
      y,
      dossierNumber: dossier.dossierNumber || dossier.id,
      currentDate,
    });
  });

  // Add Security Seal Footer & dynamic Page X of N across all pages
  const allPages = pdfDoc.getPages();
  const totalPages = allPages.length;
  allPages.forEach((pg, pageIdx) => {
    pg.drawRectangle({
      x: 40,
      y: 25,
      width: 515.28,
      height: 25,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.94),
      borderWidth: 1,
    });

    pg.drawText('EUROTECH SECURE DOCUMENT REPOSITORY  |  CERTIFIED SUBMISSION PROTOCOL  |  SCHENGEN ANNEX I', {
      x: 52,
      y: 34,
      size: 6.8,
      font: boldFont,
      color: rgb(0.2, 0.35, 0.55),
    });

    pg.drawText(`Page ${pageIdx + 1} of ${totalPages}`, {
      x: 495,
      y: 34,
      size: 7.2,
      font: boldFont,
      color: rgb(0.2, 0.35, 0.55),
    });
  });

  const pdfBytes = await pdfDoc.save();
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const safeRef = String(dossier.dossierNumber || dossier.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Document_Checklist_${safeRef}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    filePath,
    fileName,
    pdfBytes,
    pageCount: totalPages,
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
      applicants: {
        orderBy: { id: 'asc' },
      },
      documents: {
        orderBy: { id: 'asc' },
      },
      user: true,
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
    if (!isStaff && !isOwner) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }
  }

  const sortedApplicants = [...(dossier.applicants || [])].sort((a, b) =>
    a.familyRole === 'PRIMARY' ? -1 : b.familyRole === 'PRIMARY' ? 1 : 0
  );
  const applicantsList = sortedApplicants.length > 0
    ? sortedApplicants
    : [{ id: null, firstName: dossier.user?.fullName || 'Müraciətçi', lastName: '', passportNumber: '-' }];
  const isSingleApplicant = applicantsList.length === 1;
  const requiredList = getChecklistRequiredDocs(dossier);

  const rows = [
    ['Müraciət Nömrəsi', 'Müraciətçi', 'Pasport', 'Sənəd Kodu', 'Sənəd Adı', 'Məcburidir', 'Status', 'Fayl Adı', 'Fayl Ölçüsü (KB)', 'Yoxlanış Qeydi'],
  ];

  applicantsList.forEach((applicant) => {
    const applicantName = `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || dossier.user?.fullName || 'Müraciətçi';
    const memberRows = resolveApplicantChecklistRows(applicant, isSingleApplicant, dossier.documents || [], requiredList);

    memberRows.forEach((row) => {
      const uploaded = row.uploaded;
      const status = uploaded ? uploaded.status : 'MISSING';
      const fileName = uploaded ? uploaded.fileName : '-';
      const fileSize = uploaded ? Math.round((uploaded.fileSize || 0) / 1024) : 0;
      const notes = uploaded ? (uploaded.operatorNotes || '') : '';

      rows.push([
        dossier.dossierNumber,
        applicantName,
        applicant.passportNumber || '-',
        row.code,
        row.titleAz,
        row.isMandatory ? 'Bəli' : 'Xeyr',
        status,
        fileName,
        fileSize,
        notes,
      ]);
    });
  });

  const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const safeRef = String(dossier.dossierNumber || dossier.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Document_Checklist_${safeRef}_${Date.now()}.csv`;

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
