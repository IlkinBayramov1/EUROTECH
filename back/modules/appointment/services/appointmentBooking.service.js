const prisma = require('../../../config/db');

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

module.exports = {
  parseSlotDateTime,
  ensureRollingTimeSlots,
  getAvailableSlots,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
};
