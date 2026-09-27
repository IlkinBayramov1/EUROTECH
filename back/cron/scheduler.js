const cron = require('node-cron');
const prisma = require('../config/db');
const notificationService = require('../modules/notification/notification.service');
const messagingService = require('../services/messaging.service');

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
            hrEmail: emp.corporateUser.email,
            hrFullName: emp.corporateUser.fullName,
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
          await messagingService.sendSms({ to: emp.phone, message: smsText });
        }
      }
    }

    // Dispatch digest emails to Corporate HRs
    for (const hrId of Object.keys(hrGroups)) {
      const group = hrGroups[hrId];
      await notificationService.sendCorporateExpiryRadarNotification({
        hrEmail: group.hrEmail,
        hrFullName: group.hrFullName,
        expiringEmployees: group.employees,
      });
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

      // T-24 Hours Reminder (22 to 26 hours window)
      if (diffHours >= 22 && diffHours <= 26) {
        processedCount++;
        const message = `EuroTech Xatırlatma: Hörmətli ${app.user.fullName}, sabah saat ${app.timeSlot.startTime}-da ${app.location || 'Viza Mərkəzi'}-də görüşünüz var. Zəhmət olmasa xarici pasport və zəruri sənədlərinizi unutmayın.`;
        if (app.user.phone) {
          await messagingService.sendWhatsAppTemplate({
            to: app.user.phone,
            templateName: 'appointment_reminder_24h',
            bodyParameters: [app.user.fullName, app.timeSlot.startTime, app.location || 'EuroTech Mərkəzi'],
          });
          await messagingService.sendSms({ to: app.user.phone, message });
        }
      }

      // T-2 Hours Urgent Reminder (1 to 3 hours window)
      if (diffHours >= 1 && diffHours <= 3) {
        processedCount++;
        const urgentSms = `EuroTech Təcili Xatırlatma: Hörmətli ${app.user.fullName}, viza mərkəzindəki görüşünüzə 2 saat qaldı (${app.timeSlot.startTime}). Mərkəz: ${app.location || 'EuroTech Mərkəzi'}.`;
        if (app.user.phone) {
          await messagingService.sendSms({ to: app.user.phone, message: urgentSms });
        }
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
  console.log('[CRON] Running Unpaid Dossier Cleanup...');

  let processedCount = 0;
  const thresholdTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

  try {
    const expiredDossiers = await prisma.dossier.findMany({
      where: {
        paymentStatus: 'PENDING',
        status: 'RECEIVED',
        createdAt: { lt: thresholdTime },
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
            data: { status: 'CANCELLED', notes: '48 saat ərzində ödəniş edilmədiyi üçün avtomatik ləğv edildi.' },
          });
        }
      }

      await prisma.dossierStatusHistory.create({
        data: {
          dossierId: dossier.id,
          fromStatus: dossier.status,
          toStatus: dossier.status,
          changedByUserId: dossier.userId,
          notes: 'Ödəniş 48 saat ərzində tamamlanmadığı üçün rezerv olunmuş görüş kvotası sərbəst buraxıldı.',
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
 * Worker 4: Outbound Message & Webhook Retry Queue
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
 * Worker 5: Daily Financial Reconciliation
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

  // 1. Passport Radar (Daily at 08:00 AM)
  cron.schedule('0 8 * * *', () => {
    runPassportRadarJob();
  });

  // 2. Appointment Reminders (Hourly)
  cron.schedule('0 * * * *', () => {
    runAppointmentReminderJob();
  });

  // 3. Unpaid Dossier Cleanup (Every 6 hours)
  cron.schedule('0 */6 * * *', () => {
    runUnpaidDossierCleanupJob();
  });

  // 4. Outbound Retry Queue (Every 15 minutes)
  cron.schedule('*/15 * * * *', () => {
    runOutboundRetryJob();
  });

  // 5. Daily Financial Reconciliation (Daily at 23:59)
  cron.schedule('59 23 * * *', () => {
    runDailyFinancialReconciliationJob();
  });

  console.log('✅ [SCHEDULER] All 5 Cron Jobs registered and active.');
}

module.exports = {
  startScheduler,
  runPassportRadarJob,
  runAppointmentReminderJob,
  runUnpaidDossierCleanupJob,
  runOutboundRetryJob,
  runDailyFinancialReconciliationJob,
};
