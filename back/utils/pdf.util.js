const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

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
    '—': '-', '–': '-',
  };
  return String(text).replace(/[əƏıİşŞçÇğĞöÖüÜ—–]/g, (m) => charMap[m] || m).replace(/[^\x20-\x7E]/g, ' ');
}

async function generateApplicationPdf(dossier, applicant) {
  return generateHarmonizedSchengenPdf(dossier, applicant);
}

/**
 * Generates official Harmonised Schengen Visa Application Form (PDF)
 */
async function generateHarmonizedSchengenPdf(dossier, applicant) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 Portrait
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const destCountry = dossier.country?.name || 'Schengen Member State';
  const birthStr = applicant.birthDate ? new Date(applicant.birthDate).toISOString().split('T')[0] : '1990-01-01';

  // --- Official Consular Header ---
  page.drawRectangle({
    x: 35,
    y: height - 75,
    width: width - 70,
    height: 50,
    color: rgb(0.06, 0.12, 0.22),
  });

  page.drawText('HARMONISED SCHENGEN VISA APPLICATION FORM', {
    x: 48,
    y: height - 48,
    size: 13,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText(sanitizeTextForPdf(`Application for Schengen Visa - Consular Mission: ${destCountry}`), {
    x: 48,
    y: height - 64,
    size: 8.5,
    font,
    color: rgb(0.85, 0.9, 1),
  });

  // Top dossier reference box
  page.drawRectangle({
    x: width - 180,
    y: height - 70,
    width: 135,
    height: 40,
    color: rgb(0.12, 0.2, 0.35),
  });
  page.drawText('OFFICIAL DOSSIER REF', {
    x: width - 173,
    y: height - 45,
    size: 7,
    font: boldFont,
    color: rgb(0.9, 0.95, 1),
  });
  page.drawText(sanitizeTextForPdf(dossier.dossierNumber || 'EUR-2026-0000'), {
    x: width - 173,
    y: height - 60,
    size: 10,
    font: boldFont,
    color: rgb(1, 0.85, 0.2),
  });

  // Section 1: Personal Data
  let curY = height - 95;

  const drawField = (label, val, x, y, w, h = 32) => {
    page.drawRectangle({
      x,
      y: y - h,
      width: w,
      height: h,
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 0.8,
      color: rgb(0.98, 0.99, 1),
    });
    page.drawText(sanitizeTextForPdf(label), {
      x: x + 6,
      y: y - 10,
      size: 7,
      font: boldFont,
      color: rgb(0.3, 0.4, 0.5),
    });
    page.drawText(sanitizeTextForPdf(val || '-'), {
      x: x + 6,
      y: y - 24,
      size: 9,
      font,
      color: rgb(0.08, 0.12, 0.2),
    });
  };

  // Row 1: Surname & First Name
  drawField('1. Surname (Family name)', applicant.lastName, 35, curY, 260);
  drawField('3. First name(s) (Given name(s))', applicant.firstName, 300, curY, 260);

  // Row 2: Birth, Nationality, Gender
  curY -= 36;
  drawField('4. Date of birth (YYYY-MM-DD)', birthStr, 35, curY, 130);
  drawField('5. Place of birth', 'Baku', 170, curY, 125);
  drawField('7. Current nationality', applicant.nationality || 'AZ', 300, curY, 125);
  drawField('8. Sex / Gender', applicant.gender || 'MALE', 430, curY, 130);

  // Row 3: Travel Document
  curY -= 36;
  drawField('12. Type of travel document', 'Ordinary Passport', 35, curY, 160);
  drawField('13. Number of travel document', applicant.passportNumber, 200, curY, 160);
  drawField('10. Family / Consular Role', applicant.familyRole || 'PRIMARY', 365, curY, 195);

  // Row 4: Destination & Purpose
  curY -= 36;
  drawField('21. Main purpose of journey', 'Tourism & Cultural Visit', 35, curY, 260);
  drawField('22. Member State of destination', destCountry, 300, curY, 260);

  // Row 5: Entries & Accommodation
  curY -= 36;
  drawField('24. Number of entries requested', 'Single / Multiple Entry', 35, curY, 260);
  drawField('25. Duration of intended stay', 'Up to 90 Days', 300, curY, 260);

  // Row 6: Financial means & Guarantee
  curY -= 36;
  drawField('31. Accommodation & Transport', 'Hotel Voucher / Confirmed Return Flight', 35, curY, 260);
  drawField('33. Cost of travelling & living covered by', 'Applicant (Self-financed & Bank Proof)', 300, curY, 260);

  // --- Official Declarations Box ---
  curY -= 48;
  page.drawRectangle({
    x: 35,
    y: curY - 140,
    width: width - 70,
    height: 140,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  });

  page.drawText('CONSULAR DECLARATIONS & BIOMETRIC DATA CONSENT', {
    x: 45,
    y: curY - 18,
    size: 8,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.4),
  });

  const legalLines = [
    '1. I am aware of and consent to the collection of my travel data, photo, and fingerprints for consular Schengen processing.',
    '2. I declare that to the best of my knowledge all particulars supplied by me are correct and complete.',
    '3. I am aware that any false statements will lead to my application being rejected or to the annulment of a visa already granted.',
    '4. I undertake to leave the territory of the Member States before the expiry of the visa, if granted.',
    '5. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory.',
  ];

  let legY = curY - 36;
  legalLines.forEach(line => {
    page.drawText(sanitizeTextForPdf(line), {
      x: 45,
      y: legY,
      size: 7.2,
      font,
      color: rgb(0.25, 0.3, 0.35),
    });
    legY -= 16;
  });

  // --- Signatures & Timestamp Area ---
  curY -= 155;
  const todayStr = new Date().toISOString().split('T')[0];

  drawField('Place and date of submission', `Baku, ${todayStr}`, 35, curY, 260, 48);
  drawField('Signature of applicant (or legal guardian)', '_______________________________', 300, curY, 260, 48);

  // Bottom Security Footer
  page.drawText(sanitizeTextForPdf(`EuroTech Consular Mobility Platform * Generated: ${new Date().toISOString()} * Form Rev: 2026-EU-01`), {
    x: 35,
    y: 25,
    size: 7,
    font,
    color: rgb(0.5, 0.55, 0.6),
  });

  const fileName = `schengen_harmonized_${dossier.dossierNumber}_${applicant.id}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return { fileName, filePath, fileUrl: `/uploads/${fileName}` };
}

/**
 * Generates official B2B Agent Group Tax Invoice & Commission Statement (PDF)
 */
async function generateGroupInvoicePdf(dossier, agentUser) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const paxCount = (dossier.applicants && dossier.applicants.length) || 1;
  const tier = (agentUser && agentUser.agentTier) || 'SILVER';

  let commissionPerPax = 25.0;
  if (tier === 'BRONZE') commissionPerPax = 20.0;
  if (tier === 'SILVER') commissionPerPax = 25.0;
  if (tier === 'GOLD') commissionPerPax = 28.0;
  if (tier === 'PLATINUM') commissionPerPax = 32.0;

  const govFeeTotal = (dossier.governmentFee || 80.0) * paxCount;
  const serviceFeeTotal = (dossier.serviceFee || 90.0) * paxCount;
  const grossTotal = govFeeTotal + serviceFeeTotal + (dossier.extraServicesFee || 0);
  const totalCommission = commissionPerPax * paxCount;
  const netPayable = Math.max(0, grossTotal - totalCommission);

  // Header
  page.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 55,
    color: rgb(0.08, 0.16, 0.3),
  });

  page.drawText('EUROTECH CONSULAR MOBILITY SERVICES', {
    x: 55,
    y: height - 55,
    size: 14,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL B2B AGENT GROUP INVOICE & COMMISSION CLEARING', {
    x: 55,
    y: height - 72,
    size: 8.5,
    font,
    color: rgb(0.85, 0.9, 1),
  });

  // Invoice Details
  let curY = height - 110;
  page.drawText(sanitizeTextForPdf(`Invoice No: INV-GROUP-${dossier.dossierNumber}`), { x: 40, y: curY, size: 10, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(sanitizeTextForPdf(`Date: ${new Date().toISOString().split('T')[0]}`), { x: width - 160, y: curY, size: 10, font, color: rgb(0.3, 0.35, 0.4) });

  curY -= 20;
  page.drawText(sanitizeTextForPdf(`Agent / Agency: ${agentUser?.fullName || 'B2B Travel Partner'}`), { x: 40, y: curY, size: 9, font, color: rgb(0.2, 0.25, 0.3) });
  page.drawText(sanitizeTextForPdf(`Partner Tier: ${tier} (Rate: €${commissionPerPax}/pax)`), { x: width - 240, y: curY, size: 9, font: boldFont, color: rgb(0.1, 0.45, 0.8) });

  curY -= 30;
  // Table Header
  page.drawRectangle({ x: 40, y: curY - 20, width: width - 80, height: 22, color: rgb(0.92, 0.94, 0.97) });
  page.drawText('Description', { x: 50, y: curY - 14, size: 8, font: boldFont, color: rgb(0.2, 0.25, 0.3) });
  page.drawText('Qty (Pax)', { x: 300, y: curY - 14, size: 8, font: boldFont, color: rgb(0.2, 0.25, 0.3) });
  page.drawText('Unit (€)', { x: 390, y: curY - 14, size: 8, font: boldFont, color: rgb(0.2, 0.25, 0.3) });
  page.drawText('Total (€)', { x: 480, y: curY - 14, size: 8, font: boldFont, color: rgb(0.2, 0.25, 0.3) });

  const drawRow = (desc, qty, unit, tot) => {
    curY -= 24;
    page.drawText(sanitizeTextForPdf(desc), { x: 50, y: curY - 14, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });
    page.drawText(String(qty), { x: 310, y: curY - 14, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });
    page.drawText(`€${unit.toFixed(2)}`, { x: 390, y: curY - 14, size: 8.5, font, color: rgb(0.1, 0.15, 0.2) });
    page.drawText(`€${tot.toFixed(2)}`, { x: 480, y: curY - 14, size: 8.5, font: boldFont, color: rgb(0.1, 0.15, 0.2) });
  };

  drawRow('Official Schengen Consular Visa Fee', paxCount, dossier.governmentFee || 80.0, govFeeTotal);
  drawRow('EuroTech Consular Biometrics & File Processing', paxCount, dossier.serviceFee || 90.0, serviceFeeTotal);
  if (dossier.extraServicesFee > 0) {
    drawRow('Group Add-on Services (Insurance/Lounge)', 1, dossier.extraServicesFee, dossier.extraServicesFee);
  }

  curY -= 24;
  page.drawLine({ start: { x: 40, y: curY }, end: { x: width - 40, y: curY }, thickness: 0.8, color: rgb(0.8, 0.85, 0.9) });

  // Commission Row
  curY -= 20;
  page.drawText(sanitizeTextForPdf(`B2B Agent Commission (${tier} Tier Reward: €${commissionPerPax} x ${paxCount})`), {
    x: 50,
    y: curY,
    size: 9,
    font: boldFont,
    color: rgb(0.1, 0.6, 0.25),
  });
  page.drawText(`- €${totalCommission.toFixed(2)}`, { x: 480, y: curY, size: 9, font: boldFont, color: rgb(0.1, 0.6, 0.25) });

  // Total Summary Box
  curY -= 40;
  page.drawRectangle({
    x: width - 260,
    y: curY - 45,
    width: 220,
    height: 45,
    color: rgb(0.08, 0.16, 0.3),
  });
  page.drawText('NET AMOUNT PAYABLE:', { x: width - 245, y: curY - 20, size: 8.5, font: boldFont, color: rgb(0.85, 0.9, 1) });
  page.drawText(`€${netPayable.toFixed(2)}`, { x: width - 245, y: curY - 38, size: 14, font: boldFont, color: rgb(1, 0.85, 0.2) });

  // Bank Wire Details
  curY -= 75;
  page.drawRectangle({ x: 40, y: curY - 80, width: width - 80, height: 80, borderColor: rgb(0.8, 0.85, 0.9), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('SETTLEMENT & PAYMENT INSTRUCTIONS', { x: 50, y: curY - 18, size: 8, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
  page.drawText('Beneficiary: EuroTech Consular Mobility Services LLC', { x: 50, y: curY - 34, size: 8, font, color: rgb(0.2, 0.25, 0.3) });
  page.drawText('IBAN: AZ21NABZ01350100000000123456 (EUR Account)', { x: 50, y: curY - 48, size: 8, font, color: rgb(0.2, 0.25, 0.3) });
  page.drawText(sanitizeTextForPdf(`Payment Reference: INV-GROUP-${dossier.dossierNumber}`), { x: 50, y: curY - 62, size: 8, font: boldFont, color: rgb(0.1, 0.3, 0.7) });

  const fileName = `group_invoice_${dossier.dossierNumber}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return { fileName, filePath, fileUrl: `/uploads/${fileName}` };
}

/**
 * Generates official Corporate Guarantee & Sponsorship Letter (PDF)
 */
async function generateCorporateGuaranteeLetterPdf(dossier, employee, corporateUser) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const companyName = corporateUser?.companyName || corporateUser?.fullName || 'EuroTech Corporate Client';
  const destCountry = dossier.country?.name || 'Schengen Member State';
  const todayStr = new Date().toISOString().split('T')[0];

  // Header
  page.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 55,
    color: rgb(0.1, 0.2, 0.35),
  });

  page.drawText(sanitizeTextForPdf(companyName.toUpperCase()), {
    x: 55,
    y: height - 55,
    size: 13,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL CORPORATE SPONSORSHIP & FINANCIAL GUARANTEE LETTER', {
    x: 55,
    y: height - 72,
    size: 8.5,
    font,
    color: rgb(0.85, 0.9, 1),
  });

  let curY = height - 120;
  page.drawText(sanitizeTextForPdf(`Date: ${todayStr}`), { x: 40, y: curY, size: 9, font, color: rgb(0.3, 0.35, 0.4) });
  page.drawText(sanitizeTextForPdf(`Ref: CORP-GUARANTEE-${dossier.dossierNumber}`), { x: width - 240, y: curY, size: 9, font: boldFont, color: rgb(0.1, 0.2, 0.35) });

  curY -= 30;
  page.drawText('To: The Consular Section / Embassy of ' + sanitizeTextForPdf(destCountry), {
    x: 40,
    y: curY,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.25),
  });

  curY -= 30;
  const p1 = `We hereby confirm that Mr./Ms. ${employee.firstName} ${employee.lastName}, holder of passport number ${employee.passportNumber}, is an authorized full-time employee of ${companyName}.`;
  page.drawText(sanitizeTextForPdf(p1), { x: 40, y: curY, size: 9.5, font, color: rgb(0.15, 0.2, 0.25) });

  curY -= 24;
  const p2 = `Our organization requests the issuance of a Schengen Business Visa for the purpose of attending official technical negotiations, high-level corporate consultations, and partner projects in ${destCountry}.`;
  page.drawText(sanitizeTextForPdf(p2), { x: 40, y: curY, size: 9.5, font, color: rgb(0.15, 0.2, 0.25) });

  curY -= 30;
  page.drawText('CORPORATE FINANCIAL & MOBILITY COMMITMENTS:', {
    x: 40,
    y: curY,
    size: 9,
    font: boldFont,
    color: rgb(0.1, 0.25, 0.5),
  });

  const commitments = [
    `1. Financial Guarantee: ${companyName} guarantees full financial coverage for all business travel expenses, international medical insurance with minimum EUR 30,000 emergency coverage, accommodation, and subsistence.`,
    `2. Return Assurance: We unconditionally guarantee that Mr./Ms. ${employee.firstName} ${employee.lastName} will respect all Schengen visa regulations and return to the Republic of Azerbaijan prior to visa expiry.`,
    `3. Contact Liaison: For consular verification, our Human Resources and Mobility Department may be reached at ${corporateUser?.email || 'hr@eurotech.services'}.`,
  ];

  commitments.forEach(c => {
    curY -= 26;
    page.drawText(sanitizeTextForPdf(c), {
      x: 40,
      y: curY,
      size: 8.5,
      font,
      color: rgb(0.2, 0.25, 0.3),
    });
  });

  // Corporate Signature Box
  curY -= 70;
  page.drawRectangle({
    x: 40,
    y: curY - 90,
    width: width - 80,
    height: 90,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  page.drawText('AUTHORIZED CORPORATE SIGNATORY & SEAL', { x: 55, y: curY - 20, size: 8, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
  page.drawText(sanitizeTextForPdf(`Signatory: ${corporateUser?.fullName || 'Authorized Corporate Officer'}`), { x: 55, y: curY - 40, size: 9, font, color: rgb(0.2, 0.25, 0.3) });
  page.drawText('Title: Head of Talent Mobility & Corporate Affairs', { x: 55, y: curY - 56, size: 8.5, font, color: rgb(0.3, 0.35, 0.4) });
  page.drawText('Signature & Company Stamp: _________________________________', { x: 55, y: curY - 76, size: 8.5, font, color: rgb(0.3, 0.35, 0.4) });

  const fileName = `corporate_guarantee_${dossier.dossierNumber}_${employee.id}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return { fileName, filePath, fileUrl: `/uploads/${fileName}` };
}

module.exports = {
  generateApplicationPdf,
  generateHarmonizedSchengenPdf,
  generateGroupInvoicePdf,
  generateCorporateGuaranteeLetterPdf,
};
