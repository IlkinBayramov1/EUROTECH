const assert = require('assert');
const path = require('path');
const fs = require('fs');
const prisma = require('./config/db');
const adminService = require('./modules/admin/admin.service');
const documentStorage = require('./modules/document/services/documentStorage.service');
const zipUtil = require('./utils/zip.util');

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

async function runPhase6Tests() {
  console.log('\n======================================================');
  console.log('--- PHASE 6 INTEGRATION TEST SUITE (ADMIN & CONSULATE) ---');
  console.log('======================================================\n');

  // Seed or lookup an admin user
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: `admin_phase6_${Date.now()}@eurotech.services`,
        passwordHash: 'hash',
        fullName: 'Consular Chief Officer',
        role: 'ADMIN',
      },
    });
  }

  // Seed or lookup an applicant user & country/visaCategory
  const clientUser = await prisma.user.findFirst({ where: { role: 'INDIVIDUAL' } }) || adminUser;
  const country = await prisma.country.findFirst({ where: { isActive: true } }) || 
    await prisma.country.create({
      data: { code: 'ES', nameAz: 'İspaniya', nameEn: 'Spain', nameRu: 'Испания', isActive: true },
    });
  const category = await prisma.visaCategory.findFirst({ where: { countryId: country.id } }) ||
    await prisma.visaCategory.create({
      data: { countryId: country.id, code: 'TOURISM', nameAz: 'Turizm', nameEn: 'Tourism', nameRu: 'Туризм' },
    });

  // 1. Dashboard Metrics
  await itAsync('1. Admin Metrics returns structured KPI data', async () => {
    const metrics = await adminService.getDashboardMetrics();
    assert(typeof metrics.activeDossiers === 'number', 'activeDossiers should be a number');
    assert(typeof metrics.underReviewCount === 'number', 'underReviewCount should be a number');
    assert(typeof metrics.approvedThisMonth === 'number', 'approvedThisMonth should be a number');
    assert(typeof metrics.totalRevenue === 'number', 'totalRevenue should be a number');
  });

  // 2. Dossiers List Filtering & Pagination
  await itAsync('2. Dossiers list handles pagination and filters', async () => {
    const result = await adminService.getAllDossiers({ page: 1, limit: 5 });
    assert(result.dossiers, 'dossiers array should exist');
    assert(typeof result.total === 'number', 'total count should be number');
    assert(result.limit === 5, 'limit should be 5');
  });

  // 3. System Settings Configuration & Upsert
  await itAsync('3. System Settings load defaults and can be updated', async () => {
    const initial = await adminService.getSystemSettings();
    assert(initial.settings.eurToAznRate, 'eurToAznRate should exist in settings');

    const updated = await adminService.updateSystemSettings({
      eurToAznRate: '1.87',
      sessionTimeout: '20',
    });

    assert.strictEqual(updated.settings.eurToAznRate, '1.87', 'eurToAznRate should be updated');
    assert.strictEqual(updated.settings.sessionTimeout, '20', 'sessionTimeout should be updated');

    // Restore standard rate
    await adminService.updateSystemSettings({ eurToAznRate: '1.85', sessionTimeout: '15' });
  });

  // 4. Master Data CRUD (Country, VisaCategory, TimeSlot)
  let testCountryId = null;
  let testCategoryId = null;
  let testSlotId = null;

  await itAsync('4. Master Data: saveCountry creates and updates countries', async () => {
    const c = await adminService.saveCountry({
      code: 'PT',
      nameAz: 'Portuqaliya',
      nameEn: 'Portugal',
      isActive: true,
    });
    testCountryId = c.id;
    assert.strictEqual(c.code, 'PT');

    const updatedC = await adminService.saveCountry({
      id: c.id,
      code: 'PT',
      nameAz: 'Portuqaliya (Yeniləndi)',
      nameEn: 'Portugal',
      isActive: true,
    });
    assert.strictEqual(updatedC.nameAz, 'Portuqaliya (Yeniləndi)');
  });

  await itAsync('5. Master Data: saveVisaCategory creates and updates categories', async () => {
    const cat = await adminService.saveVisaCategory({
      countryId: testCountryId,
      code: 'BUSINESS_EXP',
      nameAz: 'Biznes Ekskursiya',
      nameEn: 'Business Expedited',
    });
    testCategoryId = cat.id;
    assert.strictEqual(cat.code, 'BUSINESS_EXP');
  });

  await itAsync('6. Master Data: saveTimeSlot creates appointment slots', async () => {
    const slot = await adminService.saveTimeSlot({
      date: '2026-11-20',
      startTime: '10:00',
      capacity: 15,
      location: 'Baku Central Consular Hub',
    });
    testSlotId = slot.id;
    assert.strictEqual(slot.startTime, '10:00');
    assert.strictEqual(slot.capacity, 15);
  });

  // 7. Integrations & Live Health Diagnostics
  await itAsync('7. Integrations Health returns database and storage telemetry', async () => {
    const health = await adminService.getIntegrationsHealth();
    assert(health.status === 'HEALTHY' || health.status === 'DEGRADED', 'Health status should be valid');
    assert.strictEqual(health.services.database.status, 'ONLINE');
    assert.strictEqual(health.services.storage.status, 'WRITABLE');
    assert.strictEqual(health.services.consularSchengenEngine.status, 'OPERATIONAL');
  });

  // 8. Financial Approvals: Bank Payment Receipts
  let testDossier = null;
  let testReceipt = null;

  await itAsync('8. Bank Slip Review: Create pending receipt and approve', async () => {
    testDossier = await prisma.dossier.create({
      data: {
        dossierNumber: `EUR-TEST-BANK-${Date.now()}`,
        portalType: 'INDIVIDUAL',
        userId: clientUser.id,
        countryId: country.id,
        visaCategoryId: category.id,
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        totalAmount: 180.0,
      },
    });

    const pendingAppt = await prisma.appointment.create({
      data: {
        dossierId: testDossier.id,
        timeSlotId: testSlotId,
        userId: clientUser.id,
        location: 'Baku Consular Hub',
        status: 'PENDING_PAYMENT',
      },
    });

    testReceipt = await prisma.bankPaymentReceipt.create({
      data: {
        dossierId: testDossier.id,
        userId: clientUser.id,
        amount: 180.0,
        currency: 'EUR',
        referenceCode: `WIRE-REF-${Date.now()}`,
        fileName: 'bank_receipt_test.pdf',
        fileUrl: '/uploads/bank_receipt_test.pdf',
        status: 'PENDING',
      },
    });

    const slips = await adminService.getBankSlips();
    const found = slips.find((s) => s.id === testReceipt.id);
    assert(found, 'Created receipt should appear in bank slips list');
    assert.strictEqual(found.status, 'PENDING');

    // Approve receipt
    const reviewed = await adminService.reviewBankSlip(
      testReceipt.id,
      'APPROVED',
      'Bank wire confirmed by accountant',
      adminUser.id
    );

    assert(reviewed.status === 'PAID' || reviewed.status === 'APPROVED', 'Receipt should be marked PAID/APPROVED');

    // Verify dossier was marked PAID and moved to UNDER_REVIEW
    const updatedDossier = await prisma.dossier.findUnique({ where: { id: testDossier.id } });
    assert.strictEqual(updatedDossier.paymentStatus, 'PAID', 'Dossier should be PAID');
    assert.strictEqual(updatedDossier.status, 'UNDER_REVIEW', 'Dossier should be UNDER_REVIEW');

    // Verify appointment was confirmed
    const updatedAppt = await prisma.appointment.findUnique({ where: { id: pendingAppt.id } });
    assert.strictEqual(updatedAppt.status, 'CONFIRMED', 'Appointment should be confirmed on wire approval');

    // Verify transaction record was created
    const tx = await prisma.transaction.findFirst({
      where: { dossierId: testDossier.id, paymentProvider: 'BANK_TRANSFER' },
    });
    assert(tx, 'Transaction record should exist for approved wire payment');
    assert.strictEqual(tx.status, 'PAID');
  });

  await itAsync('9. Bank Slip Review: Rejection sets paymentStatus PENDING', async () => {
    const rejectDossier = await prisma.dossier.create({
      data: {
        dossierNumber: `EUR-TEST-REJECT-${Date.now()}`,
        portalType: 'INDIVIDUAL',
        userId: clientUser.id,
        countryId: country.id,
        visaCategoryId: category.id,
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        totalAmount: 120.0,
      },
    });

    const rejectReceipt = await prisma.bankPaymentReceipt.create({
      data: {
        dossierId: rejectDossier.id,
        userId: clientUser.id,
        amount: 120.0,
        currency: 'EUR',
        referenceCode: `FAKE-WIRE-${Date.now()}`,
        fileName: 'fake_slip.pdf',
        fileUrl: '/uploads/fake_slip.pdf',
        status: 'PENDING',
      },
    });

    await adminService.reviewBankSlip(
      rejectReceipt.id,
      'REJECTED',
      'Invalid bank transaction code',
      adminUser.id
    );

    const updated = await prisma.dossier.findUnique({ where: { id: rejectDossier.id } });
    assert.strictEqual(updated.paymentStatus, 'PENDING', 'Rejected slip keeps dossier PENDING');

    // Cleanup
    await prisma.bankPaymentReceipt.delete({ where: { id: rejectReceipt.id } });
    await prisma.dossier.delete({ where: { id: rejectDossier.id } });
  });

  // 9. Financial Approvals: Agent Payout Requests & Double-Refund Protection
  let agentWallet = null;
  let testPayout = null;

  await itAsync('10. Agent Payout: Processing settles withdrawal', async () => {
    const agentUser = await prisma.user.create({
      data: {
        email: `agent_payout_${Date.now()}@eurotech.services`,
        passwordHash: 'hash',
        fullName: 'Baku Voyage Operator',
        role: 'AGENT_TUR_OPERATOR',
      },
    });

    agentWallet = await prisma.wallet.create({
      data: {
        userId: agentUser.id,
        balance: 1500.0,
      },
    });

    testPayout = await prisma.payoutRequest.create({
      data: {
        walletId: agentWallet.id,
        amount: 500.0,
        bankName: 'Pasha Bank ASC',
        iban: 'AZ21PASHA000123456789012345',
        swiftBic: 'PASHAZ22',
        status: 'PENDING',
      },
    });

    const payouts = await adminService.getAgentPayouts();
    const found = payouts.find((p) => p.id === testPayout.id);
    assert(found, 'Payout request should be listed');
    assert.strictEqual(found.amount, 500.0);

    // Process payout
    const processed = await adminService.updateAgentPayoutStatus(testPayout.id, 'PROCESSED');
    assert.strictEqual(processed.status, 'PROCESSED');

    // Double-process attempt must fail
    let doubleProcessFailed = false;
    try {
      await adminService.updateAgentPayoutStatus(testPayout.id, 'PROCESSED');
    } catch (e) {
      doubleProcessFailed = true;
    }
    assert(doubleProcessFailed, 'Subsequent update on already processed payout must throw error');
  });

  await itAsync('11. Agent Payout: Rejection refunds balance and prevents double-refund', async () => {
    const payoutToReject = await prisma.payoutRequest.create({
      data: {
        walletId: agentWallet.id,
        amount: 300.0,
        bankName: 'Kapital Bank',
        iban: 'AZ99KAPITAL1234567890123456',
        swiftBic: 'KAPIAZ22',
        status: 'PENDING',
      },
    });

    const initialBalance = (await prisma.wallet.findUnique({ where: { id: agentWallet.id } })).balance;

    const rejected = await adminService.updateAgentPayoutStatus(payoutToReject.id, 'REJECTED');
    assert.strictEqual(rejected.status, 'REJECTED');

    const refundedBalance = (await prisma.wallet.findUnique({ where: { id: agentWallet.id } })).balance;
    assert.strictEqual(
      refundedBalance,
      initialBalance + 300.0,
      'Wallet balance should be refunded on rejection'
    );

    // Double-rejection attempt must fail
    let doubleRejectFailed = false;
    try {
      await adminService.updateAgentPayoutStatus(payoutToReject.id, 'REJECTED');
    } catch (e) {
      doubleRejectFailed = true;
    }
    assert(doubleRejectFailed, 'Attempting to reject an already rejected payout must throw error');

    // Cleanup
    await prisma.payoutRequest.delete({ where: { id: payoutToReject.id } });
  });

  // 12. Security Audit Logs Retrieval & Review Document Hook
  await itAsync('12. Audit Logs: getAuditLogs returns paginated logs and records reviews', async () => {
    const logs = await adminService.getAuditLogs({ page: 1, limit: 10 });
    assert(Array.isArray(logs.logs), 'logs should be an array');
    assert(typeof logs.total === 'number', 'total should be a number');

    // Test document review triggers audit log
    const testDoc = await prisma.applicantDocument.create({
      data: {
        dossierId: testDossier.id,
        requiredDocumentType: 'PASSPORT_SCAN',
        fileName: 'passport_scan.jpg',
        fileUrl: '/uploads/passport_scan.jpg',
        fileSize: 10240,
        status: 'PENDING',
      },
    });

    await documentStorage.reviewDocument(
      testDoc.id,
      'VERIFIED',
      'MRZ data verified against passport database',
      adminUser.id
    );

    const updatedDoc = await prisma.applicantDocument.findUnique({ where: { id: testDoc.id } });
    assert.strictEqual(updatedDoc.status, 'VERIFIED');

    const docAuditLog = await prisma.auditLog.findFirst({
      where: { action: 'DOCUMENT_REVIEWED', userId: adminUser.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(docAuditLog, 'DOCUMENT_REVIEWED audit log entry should exist');
  });

  // 13. Dossier Archive ZIP Generation
  await itAsync('13. Dossier Archive ZIP: Creates valid archive package', async () => {
    // Create a temporary sample file to archive
    const env = require('./config/env');
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const sampleFile = path.join(uploadDir, `archive_sample_${Date.now()}.txt`);
    fs.writeFileSync(sampleFile, 'Official Consular Dossier File Content');

    const archiveResult = await zipUtil.archiveDossierFiles(testDossier.dossierNumber, [sampleFile]);
    assert(archiveResult.fileName.includes(testDossier.dossierNumber), 'ZIP name should include dossierNumber');
    assert(fs.existsSync(archiveResult.filePath), 'ZIP file should exist on disk');

    const stats = fs.statSync(archiveResult.filePath);
    assert(stats.size > 0, 'ZIP file size should be greater than zero');

    // Cleanup sample file and zip
    if (fs.existsSync(sampleFile)) fs.unlinkSync(sampleFile);
    if (fs.existsSync(archiveResult.filePath)) fs.unlinkSync(archiveResult.filePath);
  });

  // 14. Cron Monitor Diagnostics
  await itAsync('14. Cron Monitor Status returns 5 background daemon jobs', async () => {
    const cronStatus = await adminService.getCronMonitorStatus();
    assert(cronStatus.jobs, 'jobs array should exist');
    assert.strictEqual(cronStatus.jobs.length, 5, 'Exactly 5 scheduled cron jobs should be monitored');
    const jobIds = cronStatus.jobs.map((j) => j.id);
    assert(jobIds.includes('dossier-archival'), 'dossier-archival should be present');
    assert(jobIds.includes('appointment-reminders'), 'appointment-reminders should be present');
    assert(jobIds.includes('unpaid-cancellation'), 'unpaid-cancellation should be present');
    assert(jobIds.includes('agent-tier-recalculation'), 'agent-tier-recalculation should be present');
    assert(jobIds.includes('passport-expiry-radar'), 'passport-expiry-radar should be present');
  });

  // Cleanup created test records
  try {
    if (testPayout) await prisma.payoutRequest.deleteMany({ where: { walletId: agentWallet.id } });
    if (agentWallet) {
      const uId = agentWallet.userId;
      await prisma.wallet.delete({ where: { id: agentWallet.id } });
      await prisma.user.delete({ where: { id: uId } });
    }
    if (testReceipt) await prisma.bankPaymentReceipt.deleteMany({ where: { dossierId: testDossier.id } });
    if (testDossier) {
      await prisma.appointment.deleteMany({ where: { dossierId: testDossier.id } });
      await prisma.transaction.deleteMany({ where: { dossierId: testDossier.id } });
      await prisma.applicantDocument.deleteMany({ where: { dossierId: testDossier.id } });
      await prisma.dossier.delete({ where: { id: testDossier.id } });
    }
    if (testSlotId) await prisma.timeSlot.delete({ where: { id: testSlotId } });
    if (testCategoryId) await prisma.visaCategory.delete({ where: { id: testCategoryId } });
    if (testCountryId) await prisma.country.delete({ where: { id: testCountryId } });
  } catch (cleanErr) {
    console.warn('Cleanup warning:', cleanErr.message);
  }

  console.log('\n======================================================');
  console.log(`PHASE 6 TEST RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log('======================================================\n');

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase6Tests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
