const prisma = require('../../../config/db');
const pdfUtil = require('../../../utils/pdf.util');

async function getCorporateDashboardStats(corporateUserId) {
  const batches = await prisma.groupBatch.findMany({
    where: { userId: corporateUserId, portalType: 'CORPORATE' },
    include: {
      dossiers: {
        include: {
          applicants: {
            include: { documents: true },
          },
        },
      },
      invoices: true,
      appointments: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeBatchesCount = batches.filter(
    (b) => b.status === 'DRAFT' || b.status === 'PROCESSING' || b.status === 'READY'
  ).length;

  let totalApplicants = 0;
  let totalMissingDocs = 0;
  for (const b of batches) {
    for (const d of b.dossiers) {
      for (const app of d.applicants) {
        totalApplicants++;
        const docCount = (app.documents || []).length;
        if (docCount < 4) {
          totalMissingDocs += (4 - docCount);
        }
      }
    }
  }

  const employees = await prisma.corporateEmployee.findMany({
    where: { corporateUserId },
    include: { visaHistory: true },
  });
  let approvedVisasCount = 0;
  employees.forEach((emp) => {
    approvedVisasCount += (emp.visaHistory || []).filter((v) => v.status === 'ACTIVE').length;
  });

  let upcomingAppointment = await prisma.appointment.findFirst({
    where: {
      userId: corporateUserId,
      status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
      timeSlot: {
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    },
    include: {
      timeSlot: true,
      groupBatch: true,
    },
    orderBy: { timeSlot: { date: 'asc' } },
  });

  if (!upcomingAppointment) {
    upcomingAppointment = await prisma.appointment.findFirst({
      where: {
        userId: corporateUserId,
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
      },
      include: {
        timeSlot: true,
        groupBatch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  let wallet = await prisma.wallet.findUnique({
    where: { userId: corporateUserId },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: corporateUserId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
    });
  }

  const recentLogs = await prisma.auditLog.findMany({
    where: { userId: corporateUserId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const sortedBatches = [...batches].sort((a, b) => {
    const aEmp = a.dossiers.reduce((acc, d) => acc + (d.applicants?.length || 0), 0);
    const bEmp = b.dossiers.reduce((acc, d) => acc + (d.applicants?.length || 0), 0);
    if (aEmp > 0 && bEmp === 0) return -1;
    if (bEmp > 0 && aEmp === 0) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const mappedBatches = sortedBatches.slice(0, 5).map((b) => {
    let empCount = 0;
    let totalDocs = 0;
    for (const d of b.dossiers) {
      for (const app of d.applicants) {
        empCount++;
        totalDocs += (app.documents || []).length;
      }
    }
    const targetDocs = Math.max(1, empCount * 4);
    const readiness = Math.min(100, Math.round((totalDocs / targetDocs) * 100));

    return {
      id: b.id,
      code: b.code,
      name: b.name,
      destination: b.destination,
      duration: b.duration,
      status: b.status,
      employeesCount: empCount,
      readiness,
      hasPendingInvoice: b.invoices.some((inv) => inv.status === 'PENDING'),
    };
  });

  return {
    stats: {
      activeBatches: activeBatchesCount,
      missingDocs: totalMissingDocs,
      approvedVisas: approvedVisasCount,
      totalEmployees: employees.length,
      nextAppointment: upcomingAppointment
        ? {
            id: upcomingAppointment.id,
            date: upcomingAppointment.timeSlot?.date || upcomingAppointment.createdAt,
            time: upcomingAppointment.timeSlot?.startTime || '10:00 AM',
            status: upcomingAppointment.status,
            batchCode: upcomingAppointment.groupBatch?.code,
          }
        : null,
      walletBalance: wallet.balance,
      currency: wallet.currency,
    },
    recentBatches: mappedBatches,
    recentActivities: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      createdAt: log.createdAt,
    })),
  };
}

async function getGuaranteeLetterPdf({ corporateUserId, employeeId }) {
  const corporateUser = await prisma.user.findUnique({
    where: { id: corporateUserId },
  });

  if (!corporateUser) {
    const error = new Error('Corporate account not found');
    error.statusCode = 404;
    throw error;
  }

  let employee = await prisma.corporateEmployee.findFirst({
    where: { id: employeeId, corporateUserId },
  });

  let applicant = null;
  if (!employee) {
    applicant = await prisma.applicant.findFirst({
      where: {
        id: employeeId,
        dossier: { groupBatch: { userId: corporateUserId } },
      },
      include: { dossier: { include: { country: true } } },
    });

    if (applicant) {
      employee = {
        id: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        passportNumber: applicant.passportNumber,
      };
    }
  }

  if (!employee) {
    const error = new Error('Employee not found in corporate directory');
    error.statusCode = 404;
    throw error;
  }

  const dossier = applicant?.dossier || {
    dossierNumber: `CORP-${employee.passportNumber || employee.id.slice(0, 8)}`,
    country: { name: 'Hungary / Schengen Member State' },
  };

  const pdfResult = await pdfUtil.generateCorporateGuaranteeLetterPdf(dossier, employee, corporateUser);

  return {
    fileName: pdfResult.fileName,
    pdfUrl: pdfResult.fileUrl,
    employeeName: `${employee.firstName} ${employee.lastName}`,
  };
}

module.exports = {
  getCorporateDashboardStats,
  getGuaranteeLetterPdf,
};
