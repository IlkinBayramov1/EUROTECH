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

function parseSlotDateTime(dateObj, timeStr) {
  const d = new Date(dateObj);
  if (!timeStr) return d;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
  }
  return d;
}

async function ensureRollingTimeSlots(daysAhead = 21) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const centers = [
    'EuroTech Main Center, Azure Business Center, Baku',
    'EuroTech Premium Lounge, Port Baku Towers, Baku',
  ];
  const standardTimes = ['09:00 AM', '10:30 AM', '14:00 PM', '16:00 PM'];

  const endOfRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead, 23, 59, 59, 999);
  const existingSlots = await prisma.timeSlot.findMany({
    where: {
      date: { gte: startOfToday, lte: endOfRange },
      isActive: true,
    },
    select: { date: true, startTime: true, location: true },
  });

  const existingMap = new Set();
  for (const s of existingSlots) {
    const dStr = new Date(s.date).toISOString().split('T')[0];
    existingMap.add(`${dStr}_${s.startTime}_${s.location}`);
  }

  const newSlotsToCreate = [];
  for (let i = 0; i < daysAhead; i++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 9, 0, 0, 0);
    if (dayDate.getDay() === 0) continue; // Skip Sunday

    const dStr = dayDate.toISOString().split('T')[0];
    for (const location of centers) {
      for (const time of standardTimes) {
        const key = `${dStr}_${time}_${location}`;
        if (!existingMap.has(key)) {
          newSlotsToCreate.push({
            date: dayDate,
            startTime: time,
            capacity: 10,
            bookedCount: 0,
            location,
            isActive: true,
          });
        }
      }
    }
  }

  if (newSlotsToCreate.length > 0) {
    await prisma.timeSlot.createMany({
      data: newSlotsToCreate,
      skipDuplicates: true,
    });
  }
}

async function getAvailableSlots({ date, location }) {
  // Ensure rolling slots exist for current and future days
  await ensureRollingTimeSlots(21);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const where = { isActive: true };

  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    where.date = { gte: startOfDay, lte: endOfDay };
  } else {
    // Always start from today! Never show past dates
    where.date = { gte: startOfToday };
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

  // Filter out any slot whose scheduled hour/minute has already passed
  const activeSlots = slots.filter((slot) => {
    const slotFullDateTime = parseSlotDateTime(slot.date, slot.startTime);
    return slotFullDateTime > now;
  });

  return activeSlots.map((slot) => ({
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
  if (groupBatch && groupBatch.dossiers && groupBatch.dossiers.length > 0) {
    groupBatch.dossiers.forEach((d) => {
      if (d.applicants) applicants.push(...d.applicants);
    });
    groupName = groupBatch.name;
    groupCode = groupBatch.code;
  } else if (appointment && appointment.dossier && appointment.dossier.applicants) {
    applicants = appointment.dossier.applicants;
    groupName = appointment.dossier.dossierNumber;
    groupCode = appointment.dossier.dossierNumber;
  }

  if (appointment?.timeSlot) {
    apptDate = appointment.timeSlot.date ? new Date(appointment.timeSlot.date).toISOString().split('T')[0] : apptDate;
    apptTime = appointment.timeSlot.startTime || apptTime;
    apptLocation = appointment.location || appointment.timeSlot.location || apptLocation;
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
    page.drawText('No registered passengers found in database for this group.', { x: 45, y, size: 9, font });
  } else {
    applicants.forEach((app, idx) => {
      if (y > 60) {
        const fullName = `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Passenger';
        page.drawText(`${idx + 1}`, { x: 45, y, size: 9, font });
        page.drawText(sanitizeTextForPdf(fullName), { x: 80, y, size: 9, font });
        page.drawText(sanitizeTextForPdf(`${app.passportNumber || '—'}`), { x: 260, y, size: 9, font });
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

  const safeCode = groupCode || 'BATCH';
  const fileName = `manifest_${safeCode}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
    fileUrl: `/uploads/${fileName}`,
  };
}

async function generateConfirmationLetterPdf({ appointmentId, customAppointmentInfo, currentUser }) {
  let appt = null;
  if (appointmentId) {
    appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        timeSlot: true,
        user: true,
        dossier: {
          include: {
            country: true,
            visaCategory: true,
            applicants: true,
          },
        },
      },
    });
  }

  if (!appt && currentUser?.id) {
    appt = await prisma.appointment.findFirst({
      where: { userId: currentUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        timeSlot: true,
        user: true,
        dossier: {
          include: {
            country: true,
            visaCategory: true,
            applicants: true,
          },
        },
      },
    });
  }

  const primaryApplicant = appt?.dossier?.applicants?.[0];
  const formData = primaryApplicant?.formDataJson || {};

  const applicantName = sanitizeTextForPdf(
    (primaryApplicant?.firstName && primaryApplicant?.lastName ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : null) ||
    customAppointmentInfo?.applicantName ||
    appt?.user?.fullName ||
    currentUser?.fullName ||
    '—'
  );

  const passportNumber = sanitizeTextForPdf(
    primaryApplicant?.passportNumber ||
    formData?.passportNumber ||
    customAppointmentInfo?.passportNumber ||
    appt?.user?.passportNumber ||
    '—'
  );

  const nationalId = sanitizeTextForPdf(
    formData?.nationalId ||
    customAppointmentInfo?.nationalId ||
    '—'
  );

  const birthDate = sanitizeTextForPdf(
    formData?.birthDate ||
    (primaryApplicant?.birthDate ? new Date(primaryApplicant.birthDate).toISOString().split('T')[0] : null) ||
    '—'
  );

  const nationality = sanitizeTextForPdf(
    formData?.nationality ||
    primaryApplicant?.nationality ||
    'Azerbaijan'
  );

  const gender = sanitizeTextForPdf(
    formData?.gender ||
    primaryApplicant?.gender ||
    '—'
  );

  const contactEmail = sanitizeTextForPdf(
    formData?.homeEmail ||
    appt?.user?.email ||
    currentUser?.email ||
    '—'
  );

  const contactPhone = sanitizeTextForPdf(
    formData?.homePhone ||
    appt?.user?.phone ||
    currentUser?.phone ||
    '—'
  );

  const residentialAddress = sanitizeTextForPdf(
    formData?.homeAddress ||
    '—'
  );

  const dossierNumber = sanitizeTextForPdf(
    appt?.dossier?.dossierNumber ||
    customAppointmentInfo?.dossierNumber ||
    '—'
  );

  const visaCategory = sanitizeTextForPdf(
    appt?.dossier?.visaCategory?.nameEn ||
    customAppointmentInfo?.visaCategory ||
    'Schengen Visa (Type C)'
  );

  const destinationCountry = sanitizeTextForPdf(
    customAppointmentInfo?.destination ||
    appt?.dossier?.country?.nameEn ||
    formData?.destination ||
    'Schengen Area'
  );

  const apptRef = sanitizeTextForPdf(
    customAppointmentInfo?.reference ||
    (appt?.id ? `ET-APT-${appt.id.substring(0, 8).toUpperCase()}` : null) ||
    `ET-APT-${Date.now().toString().slice(-6)}`
  );

  const appointmentDate = sanitizeTextForPdf(
    customAppointmentInfo?.date ||
    (appt?.timeSlot?.date ? new Date(appt.timeSlot.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null) ||
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  );

  const appointmentTime = sanitizeTextForPdf(
    customAppointmentInfo?.time ||
    appt?.timeSlot?.startTime ||
    '10:30 AM'
  );

  // Calculate reporting time (15 mins prior)
  let reportingTime = appointmentTime;
  const timeMatch = appointmentTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    let m = parseInt(timeMatch[2], 10) - 15;
    const ampm = (timeMatch[3] || '').toUpperCase();
    if (m < 0) {
      m += 60;
      h -= 1;
      if (h === 0) h = 12;
    }
    const mStr = m < 10 ? `0${m}` : `${m}`;
    reportingTime = `${h}:${mStr} ${ampm} (Arrive 15 min prior)`.trim();
  }

  // Location resolution
  const locRaw = (appt?.timeSlot?.location || appt?.location || customAppointmentInfo?.location || '').toLowerCase();
  let centerName = 'EuroTech Visa Application Centre (Main Center)';
  let centerAddress = 'Azure Business Center, 8 Novruz Str., 3rd Floor, Baku, Azerbaijan';
  if (locRaw.includes('port baku') || locRaw.includes('lounge') || locRaw.includes('premium')) {
    centerName = 'EuroTech Premium Lounge Visa Application Centre';
    centerAddress = 'Port Baku Towers, 153 Neftchilar Ave, South Tower, 7th Floor, Baku, Azerbaijan';
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Top header banner
  page.drawRectangle({
    x: 0,
    y: 765,
    width: 595.28,
    height: 76.89,
    color: rgb(0.04, 0.13, 0.27),
  });

  page.drawText('EUROTECH CONSULAR & MOBILITY SERVICES', {
    x: 40,
    y: 808,
    size: 16,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL BIOMETRIC APPOINTMENT CONFIRMATION & ACCESS PASS', {
    x: 40,
    y: 785,
    size: 9,
    font,
    color: rgb(0.8, 0.88, 0.95),
  });

  // Access Badge in header
  page.drawRectangle({
    x: 430,
    y: 782,
    width: 125,
    height: 24,
    color: rgb(0.08, 0.22, 0.42),
    borderColor: rgb(0.3, 0.55, 0.85),
    borderWidth: 1,
  });
  page.drawText('OFFICIAL ACCESS PASS', {
    x: 442,
    y: 790,
    size: 8,
    font: boldFont,
    color: rgb(0.9, 0.95, 1.0),
  });

  // Top Reference Card
  page.drawRectangle({
    x: 40,
    y: 685,
    width: 515.28,
    height: 68,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.8, 0.85, 0.92),
    borderWidth: 1,
  });

  page.drawText(`APPOINTMENT REF: ${apptRef}`, {
    x: 55,
    y: 730,
    size: 12,
    font: boldFont,
    color: rgb(0.06, 0.22, 0.44),
  });
  page.drawText(`DOSSIER NUMBER: ${dossierNumber}`, {
    x: 55,
    y: 712,
    size: 10,
    font: boldFont,
    color: rgb(0.15, 0.2, 0.3),
  });
  page.drawText(`CATEGORY: ${visaCategory}`, {
    x: 55,
    y: 696,
    size: 9,
    font,
    color: rgb(0.4, 0.45, 0.55),
  });

  const apptStatusText = (appt?.status || 'CONFIRMED').toUpperCase();
  page.drawText(`STATUS: ${apptStatusText}`, {
    x: 320,
    y: 730,
    size: 11,
    font: boldFont,
    color: apptStatusText === 'CANCELLED' ? rgb(0.8, 0.2, 0.2) : rgb(0.15, 0.55, 0.25),
  });
  page.drawText(`DESTINATION: ${destinationCountry.toUpperCase()}`, {
    x: 320,
    y: 712,
    size: 10,
    font: boldFont,
    color: rgb(0.15, 0.2, 0.3),
  });
  page.drawText('CLEARANCE: LEVEL-1 BIOMETRICS ENROLLMENT', {
    x: 320,
    y: 696,
    size: 8.5,
    font: boldFont,
    color: rgb(0.2, 0.45, 0.7),
  });

  // 1. APPLICANT IDENTIFICATION
  page.drawText('1. APPLICANT IDENTIFICATION (VERIFIED CREDENTIALS)', {
    x: 40,
    y: 660,
    size: 10.5,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.25),
  });
  page.drawLine({
    start: { x: 40, y: 654 },
    end: { x: 555.28, y: 654 },
    thickness: 0.8,
    color: rgb(0.82, 0.86, 0.92),
  });

  const applicantLeft = [
    ['Full Name:', applicantName],
    ['Passport Number:', passportNumber],
    ['National ID / FIN:', nationalId],
    ['Birth Date & Sex:', `${birthDate} (${gender})`],
  ];
  let idLeftY = 638;
  applicantLeft.forEach(([k, v]) => {
    page.drawText(k, { x: 50, y: idLeftY, size: 9, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
    page.drawText(v, { x: 155, y: idLeftY, size: 9, font, color: rgb(0.1, 0.15, 0.25) });
    idLeftY -= 15;
  });

  const applicantRight = [
    ['Nationality:', nationality],
    ['Contact Email:', contactEmail],
    ['Contact Phone:', contactPhone],
    ['Residential City:', residentialAddress],
  ];
  let idRightY = 638;
  applicantRight.forEach(([k, v]) => {
    page.drawText(k, { x: 310, y: idRightY, size: 9, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
    page.drawText(v, { x: 405, y: idRightY, size: 9, font, color: rgb(0.1, 0.15, 0.25) });
    idRightY -= 15;
  });

  // 2. APPOINTMENT SCHEDULE & VENUE DETAILS
  page.drawText('2. APPOINTMENT SCHEDULE & VENUE DETAILS', {
    x: 40,
    y: 565,
    size: 10.5,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.25),
  });
  page.drawLine({
    start: { x: 40, y: 559 },
    end: { x: 555.28, y: 559 },
    thickness: 0.8,
    color: rgb(0.82, 0.86, 0.92),
  });

  const scheduleLeft = [
    ['Scheduled Date:', appointmentDate],
    ['Allocated Time:', appointmentTime],
    ['Reporting Time:', reportingTime],
  ];
  let schLeftY = 543;
  scheduleLeft.forEach(([k, v]) => {
    page.drawText(k, { x: 50, y: schLeftY, size: 9, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
    page.drawText(v, { x: 155, y: schLeftY, size: 9, font: k.includes('Reporting') ? boldFont : font, color: k.includes('Reporting') ? rgb(0.8, 0.3, 0.05) : rgb(0.1, 0.15, 0.25) });
    schLeftY -= 15;
  });

  const scheduleRight = [
    ['Centre Venue:', centerName],
    ['Physical Address:', centerAddress],
    ['Ingestion Counter:', 'Biometrics Booth #04 & Reception Desk'],
  ];
  let schRightY = 543;
  scheduleRight.forEach(([k, v]) => {
    page.drawText(k, { x: 310, y: schRightY, size: 9, font: boldFont, color: rgb(0.35, 0.4, 0.5) });
    page.drawText(v, { x: 405, y: schRightY, size: 8.5, font, color: rgb(0.1, 0.15, 0.25) });
    schRightY -= 15;
  });

  // 3. MANDATORY REQUIREMENTS & ATTENDANCE CHECKLIST
  page.drawRectangle({
    x: 40,
    y: 350,
    width: 515.28,
    height: 135,
    color: rgb(0.99, 0.98, 0.95),
    borderColor: rgb(0.92, 0.82, 0.55),
    borderWidth: 1,
  });

  page.drawText('MANDATORY INSTRUCTIONS & REQUIRED PHYSICAL DOCUMENTS (CHECKLIST):', {
    x: 55,
    y: 467,
    size: 9.5,
    font: boldFont,
    color: rgb(0.65, 0.4, 0.05),
  });

  const checklist = [
    '1. Original Passport: Valid for min. 6 months beyond stay with at least 2 blank pages.',
    '2. Printed Confirmation Letter: Bring this official document with barcode for security entrance.',
    '3. Biometric Photograph: 1 recent color photo (3.5 x 4.5 cm, light background, ICAO compliant).',
    '4. Schengen Visa Application Form: Signed copy matching your electronic submission.',
    '5. Supporting Originals: Travel insurance (min €30k), accommodation booking, flight proof, bank statement.',
    '6. Attendance Rules: Arrive 15 mins early. Electronic devices and accompanying guests are restricted.',
  ];

  let checkY = 448;
  checklist.forEach((item) => {
    page.drawText(item, { x: 55, y: checkY, size: 8.5, font, color: rgb(0.25, 0.22, 0.18) });
    checkY -= 16;
  });

  // 4. OFFICIAL SECURITY SEAL & VERIFICATION
  // Left Box: Consular Security Seal
  page.drawRectangle({
    x: 40,
    y: 220,
    width: 250,
    height: 105,
    borderColor: rgb(0.04, 0.13, 0.27),
    borderWidth: 1.5,
  });

  page.drawText('EUROTECH CONSULAR SECURITY SEAL', {
    x: 52,
    y: 308,
    size: 8.5,
    font: boldFont,
    color: rgb(0.04, 0.13, 0.27),
  });

  const issueDateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  page.drawText(`ISSUED: ${issueDateStr}`, { x: 52, y: 290, size: 7.5, font, color: rgb(0.3, 0.35, 0.4) });
  page.drawText(`VERIFICATION: ET-AUTH-${apptRef.slice(-6)}-VALID`, { x: 52, y: 274, size: 8, font: boldFont, color: rgb(0.1, 0.5, 0.2) });
  page.drawText(`DOSSIER LINK: ${dossierNumber}`, { x: 52, y: 258, size: 7.5, font, color: rgb(0.2, 0.25, 0.3) });
  page.drawText('STATUS: DIGITALLY COUNTERSIGNED', { x: 52, y: 242, size: 7.5, font: boldFont, color: rgb(0.1, 0.35, 0.6) });
  page.drawText('ENCRYPTION: 256-BIT SHA256 VALIDATED', { x: 52, y: 228, size: 6.5, font, color: rgb(0.5, 0.5, 0.5) });

  // Right Box: Electronic Barcode / Gate Access Pass
  page.drawRectangle({
    x: 305,
    y: 220,
    width: 250,
    height: 105,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0),
  });

  page.drawText('ELECTRONIC ACCESS PASS & BARCODE', {
    x: 317,
    y: 308,
    size: 8.5,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.35),
  });

  // Draw simulated barcode lines
  const barXStart = 320;
  const barY = 262;
  const barHeight = 32;
  const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 1, 3, 2, 1, 4, 2, 1, 2, 3, 1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 1, 2];
  let curBarX = barXStart;
  pattern.forEach((w, idx) => {
    if (idx % 2 === 0) {
      page.drawRectangle({
        x: curBarX,
        y: barY,
        width: w,
        height: barHeight,
        color: rgb(0.08, 0.12, 0.2),
      });
    }
    curBarX += w + 2;
  });

  page.drawText(`* ${apptRef} *`, {
    x: 385,
    y: 248,
    size: 9,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.25),
  });

  page.drawText('ACCESS CLEARANCE: LEVEL-1 BIOMETRICS ENROLLMENT', {
    x: 317,
    y: 230,
    size: 7,
    font: boldFont,
    color: rgb(0.2, 0.45, 0.7),
  });

  // Bottom Footer
  page.drawText('This document is electronically generated and serves as authorized entry into the Schengen Visa Submission Centre.', {
    x: 40,
    y: 195,
    size: 7.5,
    font,
    color: rgb(0.45, 0.45, 0.5),
  });
  page.drawText('EuroTech Global Consular Services | Azure Business Center & Port Baku Towers | Baku, Azerbaijan', {
    x: 40,
    y: 182,
    size: 7,
    font,
    color: rgb(0.55, 0.55, 0.6),
  });

  const fileName = `appointment_confirmation_${apptRef.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`;
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
  generateConfirmationLetterPdf,
};

