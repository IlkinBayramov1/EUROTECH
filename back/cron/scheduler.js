const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const env = require('../config/env');
const notificationService = require('../modules/notification/notification.service');
const messagingService = require('../services/messaging.service');
const zipUtil = require('../utils/zip.util');

/**
 * Worker 1: Consular Passport & Visa Expiry Radar Job
 * Scans corporate employee passports and notifies HR & Employees
 */
async function runPassportRadarJob() {
  const startedAt = new Date();
  console.log('[CRON] Starting Consular Passport Radar Scan...');

  let processedCount = 0;
  let details = {};

  try {
    const employees = await prisma.corporateEmployee.findMany({
      where: {
        passportExpiry: { not: null },
      },
      include: {
        corporateUser: true,
      },
    });

    const now = new Date();
    const hrGroups = {};

    for (const emp of employees) {
      if (!emp.passportExpiry) continue;
      const expiry = new Date(emp.passportExpiry);
      const diffMs = expiry - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 180) {
        processedCount++;
        const isCritical = diffDays < 90;
        const hrId = emp.corporateUserId;

        if (!hrGroups[hrId]) {
          hrGroups[hrId] = {
            hrEmail: emp.corporateUser?.email || 'hr@company.az',
            hrFullName: emp.corporateUser?.fullName || 'HR Manager',
            employees: [],
          };
        }

        hrGroups[hrId].employees.push({
          fullName: `${emp.firstName} ${emp.lastName}`,
          passportNumber: emp.passportNumber,
          passportExpiry: emp.passportExpiry,
          department: emp.department,
          diffDays,
          isCritical,
        });

        // Send SMS alert to employee if critical and phone exists
        if (isCritical && emp.phone) {
          const smsText = `EuroTech Radar: Hörmətli ${emp.firstName}, pasportunuzun etibarlılıq müddəti ${diffDays} gün sonra bitir. Zəhmət olmasa təcili yeniləyin.`;
          try {
            await messagingService.sendSms({ to: emp.phone, message: smsText });
          } catch (smsErr) {
            console.warn('[CRON] SMS radar warning failed:', smsErr.message);
          }
        }
      }
    }

    // Dispatch digest emails to Corporate HRs
    for (const hrId of Object.keys(hrGroups)) {
      const group = hrGroups[hrId];
      try {
        await notificationService.sendCorporateExpiryRadarNotification({
          hrEmail: group.hrEmail,
          hrFullName: group.hrFullName,
          expiringEmployees: group.employees,
        });
      } catch (mailErr) {
        console.warn('[CRON] HR radar email dispatch failed:', mailErr.message);
      }
    }

    details = { hrNotifiedCount: Object.keys(hrGroups).length, employeesAtRisk: processedCount };

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'PASSPORT_RADAR',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: details,
      },
    });

    console.log(`[CRON] Passport Radar completed. ${processedCount} employees alerted.`);
    return { success: true, processedCount, details };
  } catch (error) {
    console.error('[CRON ERROR] Passport Radar Job failed:', error);
    await prisma.cronTaskLog.create({
      data: {
        taskName: 'PASSPORT_RADAR',
        status: 'FAILED',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { error: error.message },
      },
    });
    return { success: false, error: error.message };
  }
}

/**
 * Worker 2: Consular Appointment Reminders (T-24h & T-2h)
 * Uses reminded24hAt and reminded2hAt timestamps to prevent duplicate alerts
 */
async function runAppointmentReminderJob() {
  const startedAt = new Date();
  console.log('[CRON] Running Consular Appointment Reminders Worker...');

  let processedCount = 0;
  const now = new Date();

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
      },
      include: {
        timeSlot: true,
        user: true,
        dossier: { include: { country: true } },
      },
    });

    for (const app of appointments) {
      if (!app.timeSlot || !app.timeSlot.date) continue;
      const slotTime = new Date(app.timeSlot.date);
      const diffHours = (slotTime - now) / (1000 * 60 * 60);

      // T-24 Hours Reminder (22 to 26 hours window) - only if not already reminded
      if (diffHours >= 22 && diffHours <= 26 && !app.reminded24hAt) {
        processedCount++;
        const message = `EuroTech Xatırlatma: Hörmətli ${app.user.fullName}, sabah saat ${app.timeSlot.startTime}-da ${app.location || 'EuroTech Mərkəzi'}-də görüşünüz var. Xarici pasport və zəruri sənədlərinizi unutmayın.`;
        if (app.user.phone) {
          try {
            await messagingService.sendWhatsAppTemplate({
              to: app.user.phone,
              templateName: 'appointment_reminder_24h',
              bodyParameters: [app.user.fullName, app.timeSlot.startTime, app.location || 'EuroTech Mərkəzi'],
            });
            await messagingService.sendSms({ to: app.user.phone, message });
          } catch (commErr) {
            console.warn('[CRON] 24h reminder notification failed:', commErr.message);
          }
        }
        await prisma.appointment.update({
          where: { id: app.id },
          data: { reminded24hAt: new Date() },
        });
      }

      // T-2 Hours Urgent Reminder (1 to 3 hours window) - only if not already reminded
      if (diffHours >= 1 && diffHours <= 3 && !app.reminded2hAt) {
        processedCount++;
        const urgentSms = `EuroTech Təcili Xatırlatma: Hörmətli ${app.user.fullName}, viza mərkəzindəki görüşünüzə 2 saat qaldı (${app.timeSlot.startTime}). Mərkəz: ${app.location || 'EuroTech Mərkəzi'}.`;
        if (app.user.phone) {
          try {
            await messagingService.sendSms({ to: app.user.phone, message: urgentSms });
          } catch (commErr) {
            console.warn('[CRON] 2h reminder notification failed:', commErr.message);
          }
        }
        await prisma.appointment.update({
          where: { id: app.id },
          data: { reminded2hAt: new Date() },
        });
      }
    }

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'APPOINTMENT_REMINDER',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { remindedCount: processedCount },
      },
    });

    console.log(`[CRON] Appointment Reminders completed. ${processedCount} applicants notified.`);
    return { success: true, processedCount };
  } catch (error) {
    console.error('[CRON ERROR] Appointment Reminder failed:', error);
    await prisma.cronTaskLog.create({
      data: {
        taskName: 'APPOINTMENT_REMINDER',
        status: 'FAILED',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { error: error.message },
      },
    });
    return { success: false, error: error.message };
  }
}

/**
 * Worker 3: Unpaid Dossier Cleanup & Slot Release Worker
 */
async function runUnpaidDossierCleanupJob() {
  const startedAt = new Date();
  console.log('[CRON] Running Unpaid Dossier Cleanup & Slot Release Worker...');

  let processedCount = 0;
  const thresholdTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  try {
    const expiredDossiers = await prisma.dossier.findMany({
      where: {
        paymentStatus: 'PENDING',
        status: 'RECEIVED',
        createdAt: { lt: thresholdTime },
        unpaidCancelledAt: null,
      },
      include: {
        appointments: { include: { timeSlot: true } },
      },
    });

    for (const dossier of expiredDossiers) {
      processedCount++;

      // Release appointment slots if any
      for (const app of dossier.appointments) {
        if (app.timeSlotId && app.timeSlot) {
          await prisma.timeSlot.update({
            where: { id: app.timeSlotId },
            data: { bookedCount: Math.max(0, app.timeSlot.bookedCount - 1) },
          });
          await prisma.appointment.update({
            where: { id: app.id },
            data: {
              status: 'CANCELLED',
              notes: '24 saat ərzində ödəniş edilmədiyi üçün rezerv olunmuş vaxt sərbəst buraxıldı.',
            },
          });
        }
      }

      await prisma.dossier.update({
        where: { id: dossier.id },
        data: { unpaidCancelledAt: new Date() },
      });

      await prisma.dossierStatusHistory.create({
        data: {
          dossierId: dossier.id,
          fromStatus: dossier.status,
          toStatus: dossier.status,
          changedByUserId: dossier.userId,
          notes: 'Ödəniş 24 saat ərzində tamamlanmadığı üçün rezerv olunmuş görüş kvotası sərbəst buraxıldı.',
        },
      });
    }

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'UNPAID_DOSSIER_CLEANUP',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { releasedDossierCount: processedCount },
      },
    });

    console.log(`[CRON] Unpaid Dossier Cleanup completed. ${processedCount} dossiers released.`);
    return { success: true, processedCount };
  } catch (error) {
    console.error('[CRON ERROR] Unpaid Dossier Cleanup failed:', error);
    await prisma.cronTaskLog.create({
      data: {
        taskName: 'UNPAID_DOSSIER_CLEANUP',
        status: 'FAILED',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { error: error.message },
      },
    });
    return { success: false, error: error.message };
  }
}

/**
 * Worker 4: Agent Tier & Commission Volume Recalculation Worker
 * Evaluates trailing 30-day passenger volume and automatically upgrades/downgrades tiers
 */
async function runAgentTierRecalculationJob() {
  const startedAt = new Date();
  console.log('[CRON] Starting Agent Tier Recalculation Worker...');
  let processedCount = 0;

  try {
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT_TUR_OPERATOR' },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const agent of agents) {
      const paidDossiers = await prisma.dossier.findMany({
        where: {
          userId: agent.id,
          paymentStatus: 'PAID',
          createdAt: { gte: thirtyDaysAgo },
        },
        include: { applicants: true },
      });

      let totalPassengers = 0;
      paidDossiers.forEach((d) => {
        totalPassengers += Math.max(1, d.applicants?.length || 1);
      });

      let targetTier = 'BRONZE';
      if (totalPassengers >= 50) {
        targetTier = 'GOLD';
      } else if (totalPassengers >= 20) {
        targetTier = 'SILVER';
      }

      if (agent.agentTier !== targetTier) {
        await prisma.user.update({
          where: { id: agent.id },
          data: { agentTier: targetTier },
        });
        processedCount++;
      }
    }

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'AGENT_TIER_RECALCULATION',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { updatedTiersCount: processedCount },
      },
    });

    console.log(`[CRON] Agent Tier Recalculation completed: ${processedCount} agent tiers updated.`);
    return { success: true, processedCount };
  } catch (error) {
    console.error('[CRON ERROR] Agent Tier Recalculation failed:', error);
    await prisma.cronTaskLog.create({
      data: {
        taskName: 'AGENT_TIER_RECALCULATION',
        status: 'FAILED',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { error: error.message },
      },
    });
    return { success: false, error: error.message };
  }
}

/**
 * Worker 5: Dossier Auto-Archival Worker
 * Compresses settled dossiers older than 180 days into ZIP archive
 */
async function runDossierArchivalJob() {
  const startedAt = new Date();
  console.log('[CRON] Starting Dossier Auto-Archival Worker...');
  let processedCount = 0;
  const thresholdDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 180 days

  try {
    const eligibleDossiers = await prisma.dossier.findMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED'] },
        archivedZipUrl: null,
        createdAt: { lte: thresholdDate },
      },
      include: {
        documents: true,
        applicants: { include: { documents: true } },
      },
      take: 50,
    });

    const uploadDir = path.resolve(env.UPLOAD_DIR);

    for (const dossier of eligibleDossiers) {
      const filePaths = [];
      const allDocs = [...(dossier.documents || [])];
      (dossier.applicants || []).forEach((a) => {
        if (a.documents) allDocs.push(...a.documents);
      });

      allDocs.forEach((d) => {
        if (d.filePath && fs.existsSync(d.filePath)) {
          filePaths.push(d.filePath);
        } else if (d.fileUrl) {
          const localPath = path.join(uploadDir, path.basename(d.fileUrl));
          if (fs.existsSync(localPath)) filePaths.push(localPath);
        }
      });

      if (filePaths.length > 0) {
        const archive = await zipUtil.archiveDossierFiles(dossier.dossierNumber, filePaths);
        await prisma.dossier.update({
          where: { id: dossier.id },
          data: { archivedZipUrl: archive.fileUrl },
        });
        processedCount++;
      }
    }

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'DOSSIER_ARCHIVAL',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { archivedCount: processedCount },
      },
    });

    console.log(`[CRON] Dossier Auto-Archival completed: ${processedCount} dossiers archived.`);
    return { success: true, processedCount };
  } catch (error) {
    console.error('[CRON ERROR] Dossier Archival Job failed:', error);
    await prisma.cronTaskLog.create({
      data: {
        taskName: 'DOSSIER_ARCHIVAL',
        status: 'FAILED',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { error: error.message },
      },
    });
    return { success: false, error: error.message };
  }
}

/**
 * Worker 6: Outbound Message & Webhook Retry Queue
 */
async function runOutboundRetryJob() {
  const startedAt = new Date();
  console.log('[CRON] Running Outbound Message Retry Queue...');

  let processedCount = 0;
  try {
    const failedMessages = await prisma.outboundMessageLog.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 5 },
      },
      take: 20,
    });

    for (const msg of failedMessages) {
      processedCount++;
      const nextRetryCount = msg.retryCount + 1;

      if (msg.channel === 'SMS') {
        const res = await messagingService.sendSms({ to: msg.recipient, message: msg.subject || 'EuroTech Xatırlatma' });
        if (res.success) {
          await prisma.outboundMessageLog.update({
            where: { id: msg.id },
            data: { status: 'DELIVERED', retryCount: nextRetryCount, errorMsg: null },
          });
        } else {
          await prisma.outboundMessageLog.update({
            where: { id: msg.id },
            data: { retryCount: nextRetryCount },
          });
        }
      } else if (msg.channel === 'WHATSAPP') {
        const res = await messagingService.sendWhatsAppTemplate({
          to: msg.recipient,
          templateName: msg.template || 'status_update',
        });
        if (res.success) {
          await prisma.outboundMessageLog.update({
            where: { id: msg.id },
            data: { status: 'DELIVERED', retryCount: nextRetryCount, errorMsg: null },
          });
        } else {
          await prisma.outboundMessageLog.update({
            where: { id: msg.id },
            data: { retryCount: nextRetryCount },
          });
        }
      }
    }

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'WEBHOOK_RETRY',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { retriedCount: processedCount },
      },
    });

    return { success: true, processedCount };
  } catch (error) {
    console.error('[CRON ERROR] Retry Queue failed:', error);
    await prisma.cronTaskLog.create({
      data: {
        taskName: 'WEBHOOK_RETRY',
        status: 'FAILED',
        startedAt,
        finishedAt: new Date(),
        processedCount,
        detailsJson: { error: error.message },
      },
    });
    return { success: false, error: error.message };
  }
}

/**
 * Worker 7: Daily Financial Reconciliation
 */
async function runDailyFinancialReconciliationJob() {
  const startedAt = new Date();
  console.log('[CRON] Running Daily Financial Reconciliation...');

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: todayStart },
      },
    });

    const paidTx = transactions.filter((t) => t.status === 'PAID');
    const totalVolume = paidTx.reduce((sum, t) => sum + t.amount, 0);

    const stripeVolume = paidTx.filter((t) => t.paymentProvider === 'STRIPE').reduce((sum, t) => sum + t.amount, 0);
    const bankVolume = paidTx.filter((t) => t.paymentProvider !== 'STRIPE').reduce((sum, t) => sum + t.amount, 0);

    const summary = {
      date: todayStart.toISOString().split('T')[0],
      totalTransactions: transactions.length,
      paidCount: paidTx.length,
      totalVolumeEur: Number(totalVolume.toFixed(2)),
      stripeVolumeEur: Number(stripeVolume.toFixed(2)),
      bankVolumeEur: Number(bankVolume.toFixed(2)),
    };

    await prisma.cronTaskLog.create({
      data: {
        taskName: 'DAILY_RECONCILIATION',
        status: 'SUCCESS',
        startedAt,
        finishedAt: new Date(),
        processedCount: paidTx.length,
        detailsJson: summary,
      },
    });

    console.log(`[CRON] Daily Reconciliation complete: €${totalVolume} collected today.`);
    return { success: true, summary };
  } catch (error) {
    console.error('[CRON ERROR] Daily Reconciliation failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initializes and schedules all background cron workers
 */
function startScheduler() {
  console.log('⏰ [SCHEDULER] EuroTech Background Workers initializing...');

  // 1. Dossier Archival (Daily at 02:00 AM)
  cron.schedule('0 2 * * *', () => {
    runDossierArchivalJob();
  });

  // 2. Appointment Reminders (Hourly)
  cron.schedule('0 * * * *', () => {
    runAppointmentReminderJob();
  });

  // 3. Unpaid Slot Release & Expiration (Every 30 minutes)
  cron.schedule('*/30 * * * *', () => {
    runUnpaidDossierCleanupJob();
  });

  // 4. Agent Tier & Volume Recalculation (Weekly on Sunday at 03:00 AM)
  cron.schedule('0 3 * * 0', () => {
    runAgentTierRecalculationJob();
  });

  // 5. Passport Expiry Radar (Daily at 06:00 AM)
  cron.schedule('0 6 * * *', () => {
    runPassportRadarJob();
  });

  // 6. Outbound Retry Queue (Every 15 minutes)
  cron.schedule('*/15 * * * *', () => {
    runOutboundRetryJob();
  });

  // 7. Daily Financial Reconciliation (Daily at 23:59)
  cron.schedule('59 23 * * *', () => {
    runDailyFinancialReconciliationJob();
  });

  console.log('✅ [SCHEDULER] All EuroTech Cron Workers registered and active.');
}

module.exports = {
  startScheduler,
  runDossierArchivalJob,
  runAppointmentReminderJob,
  runUnpaidDossierCleanupJob,
  runAgentTierRecalculationJob,
  runPassportRadarJob,
  runOutboundRetryJob,
  runDailyFinancialReconciliationJob,
};
