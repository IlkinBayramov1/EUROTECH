const prisma = require('../../../config/db');
const { nextBookingCode } = require('../../vcms/services/codeGenerator.service');

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

async function getAvailableSlots({ date, location, countryId, visaTypeId, providerId, groupSize = 1 } = {}) {
  // Ensure rolling slots exist for current and future days
  await ensureRollingTimeSlots(21);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const where = {
    isActive: true,
    slotStatus: 'AVAILABLE',
    OR: [
      { scheduleId: null },
      { schedule: { status: 'PUBLISHED' } },
    ],
  };

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
  if (countryId) {
    where.countryId = countryId;
  }
  if (providerId) {
    where.providerId = providerId;
  }
  if (visaTypeId) {
    where.AND = [...(where.AND || []), { OR: [{ visaTypeId }, { visaTypeId: null }] }];
  }

  const slots = await prisma.timeSlot.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: {
      provider: true,
      visaType: true,
      _count: { select: { appointments: true } },
    },
  });

  const minSeats = Math.max(1, Number(groupSize || 1));

  // Filter out any slot whose scheduled hour/minute has already passed or lacks capacity
  const activeSlots = slots.filter((slot) => {
    const slotFullDateTime = parseSlotDateTime(slot.date, slot.startTime);
    return slotFullDateTime > now && slot.capacity - slot.bookedCount >= minSeats;
  });

  return activeSlots.map((slot) => ({
    ...slot,
    availableCapacity: Math.max(0, slot.capacity - slot.bookedCount),
    isFull: slot.bookedCount >= slot.capacity,
  }));
}

async function bookAppointment({ userId, dossierId, groupBatchId, timeSlotId, location, notes, groupSize = 1 }) {
  return await prisma.$transaction(async (tx) => {
    const slot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
    if (!slot || !slot.isActive || ['DRAFT', 'BLOCKED', 'CLOSED'].includes(slot.slotStatus)) {
      const error = new Error('Selected time slot is not available');
      error.statusCode = 400;
      throw error;
    }

    const neededSeats = Math.max(1, Number(groupSize || 1));
    if (slot.bookedCount + neededSeats > slot.capacity) {
      const error = new Error('Selected time slot is fully booked');
      error.statusCode = 400;
      throw error;
    }

    const bookingCode = await nextBookingCode(tx);

    const appointment = await tx.appointment.create({
      data: {
        bookingCode,
        userId,
        timeSlotId,
        dossierId: dossierId || null,
        groupBatchId: groupBatchId || null,
        providerId: slot.providerId || null,
        visaTypeId: slot.visaTypeId || null,
        groupSize: neededSeats,
        status: 'CONFIRMED',
        location: location || slot.location,
        notes,
      },
      include: { timeSlot: true, dossier: true, groupBatch: true },
    });

    const newBookedCount = slot.bookedCount + neededSeats;
    await tx.timeSlot.update({
      where: { id: timeSlotId },
      data: {
        bookedCount: newBookedCount,
        ...(newBookedCount >= slot.capacity ? { slotStatus: 'FULL' } : {}),
      },
    });

    await tx.appointmentNotification.create({
      data: {
        appointmentId: appointment.id,
        userId,
        type: 'BOOKING_CONFIRMED',
        channel: 'IN_APP',
        title: `Appointment Confirmed (${bookingCode})`,
        message: `Your consular appointment (${bookingCode}) at ${location || slot.location} for ${slot.slotDate || slot.date.toISOString().slice(0, 10)} ${slot.startTime} is confirmed.`,
        newSlotIso: `${slot.slotDate || slot.date.toISOString().slice(0, 10)} ${slot.startTime}`,
      },
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

    const neededSeats = Math.max(1, Number(appointment.groupSize || 1));
    const newSlot = await tx.timeSlot.findUnique({ where: { id: newTimeSlotId } });
    if (
      !newSlot ||
      !newSlot.isActive ||
      ['DRAFT', 'BLOCKED', 'CLOSED'].includes(newSlot.slotStatus) ||
      newSlot.bookedCount + neededSeats > newSlot.capacity
    ) {
      const error = new Error('New time slot is not available or fully booked');
      error.statusCode = 400;
      throw error;
    }

    // Decrement old slot count
    if (appointment.timeSlot) {
      const dec = Math.min(appointment.timeSlot.bookedCount, neededSeats);
      if (dec > 0) {
        await tx.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: {
            bookedCount: { decrement: dec },
            ...(appointment.timeSlot.slotStatus === 'FULL' ? { slotStatus: 'AVAILABLE' } : {}),
          },
        });
      }
    }

    // Increment new slot count
    const nextBooked = newSlot.bookedCount + neededSeats;
    await tx.timeSlot.update({
      where: { id: newTimeSlotId },
      data: {
        bookedCount: nextBooked,
        ...(nextBooked >= newSlot.capacity ? { slotStatus: 'FULL' } : {}),
      },
    });

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        rescheduledFromSlotId: appointment.timeSlotId,
        timeSlotId: newTimeSlotId,
        providerId: newSlot.providerId || appointment.providerId,
        visaTypeId: newSlot.visaTypeId || appointment.visaTypeId,
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

    const dec = Math.min(appointment.timeSlot?.bookedCount || 0, Math.max(1, Number(appointment.groupSize || 1)));
    if (dec > 0) {
      await tx.timeSlot.update({
        where: { id: appointment.timeSlotId },
        data: {
          bookedCount: { decrement: dec },
          ...(appointment.timeSlot?.slotStatus === 'FULL' ? { slotStatus: 'AVAILABLE' } : {}),
        },
      });
    }

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
