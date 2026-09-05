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
  };
  return String(text).replace(/[əƏıİşŞçÇğĞöÖüÜ]/g, (m) => charMap[m] || m);
}

async function generateApplicationPdf(dossier, applicant) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  page.drawText('EUROTECH SERVICES - OFFICIAL VISA APPLICATION FORM', {
    x: 50,
    y: height - 50,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText(sanitizeTextForPdf(`Dossier Number: ${dossier.dossierNumber}`), {
    x: 50,
    y: height - 80,
    size: 12,
    font: boldFont,
  });

  page.drawText(sanitizeTextForPdf(`Applicant Name: ${applicant.firstName} ${applicant.lastName}`), {
    x: 50,
    y: height - 110,
    size: 11,
    font,
  });

  page.drawText(sanitizeTextForPdf(`Passport Number: ${applicant.passportNumber}`), {
    x: 50,
    y: height - 130,
    size: 11,
    font,
  });

  page.drawText(sanitizeTextForPdf(`Submitted Date: ${new Date().toISOString().split('T')[0]}`), {
    x: 50,
    y: height - 150,
    size: 11,
    font,
  });

  const fileName = `application_form_${dossier.dossierNumber}_${applicant.id}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return { fileName, filePath, fileUrl: `/uploads/${fileName}` };
}

module.exports = {
  generateApplicationPdf,
};
