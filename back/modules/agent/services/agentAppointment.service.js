const prisma = require('../../../config/db');

async function getAgentAppointments(userId) {
  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { groupBatch: { userId } },
        { userId, groupBatchId: { not: null } },
      ],
      status: { not: 'CANCELLED' },
    },
    include: {
      timeSlot: true,
      groupBatch: {
        include: {
          dossiers: {
            include: {
              applicants: {
                include: { documents: true },
              },
            },
          },
        },
      },
      dossier: {
        include: {
          applicants: {
            include: { documents: true },
          },
        },
      },
    },
    orderBy: [
      { timeSlot: { date: 'asc' } },
      { timeSlot: { startTime: 'asc' } },
    ],
  });

  return appointments.map((appt) => {
    let applicants = [];
    if (appt.groupBatch?.dossiers) {
      appt.groupBatch.dossiers.forEach((d) => {
        if (d.applicants) applicants.push(...d.applicants);
      });
    }
    if (applicants.length === 0 && appt.dossier?.applicants) {
      applicants.push(...appt.dossier.applicants);
    }

    const totalApplicants = applicants.length;
    const verifiedApplicants = applicants.filter((a) =>
      a.documents?.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED')
    ).length;

    const group = appt.groupBatch;
    return {
      id: appt.id,
      timeSlotId: appt.timeSlotId,
      status: appt.status,
      location: appt.location || appt.timeSlot?.location || 'EuroTech Main Center, Port Baku Towers',
      notes: appt.notes,
      timeSlot: {
        id: appt.timeSlot?.id,
        date: appt.timeSlot?.date,
        startTime: appt.timeSlot?.startTime,
        capacity: appt.timeSlot?.capacity || 10,
        bookedCount: appt.timeSlot?.bookedCount || 0,
        location: appt.timeSlot?.location,
      },
      groupInfo: {
        id: group?.code || 'GROUP',
        dbId: group?.id,
        name: group?.name || 'Group Delegation',
        destination: group?.destination || '',
        package: group?.dossiers?.[0]?.applicants?.[0]?.formDataJson?.package || 'Standard',
        passportStatus: verifiedApplicants === totalApplicants && totalApplicants > 0 ? 'Documents Ready' : 'Pending Action',
        size: totalApplicants,
        applicants: applicants.map((a) => ({
          id: a.id,
          name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Applicant',
          passport: a.passportNumber || '—',
          docsStatus: a.documents?.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED') ? 'Verified' : 'Pending',
        })),
      },
    };
  });
}

function parseSafeAppointmentDateTime(dateStr, timeStr) {
  const baseDateStr = dateStr || new Date().toISOString().split('T')[0];
  const pureDate = String(baseDateStr).split('T')[0].trim();

  let hours = 10;
  let minutes = 0;

  if (timeStr) {
    const rawTime = String(timeStr).trim();
    const match = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const meridiem = match[3] ? match[3].toUpperCase() : null;

      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;

      hours = h;
      minutes = m;
    }
  }

  const d = new Date(`${pureDate}T00:00:00.000Z`);
  if (isNaN(d.getTime())) {
    const now = new Date();
    now.setUTCHours(hours, minutes, 0, 0);
    return now;
  }
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function getTimeVariants(timeStr) {
  if (!timeStr) return ['10:00', '10:00 AM'];
  const raw = String(timeStr).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return [raw];

  let h = parseInt(match[1], 10);
  const m = match[2];
  const mer = match[3] ? match[3].toUpperCase() : null;

  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;

  const h24 = String(h).padStart(2, '0');
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12Pad = String(h12).padStart(2, '0');

  return Array.from(new Set([
    `${h24}:${m}`,
    `${h12Pad}:${m} ${ampm}`,
    `${h12}:${m} ${ampm}`,
    `${h24}:${m} ${ampm}`,
    raw
  ]));
}

async function setGroupAppointment(groupId, userId, { timeSlotId, appointmentDate, appointmentTime, location }, currentUser = null) {
  const isStaff = currentUser && ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const group = await prisma.groupBatch.findFirst({
    where: isStaff ? { id: groupId } : { id: groupId, userId },
    include: {
      dossiers: {
        include: { applicants: true },
      },
      appointments: {
        include: { timeSlot: true },
      },
    },
  });
  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  // Calculate actual group size across all dossiers & applicants
  let groupSize = 0;
  group.dossiers.forEach((d) => {
    groupSize += (d.applicants?.length || 1);
  });
  if (groupSize === 0) groupSize = 1;

  const existingAppointment = group.appointments && group.appointments.length > 0 ? group.appointments[0] : null;
  const existingSlotId = existingAppointment?.timeSlotId || null;
  const existingGroupSize = existingAppointment?.groupSize || 0;

  let timeSlot = null;
  if (timeSlotId) {
    timeSlot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId } });
  }

  const apptDateStr = appointmentDate || (timeSlot ? new Date(timeSlot.date).toISOString().split('T')[0] : (existingAppointment?.timeSlot?.date ? new Date(existingAppointment.timeSlot.date).toISOString().split('T')[0] : '2026-11-20'));
  const apptTimeStr = appointmentTime || (timeSlot ? timeSlot.startTime : (existingAppointment?.timeSlot?.startTime || '10:00'));
  const apptDateTime = parseSafeAppointmentDateTime(apptDateStr, apptTimeStr);

  if (!timeSlot && appointmentDate) {
    const startOfDay = new Date(`${appointmentDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${appointmentDate}T23:59:59.999Z`);
    const timeVariants = getTimeVariants(apptTimeStr);

    timeSlot = await prisma.timeSlot.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        startTime: { in: timeVariants },
        isActive: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  if (!timeSlot) {
    timeSlot = await prisma.timeSlot.create({
      data: {
        date: apptDateTime,
        startTime: apptTimeStr || '10:00',
        capacity: Math.max(30, groupSize + 10),
        bookedCount: groupSize,
        isActive: true,
        location: location || 'EuroTech Main Center, Port Baku Towers',
      },
    });

    // Release old slot if previously booked on a different slot
    if (existingSlotId) {
      try {
        const oldSlot = await prisma.timeSlot.findUnique({ where: { id: existingSlotId } });
        if (oldSlot) {
          const decr = Math.min(oldSlot.bookedCount, existingGroupSize);
          if (decr > 0) {
            await prisma.timeSlot.update({
              where: { id: existingSlotId },
              data: { bookedCount: { decrement: decr } },
            });
          }
        }
      } catch (err) {
        console.warn('Could not release previous slot:', err.message);
      }
    }
  } else {
    // Check capacity for the group
    if (existingSlotId && existingSlotId === timeSlot.id) {
      // Re-booking or updating details on the same slot
      const delta = groupSize - existingGroupSize;
      if (delta > 0) {
        const remaining = timeSlot.capacity - timeSlot.bookedCount;
        if (remaining < delta) {
          const error = new Error(`Selected time slot has insufficient capacity (Available: ${remaining}, Additional needed: ${delta})`);
          error.statusCode = 400;
          throw error;
        }
        await prisma.timeSlot.update({
          where: { id: timeSlot.id },
          data: { bookedCount: { increment: delta } },
        });
      } else if (delta < 0) {
        await prisma.timeSlot.update({
          where: { id: timeSlot.id },
          data: { bookedCount: { decrement: Math.abs(delta) } },
        });
      }
    } else {
      // New or different slot selected
      const remaining = timeSlot.capacity - timeSlot.bookedCount;
      if (remaining < groupSize) {
        const error = new Error(`Selected time slot has insufficient capacity (Available: ${remaining}, Group size: ${groupSize})`);
        error.statusCode = 400;
        throw error;
      }

      await prisma.timeSlot.update({
        where: { id: timeSlot.id },
        data: { bookedCount: { increment: groupSize } },
      });

      // Release old slot if previously booked on another slot
      if (existingSlotId) {
        try {
          const oldSlot = await prisma.timeSlot.findUnique({ where: { id: existingSlotId } });
          if (oldSlot) {
            const decr = Math.min(oldSlot.bookedCount, existingGroupSize);
            if (decr > 0) {
              await prisma.timeSlot.update({
                where: { id: existingSlotId },
                data: { bookedCount: { decrement: decr } },
              });
            }
          }
        } catch (err) {
          console.warn('Could not release previous slot:', err.message);
        }
      }
    }
  }

  // Update appointment date & location on all dossiers belonging to this group
  if (group.dossiers && group.dossiers.length > 0) {
    await prisma.dossier.updateMany({
      where: { groupBatchId: group.id },
      data: {
        appointmentDate: apptDateTime,
        appointmentLocation: location || 'EuroTech Main Center, Port Baku Towers',
      },
    });
  }

  const primaryDossier = group.dossiers?.[0] || null;

  if (existingAppointment) {
    return await prisma.appointment.update({
      where: { id: existingAppointment.id },
      data: {
        timeSlotId: timeSlot.id,
        groupSize,
        location: location || 'EuroTech Main Center, Port Baku Towers',
        status: 'CONFIRMED',
        notes: `Group Appointment: ${group.name} (${group.code}) - ${groupSize} Pax`,
      },
      include: { timeSlot: true },
    });
  } else {
    return await prisma.appointment.create({
      data: {
        timeSlotId: timeSlot.id,
        userId: group.userId || userId,
        dossierId: primaryDossier?.id || null,
        groupBatchId: group.id,
        groupSize,
        status: 'CONFIRMED',
        location: location || 'EuroTech Main Center, Port Baku Towers',
        notes: `Group Appointment: ${group.name} (${group.code}) - ${groupSize} Pax`,
      },
      include: { timeSlot: true },
    });
  }
}

module.exports = {
  getAgentAppointments,
  setGroupAppointment,
};
