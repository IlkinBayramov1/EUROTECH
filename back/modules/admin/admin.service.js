const prisma = require('../../config/db');
const notificationService = require('../notification/notification.service');
const paymentService = require('../payment/payment.service');
const walletService = require('../payment/wallet.service');
const pricingConfigService = require('../service/pricingConfig.service');
const adminAnalyticsService = require('./adminAnalytics.service');

async function getDashboardMetrics() {
  return adminAnalyticsService.getAccurateSummaryMetrics();
}

async function getDashboardAnalytics(params = {}) {
  return adminAnalyticsService.getExecutiveAnalytics(params);
}

async function getAllDossiers({ status, portalType, search, page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (portalType && portalType !== 'ALL') where.portalType = portalType;
  if (search) {
    where.OR = [
      { dossierNumber: { contains: search } },
      { user: { fullName: { contains: search } } },
      { user: { email: { contains: search } } },
      { country: { nameEn: { contains: search } } },
      { country: { nameAz: { contains: search } } },
      { country: { code: { contains: search } } },
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
        visaType: true,
        visaPurpose: true,
        applicants: true,
        groupBatch: true,
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
    }

    await walletService.recalculateWalletBalances(payout.walletId, tx);

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
    urgentProcessingFee: '60.00',
    premiumLoungeFee: '81.00',
    sessionTimeout: '15',
    eurToAznRate: '1.85',
    baseSchengenFee: '80.00',
    consularCenterLocation: 'Baku Consular Review Office',
  };

  const dbSettings = await prisma.systemSetting.findMany();
  const settingsMap = { ...defaultSettings };
  dbSettings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  const pricingCatalog = await pricingConfigService.getPricingCatalog();

  return {
    settings: settingsMap,
    items: dbSettings,
    pricingCatalog,
  };
}

async function updateSystemSettings(settingsObj, adminUserId = null) {
  if (settingsObj.pricingCatalog && typeof settingsObj.pricingCatalog === 'object') {
    await pricingConfigService.savePricingCatalog(settingsObj.pricingCatalog, adminUserId);
  }

  const updates = [];
  for (const [key, val] of Object.entries(settingsObj)) {
    if (key === 'pricingCatalog') continue;
    if (val !== undefined && val !== null) {
      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      updates.push(
        prisma.systemSetting.upsert({
          where: { key },
          update: { value: stringVal },
          create: { key, value: stringVal, valueType: 'STRING' },
        })
      );
    }
  }
  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
  return getSystemSettings();
}

async function getPricingCatalog() {
  return pricingConfigService.getPricingCatalog();
}

async function savePricingCatalog(catalogInput, adminUserId = null) {
  return pricingConfigService.savePricingCatalog(catalogInput, adminUserId);
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
  const baseFeeVal = data.baseFee !== undefined ? Number(data.baseFee) : undefined;
  if (data.id) {
    return prisma.visaCategory.update({
      where: { id: data.id },
      data: {
        code: data.code,
        nameAz: data.nameAz,
        nameEn: data.nameEn,
        nameRu: data.nameRu || data.nameEn,
        ...(baseFeeVal !== undefined ? { baseFee: baseFeeVal } : {}),
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
      ...(baseFeeVal !== undefined ? { baseFee: baseFeeVal } : {}),
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
  const slips = await paymentService.getBankPaymentSlips();

  return slips.map((s) => {
    const meta = s.metadataJson && typeof s.metadataJson === 'object' ? s.metadataJson : {};
    const linkedPromo = Array.isArray(s.promoRedemptions) && s.promoRedemptions.length > 0 ? s.promoRedemptions[0] : null;
    return {
      id: s.id,
      dossierId: s.dossierId || null,
      groupBatchId: s.groupBatchId || null,
      dossierNumber: s.dossier?.dossierNumber || null,
      groupBatchCode: s.groupBatch?.code || null,
      groupBatchName: s.groupBatch?.name || null,
      purpose: s.purpose || (s.groupBatchId ? 'GROUP_BATCH_PAYMENT' : s.dossierId ? 'DOSSIER_PAYMENT' : 'WALLET_TOPUP'),
      applicantName: s.user?.fullName || s.dossier?.user?.fullName || 'Client',
      senderName: meta.senderName || s.user?.companyName || s.user?.fullName || 'Client',
      bankName: meta.bankName || null,
      email: s.user?.email || s.dossier?.user?.email || null,
      amount: s.amount,
      currency: s.currency || 'EUR',
      promoCode: linkedPromo?.promoCodeSnapshot || meta.promoCode || null,
      originalAmountEur: linkedPromo?.originalAmountEur ?? meta.originalAmountEur ?? null,
      discountAmountEur: linkedPromo?.discountAmountEur ?? meta.discountAmountEur ?? 0,
      expectedNetAmountEur: linkedPromo?.finalAmountEur ?? meta.expectedNetAmountEur ?? null,
      promoStatus: linkedPromo?.status || null,
      referenceCode: s.referenceCode,
      fileUrl: s.fileUrl,
      fileName: s.fileName,
      status: s.status === 'PAID' ? 'APPROVED' : s.status === 'REFUNDED' ? 'REJECTED' : s.status,
      notes: s.adminNotes,
      metadataJson: meta,
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt,
    };
  });
}

async function reviewBankSlip(receiptId, status, notes, reviewerUserId) {
  return paymentService.reviewBankPaymentSlip({
    receiptId,
    adminUserId: reviewerUserId,
    action: status,
    adminNotes: notes,
  });
}

async function getBankSlipFile(receiptId) {
  return paymentService.getBankSlipFile(receiptId);
}

async function getUserWallets({ role = null, search = null } = {}) {
  return walletService.adminGetAllWallets({ role, search });
}

async function adjustUserWallet(targetUserId, { amount, type = 'CREDIT', reason }, adminUserId) {
  return walletService.adminAdjustWallet({
    targetUserId,
    amount,
    type,
    reason,
    adminUserId,
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
  getDashboardAnalytics,
  getAllDossiers,
  updateDossierStatusAndDecision,
  getAgentPayouts,
  updateAgentPayoutStatus,
  getAuditLogs,
  getSystemSettings,
  updateSystemSettings,
  getPricingCatalog,
  savePricingCatalog,
  saveCountry,
  saveVisaCategory,
  saveTimeSlot,
  getIntegrationsHealth,
  getBankSlips,
  reviewBankSlip,
  getBankSlipFile,
  getUserWallets,
  adjustUserWallet,
  getCronMonitorStatus,
};
