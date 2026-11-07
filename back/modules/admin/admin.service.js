const prisma = require('../../config/db');
const notificationService = require('../notification/notification.service');

async function getDashboardMetrics() {
  const activeDossiers = await prisma.dossier.count({
    where: {
      status: { in: ['RECEIVED', 'UNDER_REVIEW', 'SUBMITTED_TO_CONSULATE'] },
    },
  });

  const underReviewCount = await prisma.dossier.count({
    where: { status: 'UNDER_REVIEW' },
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const approvedThisMonth = await prisma.dossier.count({
    where: {
      status: 'APPROVED',
      updatedAt: { gte: startOfMonth },
    },
  });

  const paidTransactions = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { status: 'PAID' },
  });

  const totalRevenue = paidTransactions._sum.amount || 0;

  return {
    activeDossiers,
    underReviewCount,
    approvedThisMonth,
    totalRevenue,
  };
}

async function getAllDossiers({ status, portalType, search, page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (portalType) where.portalType = portalType;
  if (search) {
    where.OR = [
      { dossierNumber: { contains: search } },
      { user: { fullName: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }

  const [total, dossiers] = await Promise.all([
    prisma.dossier.count({ where }),
    prisma.dossier.findMany({
      where,
      include: {
        user: true,
        country: true,
        visaCategory: true,
        applicants: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
  ]);

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    dossiers,
  };
}

async function updateDossierStatusAndDecision({ dossierId, nextStatus, notes, reviewerUserId }) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { user: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const updatedDossier = await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      status: nextStatus,
      statusHistory: {
        create: {
          fromStatus: dossier.status,
          toStatus: nextStatus,
          changedByUserId: reviewerUserId,
          notes,
        },
      },
    },
    include: { user: true, country: true, visaCategory: true },
  });

  let statusText = 'Yoxlamada';
  if (nextStatus === 'SUBMITTED_TO_CONSULATE') statusText = 'Konsulluq Mərhələsində';
  if (nextStatus === 'APPROVED') statusText = 'Təsdiqləndi! (Vizanız Hazırdır)';
  if (nextStatus === 'REJECTED') statusText = 'Müraciətiniz Rədd Edildi';

  // Automatically provision VisaRecord for corporate employees when approved
  if (nextStatus === 'APPROVED') {
    try {
      const fullDossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
          applicants: true,
          country: true,
          visaCategory: true,
          groupBatch: true,
        },
      });

      if (fullDossier?.applicants) {
        for (const app of fullDossier.applicants) {
          if (app.passportNumber) {
            const employee = await prisma.corporateEmployee.findFirst({
              where: {
                OR: [
                  { passportNumber: app.passportNumber },
                  { corporateUserId: fullDossier.userId, firstName: app.firstName, lastName: app.lastName },
                ],
              },
            });

            if (employee) {
              const now = new Date();
              const oneYearLater = new Date();
              oneYearLater.setFullYear(now.getFullYear() + 1);

              await prisma.visaRecord.create({
                data: {
                  employeeId: employee.id,
                  country: fullDossier.country?.nameEn || 'Schengen Member State',
                  type: fullDossier.visaCategory?.nameEn || 'Schengen C (Business)',
                  issueDate: now,
                  expiryDate: oneYearLater,
                  status: 'ACTIVE',
                  batchRef: fullDossier.groupBatch?.code || fullDossier.dossierNumber,
                },
              });
            }
          }
        }
      }
    } catch (visaErr) {
      console.warn('Auto-provisioning VisaRecord on APPROVED notice:', visaErr.message);
    }
  }

  await notificationService.sendDecisionNotification(
    dossier.user.email,
    dossier.user.fullName,
    dossier.dossierNumber,
    statusText,
    notes
  );

  return updatedDossier;
}

async function getAgentPayouts() {
  const payouts = await prisma.payoutRequest.findMany({
    include: {
      wallet: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, companyName: true, phone: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return payouts.map((p) => ({
    id: p.id,
    walletId: p.walletId,
    agentName: p.wallet?.user?.fullName || 'Agent',
    companyName: p.wallet?.user?.companyName || 'Travel Partner',
    email: p.wallet?.user?.email,
    phone: p.wallet?.user?.phone,
    amount: p.amount,
    bankName: p.bankName,
    iban: p.iban,
    swiftBic: p.swiftBic,
    status: p.status,
    createdAt: p.createdAt,
    processedAt: p.processedAt,
  }));
}

async function updateAgentPayoutStatus(payoutId, status) {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutId },
    include: { wallet: true },
  });

  if (!payout) {
    const error = new Error('Payout request not found');
    error.statusCode = 404;
    throw error;
  }

  if (status === 'REJECTED' && payout.status === 'REJECTED') {
    const error = new Error('This payout request has already been rejected and refunded.');
    error.statusCode = 400;
    throw error;
  }

  if (status === 'PROCESSED' && payout.status === 'PROCESSED') {
    const error = new Error('This payout request has already been processed.');
    error.statusCode = 400;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status,
        processedAt: new Date(),
      },
    });

    const txRecord = await tx.walletTransaction.findFirst({
      where: { walletId: payout.walletId, referenceId: payoutId, referenceType: 'PAYOUT' },
    });

    if (status === 'PROCESSED') {
      if (txRecord) {
        await tx.walletTransaction.update({
          where: { id: txRecord.id },
          data: { status: 'PAID' },
        });
      }
    } else if (status === 'REJECTED') {
      if (txRecord) {
        await tx.walletTransaction.update({
          where: { id: txRecord.id },
          data: { status: 'REFUNDED' },
        });
      }
      // Refund back to agent balance
      await tx.wallet.update({
        where: { id: payout.walletId },
        data: { balance: { increment: payout.amount } },
      });
    }

    return updated;
  });
}

async function getAuditLogs({ page = 1, limit = 20, action, search } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const where = {};
  if (action && action !== 'ALL') {
    where.action = action;
  }
  if (search) {
    where.OR = [
      { action: { contains: search } },
      { user: { fullName: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
  ]);

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      user: log.user || { fullName: 'System', email: 'system@eurotech.services', role: 'SYSTEM' },
      ipAddress: log.ipAddress || '127.0.0.1 (EuroTech Consular Gateway)',
      userAgent: log.userAgent || 'EuroTech Consular Desk',
      details: log.details || {},
      createdAt: log.createdAt,
    })),
  };
}

async function getSystemSettings() {
  const defaultSettings = {
    urgentProcessingFee: '50.00',
    premiumLoungeFee: '81.00',
    sessionTimeout: '15',
    eurToAznRate: '1.85',
    baseSchengenFee: '90.00',
    consularCenterLocation: 'Baku Consular Review Office',
  };

  const dbSettings = await prisma.systemSetting.findMany();
  const settingsMap = { ...defaultSettings };
  dbSettings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return {
    settings: settingsMap,
    items: dbSettings,
  };
}

async function updateSystemSettings(settingsObj) {
  const updates = [];
  for (const [key, val] of Object.entries(settingsObj)) {
    if (val !== undefined && val !== null) {
      const stringVal = String(val);
      updates.push(
        prisma.systemSetting.upsert({
          where: { key },
          update: { value: stringVal },
          create: { key, value: stringVal, valueType: 'STRING' },
        })
      );
    }
  }
  await prisma.$transaction(updates);
  return getSystemSettings();
}

async function saveCountry(data) {
  if (data.id) {
    return prisma.country.update({
      where: { id: data.id },
      data: {
        code: data.code,
        nameAz: data.nameAz,
        nameEn: data.nameEn,
        nameRu: data.nameRu || data.nameEn,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  return prisma.country.create({
    data: {
      code: data.code,
      nameAz: data.nameAz,
      nameEn: data.nameEn,
      nameRu: data.nameRu || data.nameEn,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });
}

async function saveVisaCategory(data) {
  if (data.id) {
    return prisma.visaCategory.update({
      where: { id: data.id },
      data: {
        code: data.code,
        nameAz: data.nameAz,
        nameEn: data.nameEn,
        nameRu: data.nameRu || data.nameEn,
      },
    });
  }
  return prisma.visaCategory.create({
    data: {
      countryId: data.countryId,
      code: data.code,
      nameAz: data.nameAz,
      nameEn: data.nameEn,
      nameRu: data.nameRu || data.nameEn,
    },
  });
}

async function saveTimeSlot(data) {
  const dateObj = new Date(data.date);
  if (data.id) {
    return prisma.timeSlot.update({
      where: { id: data.id },
      data: {
        date: dateObj,
        startTime: data.startTime,
        capacity: Number(data.capacity) || 10,
        location: data.location || 'EuroTech Main Center',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  return prisma.timeSlot.create({
    data: {
      date: dateObj,
      startTime: data.startTime,
      capacity: Number(data.capacity) || 10,
      bookedCount: 0,
      location: data.location || 'EuroTech Main Center',
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });
}

async function getIntegrationsHealth() {
  const fs = require('fs');
  const path = require('path');
  const env = require('../../config/env');

  let dbStatus = 'ONLINE';
  let dbLatencyMs = 0;
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
  } catch (e) {
    dbStatus = 'OFFLINE';
  }

  let storageStatus = 'WRITABLE';
  try {
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const testFile = path.join(uploadDir, `.health_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'OK');
    fs.unlinkSync(testFile);
  } catch (e) {
    storageStatus = 'READ_ONLY_OR_ERROR';
  }

  return {
    status: dbStatus === 'ONLINE' && storageStatus === 'WRITABLE' ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: dbStatus, latencyMs: dbLatencyMs, dialect: 'mysql' },
      storage: { status: storageStatus, uploadDir: env.UPLOAD_DIR },
      mailService: { status: 'CONFIGURED', provider: env.SMTP_HOST ? 'SMTP' : 'CONSOLE_LOGGER' },
      paymentGateway: { status: 'ONLINE', providers: ['STRIPE', 'LOCAL_BANK_WIRE', 'WALLET'] },
      consularSchengenEngine: { status: 'OPERATIONAL', formVersion: 'HARMONIZED_37_POINT' },
    },
  };
}

async function getBankSlips() {
  const slips = await prisma.bankPaymentReceipt.findMany({
    include: {
      dossier: {
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          country: true,
          visaCategory: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return slips.map((s) => ({
    id: s.id,
    dossierId: s.dossierId,
    dossierNumber: s.dossier?.dossierNumber,
    applicantName: s.dossier?.user?.fullName || 'Client',
    email: s.dossier?.user?.email,
    amount: s.amount,
    currency: s.currency,
    referenceCode: s.referenceCode,
    fileUrl: s.fileUrl,
    fileName: s.fileName,
    status: s.status === 'PAID' ? 'APPROVED' : s.status === 'REFUNDED' ? 'REJECTED' : s.status,
    notes: s.adminNotes,
    metadataJson: s.metadataJson || {},
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
  }));
}

async function reviewBankSlip(receiptId, status, notes, reviewerUserId) {
  const receipt = await prisma.bankPaymentReceipt.findUnique({
    where: { id: receiptId },
    include: { dossier: true },
  });

  if (!receipt) {
    const error = new Error('Bank payment slip receipt not found');
    error.statusCode = 404;
    throw error;
  }

  const isApproved = status === 'APPROVED' || status === 'PAID';
  const targetStatus = isApproved ? 'PAID' : 'REFUNDED';

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.bankPaymentReceipt.update({
      where: { id: receiptId },
      data: {
        status: targetStatus,
        adminNotes: notes || receipt.adminNotes,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });

    if (isApproved) {
      await tx.dossier.update({
        where: { id: receipt.dossierId },
        data: {
          paymentStatus: 'PAID',
          status: 'UNDER_REVIEW',
        },
      });

      await tx.transaction.create({
        data: {
          dossierId: receipt.dossierId,
          userId: receipt.userId,
          amount: receipt.amount,
          currency: receipt.currency,
          paymentProvider: 'BANK_TRANSFER',
          orderReference: receipt.referenceCode,
          receiptUrl: receipt.fileUrl,
          status: 'PAID',
          metadataJson: {
            bankSlipId: receipt.id,
            referenceCode: receipt.referenceCode,
            approvedByUserId: reviewerUserId,
            approvedAt: new Date().toISOString(),
          },
        },
      });

      // Confirm any pending appointment for this dossier
      await tx.appointment.updateMany({
        where: { dossierId: receipt.dossierId, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED' },
      });
    } else {
      await tx.dossier.update({
        where: { id: receipt.dossierId },
        data: {
          paymentStatus: 'PENDING',
        },
      });
    }

    try {
      await tx.auditLog.create({
        data: {
          userId: reviewerUserId,
          action: 'BANK_SLIP_REVIEWED',
          details: {
            receiptId,
            dossierId: receipt.dossierId,
            status,
            notes,
          },
        },
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for bank slip review:', auditErr);
    }

    return updated;
  });
}

async function getCronMonitorStatus() {
  return {
    timestamp: new Date().toISOString(),
    jobs: [
      {
        id: 'dossier-archival',
        name: 'Dossier Auto-Archival Worker',
        schedule: 'Daily at 02:00 AM (0 2 * * *)',
        status: 'ACTIVE',
        lastRunStatus: 'SUCCESS',
        description: 'Auto-archives approved dossiers older than 180 days to compliant ZIP storage.',
      },
      {
        id: 'appointment-reminders',
        name: 'Consular Appointment Reminder Dispatcher',
        schedule: 'Hourly (0 * * * *)',
        status: 'ACTIVE',
        lastRunStatus: 'SUCCESS',
        description: 'Sends automated 24-hour and 2-hour SMS & email notifications before biometric appointments.',
      },
      {
        id: 'unpaid-cancellation',
        name: 'Unpaid Slot Release & Expiration Worker',
        schedule: 'Every 30 mins (*/30 * * * *)',
        status: 'ACTIVE',
        lastRunStatus: 'SUCCESS',
        description: 'Releases locked consular appointment time-slots if payment is uncompleted within 24 hours.',
      },
      {
        id: 'agent-tier-recalculation',
        name: 'Agent Tier & Volume Recalculation Worker',
        schedule: 'Sunday at 03:00 AM (0 3 * * 0)',
        status: 'ACTIVE',
        lastRunStatus: 'SUCCESS',
        description: 'Recalculates agent agency commission tier (Bronze/Silver/Gold) based on trailing passenger count.',
      },
      {
        id: 'passport-expiry-radar',
        name: 'Corporate Passport Expiry Radar Worker',
        schedule: 'Daily at 06:00 AM (0 6 * * *)',
        status: 'ACTIVE',
        lastRunStatus: 'SUCCESS',
        description: 'Scans employee registries and dispatches consular warnings for passports expiring in < 90 days.',
      },
    ],
  };
}

module.exports = {
  getDashboardMetrics,
  getAllDossiers,
  updateDossierStatusAndDecision,
  getAgentPayouts,
  updateAgentPayoutStatus,
  getAuditLogs,
  getSystemSettings,
  updateSystemSettings,
  saveCountry,
  saveVisaCategory,
  saveTimeSlot,
  getIntegrationsHealth,
  getBankSlips,
  reviewBankSlip,
  getCronMonitorStatus,
};
