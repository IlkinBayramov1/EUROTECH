const assert = require('assert');
const path = require('path');
const fs = require('fs');
const prisma = require('./config/db');
const scheduler = require('./cron/scheduler');

let testPassed = 0;
let testFailed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    testPassed++;
  } catch (err) {
    console.error(`  ✕ ${desc}`);
    console.error(`    ${err.message}`);
    testFailed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    testPassed++;
  } catch (err) {
    console.error(`  ✕ ${desc}`);
    console.error(`    ${err.message}`);
    testFailed++;
  }
}

async function runPhase7Tests() {
  console.log('\n======================================================');
  console.log('--- PHASE 7 INTEGRATION TEST SUITE (CRONS, DEVOPS & BACKUPS) ---');
  console.log('======================================================\n');

  // 1. Cron Worker: Dossier Auto-Archival
  await itAsync('1. Cron: runDossierArchivalJob runs cleanly and logs task', async () => {
    const res = await scheduler.runDossierArchivalJob();
    assert.strictEqual(res.success, true);
    assert(typeof res.processedCount === 'number');

    const log = await prisma.cronTaskLog.findFirst({
      where: { taskName: 'DOSSIER_ARCHIVAL' },
      orderBy: { startedAt: 'desc' },
    });
    assert(log, 'DOSSIER_ARCHIVAL task log should exist');
    assert.strictEqual(log.status, 'SUCCESS');
  });

  // 2. Cron Worker: Appointment Reminders
  await itAsync('2. Cron: runAppointmentReminderJob executes with deduplication logic', async () => {
    const res = await scheduler.runAppointmentReminderJob();
    assert.strictEqual(res.success, true);

    const log = await prisma.cronTaskLog.findFirst({
      where: { taskName: 'APPOINTMENT_REMINDER' },
      orderBy: { startedAt: 'desc' },
    });
    assert(log, 'APPOINTMENT_REMINDER task log should exist');
    assert.strictEqual(log.status, 'SUCCESS');
  });

  // 3. Cron Worker: Unpaid Dossier Cleanup & Slot Release
  await itAsync('3. Cron: runUnpaidDossierCleanupJob executes and releases expired quotas', async () => {
    const res = await scheduler.runUnpaidDossierCleanupJob();
    assert.strictEqual(res.success, true);

    const log = await prisma.cronTaskLog.findFirst({
      where: { taskName: 'UNPAID_DOSSIER_CLEANUP' },
      orderBy: { startedAt: 'desc' },
    });
    assert(log, 'UNPAID_DOSSIER_CLEANUP task log should exist');
    assert.strictEqual(log.status, 'SUCCESS');
  });

  // 4. Cron Worker: Agent Tier Recalculation
  await itAsync('4. Cron: runAgentTierRecalculationJob recalculates passenger volume', async () => {
    const res = await scheduler.runAgentTierRecalculationJob();
    assert.strictEqual(res.success, true);

    const log = await prisma.cronTaskLog.findFirst({
      where: { taskName: 'AGENT_TIER_RECALCULATION' },
      orderBy: { startedAt: 'desc' },
    });
    assert(log, 'AGENT_TIER_RECALCULATION task log should exist');
    assert.strictEqual(log.status, 'SUCCESS');
  });

  // 5. Cron Worker: Passport Radar Job
  await itAsync('5. Cron: runPassportRadarJob scans employees and aggregates HR alerts', async () => {
    const res = await scheduler.runPassportRadarJob();
    assert.strictEqual(res.success, true);

    const log = await prisma.cronTaskLog.findFirst({
      where: { taskName: 'PASSPORT_RADAR' },
      orderBy: { startedAt: 'desc' },
    });
    assert(log, 'PASSPORT_RADAR task log should exist');
    assert.strictEqual(log.status, 'SUCCESS');
  });

  // 6. Cron Worker: Outbound Retry Queue
  await itAsync('6. Cron: runOutboundRetryJob runs without error', async () => {
    const res = await scheduler.runOutboundRetryJob();
    assert.strictEqual(res.success, true);
  });

  // 7. Cron Worker: Daily Financial Reconciliation
  await itAsync('7. Cron: runDailyFinancialReconciliationJob computes settlement metrics', async () => {
    const res = await scheduler.runDailyFinancialReconciliationJob();
    assert.strictEqual(res.success, true);
    assert(res.summary, 'Summary should contain daily financial metrics');
  });

  // 8. Cron Scheduler Daemon Initialization
  it('8. Scheduler: startScheduler registers all cron tasks without throwing', () => {
    scheduler.startScheduler();
  });

  // 9. Docker Configuration Verification
  it('9. DevOps: Dockerfiles and .dockerignore files are properly configured', () => {
    const backDocker = path.resolve(__dirname, 'Dockerfile');
    const frontDocker = path.resolve(__dirname, '../front/Dockerfile');
    const backIgnore = path.resolve(__dirname, '.dockerignore');
    const frontIgnore = path.resolve(__dirname, '../front/.dockerignore');
    const dockerCompose = path.resolve(__dirname, '../docker-compose.yml');

    assert(fs.existsSync(backDocker), 'Backend Dockerfile should exist');
    assert(fs.existsSync(frontDocker), 'Frontend Dockerfile should exist');
    assert(fs.existsSync(backIgnore), 'Backend .dockerignore should exist');
    assert(fs.existsSync(frontIgnore), 'Frontend .dockerignore should exist');
    assert(fs.existsSync(dockerCompose), 'docker-compose.yml should exist');

    const composeContent = fs.readFileSync(dockerCompose, 'utf8');
    assert(composeContent.includes('backend:'), 'compose should define backend service');
    assert(composeContent.includes('frontend:'), 'compose should define frontend service');
    assert(composeContent.includes('mysql:'), 'compose should define mysql service');
  });

  // 10. Nginx Configuration Verification
  it('10. DevOps: Nginx config includes proxy rules for /api/, /uploads/, /archives/ and SPA routing', () => {
    const nginxConf = path.resolve(__dirname, '../front/nginx.conf');
    assert(fs.existsSync(nginxConf), 'nginx.conf should exist');
    const conf = fs.readFileSync(nginxConf, 'utf8');
    assert(conf.includes('location /api/'), 'nginx should proxy /api/');
    assert(conf.includes('location /uploads/'), 'nginx should proxy /uploads/');
    assert(conf.includes('location /archives/'), 'nginx should proxy /archives/');
    assert(conf.includes('try_files $uri $uri/ /index.html;'), 'nginx should include SPA fallback');
  });

  // 11. Database Backup & Disaster Recovery Scripts
  it('11. DevOps: Backup & Restore scripts exist with parameters and retention logic', () => {
    const psBackup = path.resolve(__dirname, '../scripts/backup-db.ps1');
    const psRestore = path.resolve(__dirname, '../scripts/restore-db.ps1');
    const shBackup = path.resolve(__dirname, '../scripts/backup-db.sh');
    const shRestore = path.resolve(__dirname, '../scripts/restore-db.sh');

    assert(fs.existsSync(psBackup), 'backup-db.ps1 should exist');
    assert(fs.existsSync(psRestore), 'restore-db.ps1 should exist');
    assert(fs.existsSync(shBackup), 'backup-db.sh should exist');
    assert(fs.existsSync(shRestore), 'restore-db.sh should exist');

    const psBackupContent = fs.readFileSync(psBackup, 'utf8');
    assert(psBackupContent.includes('SHA256'), 'PowerShell backup should compute SHA256');
    assert(psBackupContent.includes('Retention Policy'), 'PowerShell backup should include retention policy');
  });

  console.log('\n======================================================');
  console.log(`PHASE 7 TEST RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log('======================================================\n');

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase7Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
