const http = require('http');
const assert = require('assert');
const bcrypt = require('bcryptjs');
const app = require('./app');
const prisma = require('./config/db');

function makeClient(port) {
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  return function request(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl + path);
      const headers = {};
      let bodyData = null;

      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (data) {
        headers['Content-Type'] = 'application/json';
        bodyData = JSON.stringify(data);
        headers['Content-Length'] = Buffer.byteLength(bodyData);
      }

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(raw) });
            } catch {
              resolve({ status: res.statusCode, body: raw });
            }
          });
        }
      );
      req.on('error', reject);
      if (bodyData) req.write(bodyData);
      req.end();
    });
  };
}

async function cleanupCorporateUser(userId) {
  if (!userId) return;
  try {
    const batches = await prisma.groupBatch.findMany({ where: { userId }, select: { id: true } });
    const bIds = batches.map((b) => b.id);
    const dossiers = await prisma.dossier.findMany({ where: { userId }, select: { id: true } });
    const dIds = dossiers.map((d) => d.id);

    if (bIds.length) {
      await prisma.appointment.deleteMany({ where: { groupBatchId: { in: bIds } } });
      await prisma.corporateInvoice.deleteMany({ where: { groupBatchId: { in: bIds } } });
      await prisma.bankPaymentReceipt.deleteMany({ where: { groupBatchId: { in: bIds } } });
    }
    if (dIds.length) {
      await prisma.additionalService.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.applicant.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.appointment.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.transaction.deleteMany({ where: { dossierId: { in: dIds } } });
    }
    await prisma.corporateInvoice.deleteMany({ where: { corporateUserId: userId } });
    await prisma.corporateDepartment.deleteMany({ where: { corporateUserId: userId } });
    const emps = await prisma.corporateEmployee.findMany({ where: { corporateUserId: userId }, select: { id: true } });
    if (emps.length) {
      await prisma.visaRecord.deleteMany({ where: { employeeId: { in: emps.map((e) => e.id) } } });
      await prisma.corporateEmployee.deleteMany({ where: { corporateUserId: userId } });
    }
    await prisma.bankPaymentReceipt.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.dossier.deleteMany({ where: { userId } });
    await prisma.groupBatch.deleteMany({ where: { userId } });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
      await prisma.payoutRequest.deleteMany({ where: { walletId: wallet.id } });
      await prisma.wallet.delete({ where: { id: wallet.id } });
    }
    await prisma.refreshTokenSession.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

async function run() {
  console.log('===============================================================');
  console.log(' EUROTECH WALLET OVERHAUL — PHASE 2 (CORPORATE PORTAL) TESTS');
  console.log('===============================================================\n');

  let server;
  let corpUser = null;
  let adminUser = null;

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    const request = makeClient(port);

    const passwordHash = await bcrypt.hash('CorpPass123!', 10);
    const ts = Date.now();
    corpUser = await prisma.user.create({
      data: {
        email: `corp.p2.${ts}@eurotech.test`,
        passwordHash,
        fullName: 'Ilkin HR Director',
        companyName: 'SOCAR Tech Mobility',
        taxId: 'AZ-99001122',
        role: 'CORPORATE_HR',
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });
    adminUser = await prisma.user.create({
      data: {
        email: `admin.p2.${ts}@eurotech.test`,
        passwordHash,
        fullName: 'Finance Controller',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });

    const corpLogin = await request('POST', '/auth/login', {
      email: corpUser.email,
      password: 'CorpPass123!',
      expectedRole: 'CORPORATE_HR',
    });
    assert.strictEqual(corpLogin.status, 200);
    const corpToken = corpLogin.body.data.accessToken;

    const adminLogin = await request('POST', '/auth/login', {
      email: adminUser.email,
      password: 'CorpPass123!',
      expectedRole: 'ADMIN',
    });
    const adminToken = adminLogin.body.data.accessToken;

    // Create Engineering department to track spentBudget
    const deptRes = await request(
      'POST',
      '/corporate/departments',
      { name: 'Engineering', annualBudget: 10000 },
      corpToken
    );
    assert.strictEqual(deptRes.status, 201);

    // 1. Reproduce Screenshot 4 scenario (including DD.MM.YYYY & malformed fallback date check)
    console.log('[1/5] Testing Corporate 5-Step Batch Creation (Safe Dates & Unified €813 Pricing)...');
    const batchRes = await request(
      'POST',
      '/corporate/batches',
      {
        name: 'Berlin Engineering Summit',
        destination: 'Hungary',
        travelDate: '2026-12-10',
        duration: 'short',
        projectReason: 'Tech Conference',
        package: 'premium',
        appointmentDate: '2026-11-20',
        appointmentTime: '10:30 AM',
        employees: [
          {
            firstName: 'Ali',
            lastName: 'Mammadov',
            passportNumber: 'C10293847',
            dob: '1992-05-14',
            issueDate: '2021-05-14',
            expiryDate: '2031-05-14',
            department: 'Engineering',
            role: 'Senior Engineer',
          },
          {
            firstName: 'Leyla',
            lastName: 'Aliyeva',
            passportNumber: 'C20394857',
            dob: '22.10.1995', // European DD.MM.YYYY format
            issueDate: '2022-10-22',
            expiryDate: '22.10.2032',
            department: 'Engineering',
            role: 'Architect',
          },
          {
            firstName: 'Rashad',
            lastName: 'Hasanov',
            passportNumber: 'C30495867',
            dob: 'NOT_A_DATE_FALLBACK_NULL', // Even if garbage arrives via raw API, must NOT crash Prisma!
            issueDate: '2020-01-01',
            expiryDate: '2029-03-30',
            department: 'Engineering',
            role: 'DevOps Lead',
          },
        ],
      },
      corpToken
    );
    assert.strictEqual(batchRes.status, 201, `Batch creation failed: ${JSON.stringify(batchRes.body)}`);
    const createdBatch = batchRes.body.data.batch;
    assert.strictEqual(createdBatch.totalEmployees, 3);
    assert.strictEqual(createdBatch.invoice.amount, 813, '3 employees x (€145 + €126) must equal €813.00');
    console.log('  -> Batch & Proforma Invoice (€813.00 for 3 employees) created without crash ✔️');

    // 2. Verify Dashboard & Invoices visibility immediately after Step 5 (Screenshots 3 & 5)
    console.log('[2/5] Verifying Corporate Dashboard & Billing Invoices after Step 5...');
    const dashRes = await request('GET', '/corporate/dashboard/stats', null, corpToken);
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.body.data.stats.activeBatches, 1);
    assert.strictEqual(dashRes.body.data.recentBatches[0].hasPendingInvoice, true);

    const invListRes = await request('GET', '/corporate/invoices', null, corpToken);
    assert.strictEqual(invListRes.status, 200);
    const inv1 = invListRes.body.data.invoices[0];
    assert.strictEqual(inv1.status, 'PENDING');
    assert.strictEqual(inv1.amount, 813);
    assert.strictEqual(inv1.applicantsCount, 3);
    console.log('  -> Dashboard shows 1 Active Batch + Pending Invoice (€813.00, 3 employees) ✔️');

    // 3. Fund Corporate Wallet via Card (€600) + Bank Wire Slip (€500)
    console.log('[3/5] Testing Corporate Wallet Deposit (Card €600 + Bank Wire Slip €500)...');
    const cardTopup = await request('POST', '/corporate/wallet/topup', { amount: 600, method: 'CARD' }, corpToken);
    assert.strictEqual(cardTopup.status, 200);
    assert.strictEqual(cardTopup.body.data.newBalance, 600);

    const wireSlip = await request(
      'POST',
      '/payments/bank-slip',
      {
        amount: 500,
        currency: 'EUR',
        purpose: 'WALLET_TOPUP',
        bankName: 'PASHA Bank',
        referenceCode: `CORP-TOPUP-${ts}`,
      },
      corpToken
    );
    assert.strictEqual(wireSlip.status, 201);
    const slipId = wireSlip.body.data.receipt.id;

    const wBeforeApprove = await request('GET', '/corporate/wallet', null, corpToken);
    assert.strictEqual(wBeforeApprove.body.data.wallet.pendingBankSlips.length, 1);

    const approveRes = await request(
      'PATCH',
      `/admin/bank-slips/${slipId}/review`,
      { status: 'APPROVED', notes: 'Corporate wire received' },
      adminToken
    );
    assert.strictEqual(approveRes.status, 200);

    const wAfterApprove = await request('GET', '/corporate/wallet', null, corpToken);
    assert.strictEqual(wAfterApprove.body.data.wallet.balance, 1100);
    console.log('  -> Company Wallet funded: €600 Card + €500 Approved Wire = €1,100.00 ✔️');

    // 4. Settle Batch #1 (€813) from Company Wallet & verify Department Spend + Appointment Confirmation
    console.log('[4/5] Testing Batch Settlement from Company Wallet (€813.00)...');
    const payWalletRes = await request('POST', `/corporate/batches/${createdBatch.id}/pay-wallet`, {}, corpToken);
    assert.strictEqual(payWalletRes.status, 200);
    assert.strictEqual(payWalletRes.body.data.newWalletBalance, 287);

    const deptsAfter = await request('GET', '/corporate/departments', null, corpToken);
    const engDept = deptsAfter.body.data.departments.find((d) => d.name === 'Engineering');
    assert.strictEqual(engDept.spentBudget, 813, 'Engineering department spentBudget must reflect €813');

    const wAfterPay = await request('GET', '/corporate/wallet', null, corpToken);
    assert.strictEqual(wAfterPay.body.data.wallet.totalSpendYtd, 813);
    console.log('  -> Batch #1 settled! Wallet: €287.00, Total Spend YTD: €813.00, Dept Spend: €813.00 ✔️');

    // 5. Create Batch #2 (Standard, 2 employees = €290) & Settle Directly via Corporate Card
    console.log('[5/5] Testing Batch #2 Direct Corporate Card Settlement (€290.00)...');
    const batch2Res = await request(
      'POST',
      '/corporate/batches',
      {
        name: 'Vienna Finance Audit',
        destination: 'Austria',
        travelDate: '2026-12-18',
        duration: 'short',
        projectReason: 'Audit',
        package: 'standard',
        appointmentDate: '2026-11-25',
        appointmentTime: '11:00 AM',
        employees: [
          { firstName: 'Nigar', lastName: 'Karimova', passportNumber: 'C5544332', dob: '1993-02-11', expiryDate: '2031-02-11', department: 'Finance', role: 'Auditor' },
          { firstName: 'Orxan', lastName: 'Quliyev', passportNumber: 'C6655443', dob: '1991-08-19', expiryDate: '2030-08-19', department: 'Finance', role: 'Lead Auditor' },
        ],
      },
      corpToken
    );
    assert.strictEqual(batch2Res.status, 201);
    const inv2 = batch2Res.body.data.batch.invoice;
    assert.strictEqual(inv2.amount, 290, '2 employees x €145 standard = €290.00');

    const piRes = await request(
      'POST',
      '/payments/create-intent',
      { invoiceId: inv2.id, groupBatchId: batch2Res.body.data.batch.id, purpose: 'GROUP_BATCH_PAYMENT' },
      corpToken
    );
    assert.strictEqual(piRes.status, 200);
    assert.strictEqual(piRes.body.data.amount, 290);

    const confirmCard = await request('POST', '/payments/confirm-mock', { paymentIntentId: piRes.body.data.paymentIntentId }, corpToken);
    assert.strictEqual(confirmCard.status, 200);

    const invAfterCard = await request('GET', '/corporate/invoices', null, corpToken);
    const paidCount = invAfterCard.body.data.invoices.filter((i) => i.status === 'PAID').length;
    assert.strictEqual(paidCount, 2, 'Both corporate invoices must now be PAID');
    console.log('  -> Batch #2 (€290.00) settled via Corporate Card! All 2 invoices PAID ✔️');

    console.log('\n✅ ALL PHASE 2 (CORPORATE PORTAL & WALLET) TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (corpUser) await cleanupCorporateUser(corpUser.id);
    if (adminUser) await cleanupCorporateUser(adminUser.id);
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ PHASE 2 TEST FAILED:', err);
    process.exit(1);
  });

