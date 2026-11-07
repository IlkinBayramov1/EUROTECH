const prisma = require('../../../config/db');

async function getDossierTracking(dossierIdOrRef, requestingUser = null) {
  if (!dossierIdOrRef) {
    throw new Error('Dossier ID or reference number is required');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dossierIdOrRef);
  const whereClause = isUuid
    ? { id: dossierIdOrRef }
    : { dossierNumber: { equals: dossierIdOrRef.trim() } };

  const dossier = await prisma.dossier.findFirst({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      country: true,
      visaCategory: true,
      applicants: {
        orderBy: { id: 'asc' },
      },
      documents: true,
      appointments: {
        include: { timeSlot: true },
        orderBy: { createdAt: 'desc' },
      },
      services: {
        where: { status: 'ACTIVE' },
      },
      transactions: {
        where: { status: 'PAID' },
        orderBy: { createdAt: 'desc' },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  let currentStage = 1;
  let stageTitle = 'File Preparation';
  let stageDescription = 'Dossier compilation and document verification underway';

  const hasAppointment = dossier.appointments && dossier.appointments.length > 0;
  const activeAppointment = dossier.appointments?.find((a) => a.status === 'CONFIRMED' && a.timeSlot?.date && new Date(a.timeSlot.date) >= new Date('2026-09-21'))
    || dossier.appointments?.find((a) => a.status === 'CONFIRMED')
    || (hasAppointment ? dossier.appointments[0] : null);

  if (dossier.status === 'APPROVED' || dossier.status === 'REJECTED') {
    currentStage = 5;
    stageTitle = dossier.status === 'APPROVED' ? 'Visa Approved & Issued' : 'Consular Decision Notice Issued';
    stageDescription = dossier.status === 'APPROVED'
      ? 'Your Schengen visa has been granted. Passport ready for collection or courier dispatch.'
      : 'Consular processing concluded with official notification letter.';
  } else if (dossier.status === 'SUBMITTED_TO_CONSULATE') {
    currentStage = 4;
    stageTitle = 'Consular Review';
    stageDescription = `Dossier submitted to the Consulate General of ${dossier.country?.nameEn || 'Schengen Member State'}. Diplomatic evaluation in progress.`;
  } else if (activeAppointment && activeAppointment.status === 'CONFIRMED') {
    const apptDate = activeAppointment.timeSlot?.date
      ? new Date(activeAppointment.timeSlot.date)
      : (dossier.appointmentDate ? new Date(dossier.appointmentDate) : null);
    const isPast = apptDate && apptDate < new Date();
    const apptLoc = activeAppointment.location || activeAppointment.timeSlot?.location || dossier.appointmentLocation || 'EuroTech Center';
    if (isPast) {
      currentStage = 3;
      stageTitle = 'Submitted at VAC';
      stageDescription = 'Biometric submission completed at EuroTech Visa Center. Physical dossier forwarded.';
    } else {
      currentStage = 2;
      stageTitle = 'Ready for Appointment';
      stageDescription = `Appointment confirmed for ${activeAppointment.timeSlot?.startTime || ''} at ${apptLoc}.`;
    }
  } else if (dossier.status === 'UNDER_REVIEW') {
    currentStage = 2;
    stageTitle = 'Ready for Appointment';
    stageDescription = 'Dossier compiled. Awaiting appointment booking and biometrics.';
  }

  const verifiedDocs = dossier.documents.filter((d) => d.status === 'VERIFIED');
  const totalDocs = dossier.documents.length;

  const events = [];

  events.push({
    id: `evt-reg-${dossier.id}`,
    title: 'Dossier Initialized & Registered',
    category: 'REGISTRATION',
    status: 'COMPLETED',
    date: dossier.createdAt,
    description: `Application dossier ${dossier.dossierNumber} was officially registered in the EuroTech consular network.`,
    badge: dossier.dossierNumber,
  });

  events.push({
    id: `evt-doc-${dossier.id}`,
    title: 'Documentation & Dossier Compilation',
    category: 'DOCUMENTS',
    status: dossier.currentStep >= 3 || totalDocs > 0 ? 'COMPLETED' : 'IN_PROGRESS',
    date: dossier.updatedAt,
    description: totalDocs > 0
      ? `${totalDocs} document(s) uploaded (${verifiedDocs.length} verified by compliance officers).`
      : 'Applicant documents undergoing compliance check and consistency verification.',
    badge: `${verifiedDocs.length}/${totalDocs} Verified`,
  });

  if (activeAppointment) {
    const apptDate = activeAppointment.timeSlot?.date
      ? new Date(activeAppointment.timeSlot.date)
      : (dossier.appointmentDate ? new Date(dossier.appointmentDate) : null);
    const apptDateStr = apptDate
      ? apptDate.toISOString().split('T')[0]
      : '';
    const timeStr = activeAppointment.timeSlot?.startTime || 'Confirmed Slot';
    const apptLoc = activeAppointment.location || activeAppointment.timeSlot?.location || dossier.appointmentLocation || 'EuroTech Visa Submission Center';
    const apptRef = activeAppointment.id ? `ET-APT-${activeAppointment.id.substring(0, 8).toUpperCase()}` : 'Confirmed';

    events.push({
      id: `evt-apt-${activeAppointment.id}`,
      title: 'Biometric Appointment Confirmed',
      category: 'APPOINTMENT',
      status: 'COMPLETED',
      date: activeAppointment.createdAt,
      description: `Official biometric appointment scheduled on ${apptDateStr} at ${timeStr} at ${apptLoc}.`,
      badge: apptRef,
    });
  }

  if (dossier.services && dossier.services.length > 0) {
    const serviceNames = dossier.services.map((s) => s.serviceType.replace(/_/g, ' ')).join(', ');
    events.push({
      id: `evt-srv-${dossier.id}`,
      title: 'Value-Added Services Active',
      category: 'SERVICES',
      status: 'COMPLETED',
      date: dossier.services[0].createdAt,
      description: `${dossier.services.length} premium service(s) configured: ${serviceNames}.`,
      badge: `${dossier.services.length} Active Services`,
    });
  }

  if (dossier.statusHistory && dossier.statusHistory.length > 0) {
    dossier.statusHistory.forEach((hist) => {
      let histTitle = `Status Updated to ${hist.toStatus.replace(/_/g, ' ')}`;
      let histCategory = 'STATUS_UPDATE';
      let histStatus = 'COMPLETED';

      if (hist.toStatus === 'SUBMITTED_TO_CONSULATE') {
        histTitle = 'Forwarded & Received at Consulate';
      } else if (hist.toStatus === 'APPROVED') {
        histTitle = 'Consular Approval Granted';
      } else if (hist.toStatus === 'REJECTED') {
        histTitle = 'Consular Decision Issued';
      } else if (hist.toStatus === 'NEEDS_CORRECTION') {
        histTitle = 'Action Required: Additional Information Requested';
        histStatus = 'ALERT';
      }

      events.push({
        id: `evt-hist-${hist.id}`,
        title: histTitle,
        category: histCategory,
        status: histStatus,
        date: hist.createdAt,
        description: hist.notes || `Dossier moved from ${hist.fromStatus} to ${hist.toStatus}.`,
        badge: hist.toStatus,
        notes: hist.notes,
      });
    });
  }

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    dossier,
    tracking: {
      currentStage,
      stageTitle,
      stageDescription,
      needsCorrection: dossier.status === 'NEEDS_CORRECTION',
      decision: dossier.status === 'APPROVED' ? 'APPROVED' : dossier.status === 'REJECTED' ? 'REJECTED' : null,
      events,
      activeAppointment,
      servicesCount: dossier.services?.length || 0,
      verifiedDocsCount: verifiedDocs.length,
      totalDocsCount: totalDocs,
      estimatedDays: 15,
    },
  };
}

module.exports = {
  getDossierTracking,
};
