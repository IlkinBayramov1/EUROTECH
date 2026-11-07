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

async function setGroupAppointment(groupId, userId, { timeSlotId, appointmentDate, appointmentTime, location }) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
    include: {
      dossiers: {
        include: { applicants: true },
      },
      appointments: true,
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

  let timeSlot = null;
  if (timeSlotId) {
    timeSlot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId } });
  }

  const apptDateStr = appointmentDate || (timeSlot ? new Date(timeSlot.date).toISOString().split('T')[0] : '2026-11-20');
  const apptDateTime = new Date(`${apptDateStr}T${appointmentTime || (timeSlot ? timeSlot.startTime : '10:00')}:00.000Z`);

  if (!timeSlot && appointmentDate) {
    const startOfDay = new Date(`${appointmentDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${appointmentDate}T23:59:59.999Z`);

    timeSlot = await prisma.timeSlot.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        startTime: appointmentTime || '10:00',
        isActive: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  if (!timeSlot) {
    timeSlot = await prisma.timeSlot.create({
      data: {
        date: apptDateTime,
        startTime: appointmentTime || '10:00',
        capacity: Math.max(30, groupSize + 10),
        bookedCount: groupSize,
        isActive: true,
        location: location || 'EuroTech Main Center, Port Baku Towers',
      },
    });
  } else {
    // Check capacity for the entire group
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
  }

  const primaryDossier = group.dossiers[0];
  if (primaryDossier) {
    await prisma.dossier.update({
      where: { id: primaryDossier.id },
      data: {
        appointmentDate: apptDateTime,
        appointmentLocation: location || 'EuroTech Main Center, Port Baku Towers',
      },
    });
  }

  if (group.appointments && group.appointments.length > 0) {
    const existing = group.appointments[0];
    return await prisma.appointment.update({
      where: { id: existing.id },
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
        userId,
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
