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
  return String(text).replace(/[əƏıİşŞçÇğĞöÖüÜ]/g, (m) => charMap[m] || m);
}

async function generateManifestPdf({ appointmentId, groupBatchId, customGroupInfo, currentUser }) {
  let groupBatch = null;
  let appointment = null;
  let groupName = 'Official Group Manifest';
  let groupCode = '';
  let apptDate = '—';
  let apptTime = '—';
  let apptLocation = 'EuroTech Consular Center, Port Baku Towers';
  let applicants = [];

  if (appointmentId) {
    try {
      appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          timeSlot: true,
          groupBatch: {
            include: {
              dossiers: {
                include: { applicants: true },
              },
            },
          },
          dossier: {
            include: { applicants: true },
          },
        },
      });
      if (appointment) {
        groupBatch = appointment.groupBatch;
      }
    } catch (e) {
      // ignore invalid uuid query errors
    }

    if (!appointment) {
      // Search by groupBatch id or code
      try {
        groupBatch = await prisma.groupBatch.findFirst({
          where: {
            OR: [
              { id: appointmentId },
              { code: appointmentId },
            ],
          },
          include: {
            dossiers: {
              include: { applicants: true },
            },
            appointments: {
              include: { timeSlot: true },
            },
          },
        });
      } catch (e) {}
    }
  }

  if (!groupBatch && groupBatchId) {
    try {
      groupBatch = await prisma.groupBatch.findFirst({
        where: {
          OR: [
            { id: groupBatchId },
            { code: groupBatchId },
          ],
        },
        include: {
          dossiers: {
            include: { applicants: true },
          },
          appointments: {
            include: { timeSlot: true },
          },
        },
      });
    } catch (e) {}
  }

  // Ensure appointment or group exists in database
  if (!appointment && !groupBatch) {
    const error = new Error('Appointment or group batch not found in database');
    error.statusCode = 404;
    throw error;
  }

  // Collect real applicants exclusively from database
  if (groupBatch) {
    groupName = groupBatch.name || groupName;
    groupCode = groupBatch.code || groupCode;
    if (groupBatch.dossiers && groupBatch.dossiers.length > 0) {
      groupBatch.dossiers.forEach((d) => {
        if (d.applicants) applicants.push(...d.applicants);
      });
    }
  } else if (appointment && appointment.dossier && appointment.dossier.applicants) {
    applicants = appointment.dossier.applicants;
    groupName = appointment.dossier.dossierNumber || groupName;
    groupCode = appointment.dossier.dossierNumber || groupCode;
  }

  const primaryAppt = appointment || groupBatch?.appointments?.[0] || null;
  if (primaryAppt?.timeSlot) {
    apptDate = primaryAppt.timeSlot.date ? new Date(primaryAppt.timeSlot.date).toISOString().split('T')[0] : apptDate;
    apptTime = primaryAppt.timeSlot.startTime || apptTime;
    apptLocation = primaryAppt.location || primaryAppt.timeSlot.location || apptLocation;
  } else if (groupBatch?.travelDate) {
    apptDate = new Date(groupBatch.travelDate).toISOString().split('T')[0];
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  page.drawText('EUROTECH SERVICES - OFFICIAL GROUP APPOINTMENT MANIFEST', {
    x: 40,
    y: height - 50,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText(sanitizeTextForPdf(`Manifest Code: ${groupCode}  |  Destination: ${groupBatch?.destination || 'Europe'}`), {
    x: 40,
    y: height - 75,
    size: 10,
    font: boldFont,
  });

  page.drawText(sanitizeTextForPdf(`Group Title: ${groupName}`), {
    x: 40,
    y: height - 90,
    size: 10,
    font,
  });

  page.drawText(sanitizeTextForPdf(`Appointment Slot: ${apptDate} at ${apptTime} (${apptLocation})`), {
    x: 40,
    y: height - 105,
    size: 10,
    font,
  });

  page.drawText(sanitizeTextForPdf(`Total Passenger Capacity / Count: ${applicants.length} Applicants`), {
    x: 40,
    y: height - 120,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.5, 0.2),
  });

  // Table header
  let curPage = page;
  let y = height - 150;
  curPage.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 550, y: y + 10 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  curPage.drawText('No.', { x: 45, y, size: 9, font: boldFont });
  curPage.drawText('Full Name', { x: 80, y, size: 9, font: boldFont });
  curPage.drawText('Passport No.', { x: 260, y, size: 9, font: boldFont });
  curPage.drawText('Nationality', { x: 370, y, size: 9, font: boldFont });
  curPage.drawText('Biometrics', { x: 460, y, size: 9, font: boldFont });
  curPage.drawLine({ start: { x: 40, y: y - 5 }, end: { x: 550, y: y - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  y -= 20;
  if (applicants.length === 0) {
    curPage.drawText('No registered passengers found in database for this group.', { x: 45, y, size: 9, font });
  } else {
    applicants.forEach((app, idx) => {
      if (y <= 60) {
        curPage = pdfDoc.addPage([595, 842]);
        y = height - 60;
        curPage.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 550, y: y + 10 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
        curPage.drawText('No.', { x: 45, y, size: 9, font: boldFont });
        curPage.drawText('Full Name', { x: 80, y, size: 9, font: boldFont });
        curPage.drawText('Passport No.', { x: 260, y, size: 9, font: boldFont });
        curPage.drawText('Nationality', { x: 370, y, size: 9, font: boldFont });
        curPage.drawText('Biometrics', { x: 460, y, size: 9, font: boldFont });
        curPage.drawLine({ start: { x: 40, y: y - 5 }, end: { x: 550, y: y - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
        y -= 20;
      }

      const fullName = `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Passenger';
      curPage.drawText(`${idx + 1}`, { x: 45, y, size: 9, font });
      curPage.drawText(sanitizeTextForPdf(fullName), { x: 80, y, size: 9, font });
      curPage.drawText(sanitizeTextForPdf(`${app.passportNumber || '—'}`), { x: 260, y, size: 9, font });
      curPage.drawText(sanitizeTextForPdf(`${app.nationality || 'AZ'}`), { x: 370, y, size: 9, font });
      curPage.drawText('Scheduled', { x: 460, y, size: 9, font: boldFont, color: rgb(0.1, 0.4, 0.6) });
      y -= 18;
    });
  }

  // Footer stamp on final page
  curPage.drawText('EuroTech Services Official Consular Dispatch - Authorized Biometrics Manifest', {
    x: 40,
    y: 35,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const safeCode = groupCode || 'BATCH';
  const fileName = `manifest_${safeCode}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
    fileUrl: `/uploads/${fileName}`,
    downloadUrl: `/uploads/${fileName}`,
    pdfUrl: `/uploads/${fileName}`,
  };
}

module.exports = {
  generateManifestPdf,
};
