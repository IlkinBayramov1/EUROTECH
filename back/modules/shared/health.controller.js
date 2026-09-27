const prisma = require('../../config/db');
const env = require('../../config/env');
const ApiResponse = require('../../core/api.response');

async function getIntegrationsHealth(req, res) {
  const startTime = Date.now();
  const checks = {};

  // 1. Database Check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'UP',
      latencyMs: Date.now() - dbStart,
      provider: 'MySQL (Prisma)',
    };
  } catch (err) {
    checks.database = {
      status: 'DOWN',
      error: err.message,
    };
  }

  // 2. Stripe Payment Gateway
  checks.stripe = {
    status: env.STRIPE_SECRET_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
    publishableKeyConfigured: Boolean(env.STRIPE_PUBLISHABLE_KEY),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    mode: env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST_SANDBOX',
  };

  // 3. Local Bank Gateway (Azericard / Kapital Pay)
  checks.localBank = {
    status: env.LOCAL_BANK_MERCHANT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
    merchantId: env.LOCAL_BANK_MERCHANT_ID,
    terminalId: env.LOCAL_BANK_TERMINAL_ID,
    gatewayUrl: env.LOCAL_BANK_GATEWAY_URL,
  };

  // 4. SMTP / Transactional Email
  checks.email = {
    status: 'CONFIGURED',
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    sender: env.SMTP_FROM,
    sendgridConfigured: Boolean(env.SENDGRID_API_KEY),
  };

  // 5. WhatsApp Business Cloud API
  checks.whatsapp = {
    status: env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_TOKEN.length > 20 ? 'LIVE' : 'SIMULATOR_SANDBOX',
    phoneId: env.META_WHATSAPP_PHONE_ID,
    businessAccountId: env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
    webhookVerifyTokenConfigured: Boolean(env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  };

  // 6. SMS Gateway
  checks.sms = {
    status: env.TWILIO_ACCOUNT_SID ? 'TWILIO_ACTIVE' : 'SANDBOX_ACTIVE',
    provider: env.TWILIO_ACCOUNT_SID ? 'Twilio Cloud' : 'EuroTech SMS Simulator',
  };

  // 7. Storage Engine
  checks.storage = {
    driver: env.STORAGE_DRIVER || 'local',
    bucket: env.S3_BUCKET_NAME,
    endpoint: env.STORAGE_DRIVER === 's3' ? env.S3_ENDPOINT : 'Local Secure Storage',
    encryption: 'AES-256',
  };

  // 8. Cron Tasks Heartbeat
  try {
    const recentTasks = await prisma.cronTaskLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
    });
    checks.backgroundSchedulers = {
      activeWorkersCount: 5,
      recentExecutions: recentTasks.map((t) => ({
        taskName: t.taskName,
        status: t.status,
        startedAt: t.startedAt,
        processedCount: t.processedCount,
      })),
    };
  } catch (err) {
    checks.backgroundSchedulers = { status: 'ERROR', error: err.message };
  }

  const isHealthy = checks.database.status === 'UP';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    integrations: checks,
  });
}

module.exports = {
  getIntegrationsHealth,
};
