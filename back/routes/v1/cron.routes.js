const express = require('express');
const router = express.Router();
const prisma = require('../../config/db');
const scheduler = require('../../cron/scheduler');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');
const ApiResponse = require('../../core/api.response');

router.use(authMiddleware);
router.use(requireRoles(['ADMIN', 'MANAGER']));

// View Cron Execution Logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.cronTaskLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return ApiResponse.success(res, { logs }, 'Cron execution history');
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
});

// Trigger a Cron Job on demand (Manual execution / Testing)
router.post('/run/:jobName', async (req, res) => {
  const { jobName } = req.params;
  try {
    let result;
    switch (jobName) {
      case 'passport-radar':
        result = await scheduler.runPassportRadarJob();
        break;
      case 'appointment-reminder':
        result = await scheduler.runAppointmentReminderJob();
        break;
      case 'unpaid-cleanup':
        result = await scheduler.runUnpaidDossierCleanupJob();
        break;
      case 'retry-queue':
        result = await scheduler.runOutboundRetryJob();
        break;
      case 'daily-reconciliation':
        result = await scheduler.runDailyFinancialReconciliationJob();
        break;
      default:
        return ApiResponse.error(res, `Unknown cron job '${jobName}'`, 400);
    }
    return ApiResponse.success(res, result, `Job '${jobName}' executed successfully`);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
});

module.exports = router;
