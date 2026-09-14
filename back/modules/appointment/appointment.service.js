const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const prisma = require('../../config/db');
const env = require('../../config/env');

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

async function getAvailableSlots({ date, location }) {
  const where = { isActive: true };

  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    where.date = { gte: startOfDay, lte: endOfDay };
  }

  if (location) {
    where.location = { contains: location };
  }

  const slots = await prisma.timeSlot.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: {
      _count: { select: { appointments: true } },
    },
  });

  return slots.map((slot) => ({
    ...slot,
    availableCapacity: Math.max(0, slot.capacity - slot.bookedCount),
    isFull: slot.bookedCount >= slot.capacity,
  }));
}

async function bookAppointment({ userId, dossierId, groupBatchId, timeSlotId, location, notes }) {
  return await prisma.$transaction(async (tx) => {
    const slot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
    if (!slot || !slot.isActive) {
      const error = new Error('Selected time slot is not available');
      error.statusCode = 400;
      throw error;
    }

    if (slot.bookedCount >= slot.capacity) {
      const error = new Error('Selected time slot is fully booked');
      error.statusCode = 400;
      throw error;
    }

    const appointment = await tx.appointment.create({
      data: {
        userId,
        timeSlotId,
        dossierId: dossierId || null,
        groupBatchId: groupBatchId || null,
        status: 'CONFIRMED',
        location: location || slot.location,
        notes,
      },
      include: { timeSlot: true, dossier: true, groupBatch: true },
    });

    await tx.timeSlot.update({
      where: { id: timeSlotId },
      data: { bookedCount: { increment: 1 } },
    });

    if (dossierId) {
      await tx.dossier.update({
        where: { id: dossierId },
        data: {
          appointmentDate: slot.date,
          appointmentLocation: slot.location,
          currentStep: 4,
        },
      });
    }

    return appointment;
  });
}

async function rescheduleAppointment({ appointmentId, newTimeSlotId, currentUser }) {
  return await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }

    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
    if (!isStaff && appointment.userId !== currentUser.id) {
      const error = new Error('Access denied to reschedule this appointment');
      error.statusCode = 403;
      throw error;
    }

    const newSlot = await tx.timeSlot.findUnique({ where: { id: newTimeSlotId } });
    if (!newSlot || !newSlot.isActive || newSlot.bookedCount >= newSlot.capacity) {
      const error = new Error('New time slot is not available or fully booked');
      error.statusCode = 400;
      throw error;
    }

    // Decrement old slot count
    await tx.timeSlot.update({
      where: { id: appointment.timeSlotId },
      data: { bookedCount: { decrement: 1 } },
    });

    // Increment new slot count
    await tx.timeSlot.update({
      where: { id: newTimeSlotId },
      data: { bookedCount: { increment: 1 } },
    });

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        timeSlotId: newTimeSlotId,
        status: 'RESCHEDULED',
        location: newSlot.location,
      },
      include: { timeSlot: true, dossier: true, groupBatch: true },
    });

    if (updated.dossierId) {
      await tx.dossier.update({
        where: { id: updated.dossierId },
        data: {
          appointmentDate: newSlot.date,
          appointmentLocation: newSlot.location,
        },
      });
    }

    return updated;
  });
}

async function cancelAppointment({ appointmentId, currentUser }) {
  return await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }

    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
    if (!isStaff && appointment.userId !== currentUser.id) {
      const error = new Error('Access denied to cancel this appointment');
      error.statusCode = 403;
      throw error;
    }

    await tx.timeSlot.update({
      where: { id: appointment.timeSlotId },
      data: { bookedCount: { decrement: 1 } },
    });

    return await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });
  });
}

async function generateManifestPdf({ appointmentId, groupBatchId, currentUser }) {
  let groupBatch = null;
  let appointment = null;

  if (appointmentId) {
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

    if (!appointment) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }
    groupBatch = appointment.groupBatch;
  } else if (groupBatchId) {
    groupBatch = await prisma.groupBatch.findUnique({
      where: { id: groupBatchId },
      include: {
        dossiers: {
          include: { applicants: true },
        },
        appointments: {
          include: { timeSlot: true },
        },
      },
    });
  }

  // Collect all applicants
  let applicants = [];
  if (groupBatch && groupBatch.dossiers) {
    groupBatch.dossiers.forEach((d) => {
      if (d.applicants) applicants.push(...d.applicants);
    });
  } else if (appointment && appointment.dossier && appointment.dossier.applicants) {
    applicants = appointment.dossier.applicants;
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

  const groupName = groupBatch ? groupBatch.name : 'Individual Group Dossier';
  const groupCode = groupBatch ? groupBatch.code : (appointment?.dossier?.dossierNumber || 'N/A');
  const apptDate = appointment?.timeSlot?.date ? new Date(appointment.timeSlot.date).toISOString().split('T')[0] : 'Scheduled';
  const apptTime = appointment?.timeSlot?.startTime || '10:00 AM';
  const apptLocation = appointment?.location || appointment?.timeSlot?.location || 'EuroTech Center';

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
  let y = height - 150;
  page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 550, y: y + 10 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  page.drawText('No.', { x: 45, y, size: 9, font: boldFont });
  page.drawText('Full Name', { x: 80, y, size: 9, font: boldFont });
  page.drawText('Passport No.', { x: 260, y, size: 9, font: boldFont });
  page.drawText('Nationality', { x: 370, y, size: 9, font: boldFont });
  page.drawText('Biometrics', { x: 460, y, size: 9, font: boldFont });
  page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: 550, y: y - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  y -= 20;
  if (applicants.length === 0) {
    page.drawText('No registered passengers found in this slot.', { x: 45, y, size: 9, font });
  } else {
    applicants.forEach((app, idx) => {
      if (y > 60) {
        page.drawText(`${idx + 1}`, { x: 45, y, size: 9, font });
        page.drawText(sanitizeTextForPdf(`${app.firstName} ${app.lastName}`), { x: 80, y, size: 9, font });
        page.drawText(sanitizeTextForPdf(`${app.passportNumber}`), { x: 260, y, size: 9, font });
        page.drawText(sanitizeTextForPdf(`${app.nationality || 'AZ'}`), { x: 370, y, size: 9, font });
        page.drawText('Scheduled', { x: 460, y, size: 9, font: boldFont, color: rgb(0.1, 0.4, 0.6) });
        y -= 18;
      }
    });
  }

  // Footer stamp
  page.drawText('EuroTech Services Official Consular Dispatch - Authorized Biometrics Manifest', {
    x: 40,
    y: 40,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const fileName = `manifest_${groupCode}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
    fileUrl: `/uploads/${fileName}`,
  };
}

module.exports = {
  getAvailableSlots,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  generateManifestPdf,
};
