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

async function cleanupUser(userId) {
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
      await prisma.applicantDocument.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.applicant.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.appointment.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.transaction.deleteMany({ where: { dossierId: { in: dIds } } });
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
  console.log(' EUROTECH WALLET OVERHAUL — PHASE 3 (TOUR AGENT PORTAL) TESTS');
  console.log('===============================================================\n');

  let server;
  let agentUser = null;
  let adminUser = null;

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    const request = makeClient(port);

    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const ts = Date.now();

    agentUser = await prisma.user.create({
      data: {
        email: `agent_p3_${ts}@eurotech-test.local`,
        passwordHash,
        fullName: 'Baku Travel Agency Partner',
        companyName: 'Baku Travel MMC',
        role: 'AGENT_TUR_OPERATOR',
        agentTier: 'BRONZE',
        accountStatus: 'ACTIVE',
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin_p3_${ts}@eurotech-test.local`,
        passwordHash,
        fullName: 'Finance Desk Admin',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      },
    });

    const agentLogin = await request('POST', '/auth/login', {
      email: agentUser.email,
      password: 'TestPass123!',
    });
    assert.strictEqual(agentLogin.status, 200, 'Agent login failed');
    const agentToken = agentLogin.body.data.accessToken;

    const adminLogin = await request('POST', '/auth/login', {
      email: adminUser.email,
      password: 'TestPass123!',
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
    const adminToken = adminLogin.body.data.accessToken;

    // ---------------------------------------------------------
    // SCENARIO 1: Create 3-Pax Premium Group ("16:00 PM" slot + DD.MM.YYYY date)
    // ---------------------------------------------------------
    console.log('[1/5] Creating 3-pax Premium tour group with "16:00 PM" slot & DD.MM.YYYY date...');
    const createRes = await request(
      'POST',
      '/agent/groups',
      {
        name: 'Budapest Autumn Delegation',
        destination: 'Hungary',
        travelDate: '2026-11-13',
        duration: 'short',
        projectReason: 'Tourism',
        package: 'premium', // €145 + €126 = €271 / pax -> 3 * 271 = €813.00
        appointmentDate: '2026-09-22',
        appointmentTime: '16:00 PM',
        applicants: [
          { firstName: 'Ali', lastName: 'Mammadov', passportNumber: 'C1000001', dob: '14.05.1992' },
          { firstName: 'Leyla', lastName: 'Huseynova', passportNumber: 'C1000002', dob: '1995-08-20' },
          { firstName: 'Orxan', lastName: 'Aliyev', passportNumber: 'C1000003', dob: '03/11/1988' },
        ],
      },
      agentToken
    );
    assert.strictEqual(createRes.status, 201, `Group create failed: ${JSON.stringify(createRes.body)}`);
    const group1 = createRes.body.data.group;
    assert.ok(group1.id && group1.code, 'Group ID & code returned');

    // Verify GET /agent/groups returns totalAmount = 813 and estimatedCommissionEur = 60
    const groupsRes = await request('GET', '/agent/groups', null, agentToken);
    assert.strictEqual(groupsRes.status, 200);
    const g1Listed = groupsRes.body.data.groups.find((g) => g.id === group1.id);
    assert.strictEqual(Number(g1Listed.totalAmount), 813, `Expected €813 group total, got ${g1Listed.totalAmount}`);
    assert.strictEqual(Number(g1Listed.estimatedCommissionEur), 60, `Expected €60 commission, got ${g1Listed.estimatedCommissionEur}`);

    // Submit unpaid group -> commission stays PENDING until paid
    const submitRes = await request('POST', `/agent/groups/${group1.id}/submit`, {}, agentToken);
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(submitRes.body.data.commissionCredited, 0, 'Unpaid group must not credit available balance yet');
    assert.strictEqual(submitRes.body.data.commissionPending, 60, 'Unpaid group must hold €60 in Pending Clearing');

    const walletCheck1 = await request('GET', '/agent/wallet', null, agentToken);
    assert.strictEqual(walletCheck1.status, 200);
    const w1 = walletCheck1.body.data.wallet;
    assert.strictEqual(w1.balance, 0, 'Initial wallet balance should be €0');
    assert.strictEqual(w1.pendingBalance, 60, 'Pending clearing should be €60');
    assert.strictEqual(w1.unpaidGroupFeesTotal, 813, 'Unpaid group fees should be €813');
    assert.strictEqual(w1.totalEarnedYtd, 0, 'Earned YTD should be €0 before payment');
    console.log('   ✔ Passed: €813 group invoice + €60 Pending Clearing accurately persisted!');

    // ---------------------------------------------------------
    // SCENARIO 2: Add & Remove Traveler Dynamically Updates Fees & Commission
    // ---------------------------------------------------------
    console.log('[2/5] Testing dynamic traveler add/remove financial sync...');
    const addAppRes = await request(
      'POST',
      `/agent/groups/${group1.id}/applicants`,
      { firstName: 'Nigar', lastName: 'Quliyeva', passportNumber: 'C1000004', dob: '1997-04-12' },
      agentToken
    );
    assert.strictEqual(addAppRes.status, 201);
    const fourthAppId = addAppRes.body.data.applicant.id;

    const walletAfterAdd = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    assert.strictEqual(walletAfterAdd.unpaidGroupFeesTotal, 1084, '4 pax * €271 should equal €1084');
    assert.strictEqual(walletAfterAdd.pendingBalance, 80, '4 pax * €20 should equal €80 pending');

    const delAppRes = await request('DELETE', `/agent/groups/${group1.id}/applicants/${fourthAppId}`, null, agentToken);
    assert.strictEqual(delAppRes.status, 200);

    const walletAfterRemove = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    assert.strictEqual(walletAfterRemove.unpaidGroupFeesTotal, 813, 'Back to 3 pax * €271 = €813');
    assert.strictEqual(walletAfterRemove.pendingBalance, 60, 'Back to 3 pax * €20 = €60 pending');
    console.log('   ✔ Passed: Adding/removing travelers recalculates dossier fees & pending commission!');

    // ---------------------------------------------------------
    // SCENARIO 3: Top Up Agency Wallet (€1000) & Verify totalEarnedYtd Isolation
    // ---------------------------------------------------------
    console.log('[3/5] Topping up Agency Wallet (€1000) and verifying commission metric isolation...');
    const topupRes = await request(
      'POST',
      '/agent/wallet/topup',
      { amount: 1000, currency: 'EUR', paymentMethod: 'CARD', referenceCode: 'AG-TEST-TOPUP-1000' },
      agentToken
    );
    assert.strictEqual(topupRes.status, 201, `Top-up failed: ${JSON.stringify(topupRes.body)}`);

    const walletAfterTopup = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    assert.strictEqual(walletAfterTopup.balance, 1000, 'Available wallet balance should be €1000');
    assert.strictEqual(walletAfterTopup.totalTopups, 1000, 'Total top-ups should be €1000');
    assert.strictEqual(walletAfterTopup.totalEarnedYtd, 0, 'Wallet top-up MUST NOT inflate Total Earned Commissions YTD!');
    console.log('   ✔ Passed: €1000 credited to Agency Wallet; Total Earned YTD remains €0!');

    // ---------------------------------------------------------
    // SCENARIO 4: Pay Group #1 (€813) from Agency Wallet -> Unlocks +€60 Commission
    // ---------------------------------------------------------
    console.log('[4/5] Paying Group #1 (€813) from Agency Wallet & clearing +€60 commission...');
    const payWalletRes = await request('POST', `/agent/groups/${group1.id}/pay-wallet`, {}, agentToken);
    assert.strictEqual(payWalletRes.status, 200, `Pay group with wallet failed: ${JSON.stringify(payWalletRes.body)}`);

    const walletAfterPay = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    // 1000 - 813 + 60 = 247
    assert.strictEqual(walletAfterPay.balance, 247, `Expected €247 balance (1000 - 813 + 60), got €${walletAfterPay.balance}`);
    assert.strictEqual(walletAfterPay.pendingBalance, 0, 'Pending clearing should drop to €0');
    assert.strictEqual(walletAfterPay.totalEarnedYtd, 60, 'Total Earned YTD should now be €60');
    assert.strictEqual(walletAfterPay.unpaidGroupFeesTotal, 0, 'Unpaid group fees should be €0');
    assert.strictEqual(walletAfterPay.totalPaxLifetime, 3, 'Processed lifetime pax should be 3');
    console.log('   ✔ Passed: €813 deducted, +€60 commission cleared -> Final Balance = €247.00!');

    // ---------------------------------------------------------
    // SCENARIO 5: Group #2 Bank Slip Approval + Invoice PDF + Payout Request
    // ---------------------------------------------------------
    console.log('[5/5] Testing Group #2 Bank Wire Slip approval, Invoice PDF, and Payout withdrawal...');
    const createRes2 = await request(
      'POST',
      '/agent/groups',
      {
        name: 'Prague Winter Tour',
        destination: 'Czechia',
        travelDate: '2026-12-05',
        duration: 'short',
        package: 'standard', // 2 * €145 = €290
        applicants: [
          { firstName: 'Kamran', lastName: 'babayev', passportNumber: 'C2000001', dob: '1990-01-15' },
          { firstName: 'Aysel', lastName: 'Babayeva', passportNumber: 'C2000002', dob: '1992-06-22' },
        ],
      },
      agentToken
    );
    assert.strictEqual(createRes2.status, 201);
    const group2 = createRes2.body.data.group;

    const slipRes = await request(
      'POST',
      '/payments/bank-slip',
      {
        groupBatchId: group2.id,
        amount: 290,
        currency: 'EUR',
        purpose: 'GROUP_BATCH_PAYMENT',
        bankName: 'ABB Bank',
        senderName: 'Baku Travel MMC',
        receiptNumber: `GRP2-WIRE-${ts}`,
      },
      agentToken
    );
    assert.strictEqual(slipRes.status, 201, `Bank slip submit failed: ${JSON.stringify(slipRes.body)}`);
    const slipId = slipRes.body.data.receipt.id;

    // Verify pending bank slip appears on agent wallet
    const wPendingSlip = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    assert.strictEqual(wPendingSlip.pendingBankSlips.length, 1, 'Pending bank slip should be visible on wallet');
    assert.strictEqual(wPendingSlip.pendingBalance, 40, 'Group #2 €40 commission pending');

    // Admin approves bank slip -> settles Group #2 & unlocks +€40 commission!
    const approveRes = await request(
      'PATCH',
      `/admin/bank-slips/${slipId}/review`,
      { status: 'APPROVED', adminNotes: 'Verified wire receipt' },
      adminToken
    );
    assert.strictEqual(approveRes.status, 200, `Admin approve slip failed: ${JSON.stringify(approveRes.body)}`);

    const wAfterApprove = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    // 247 + 40 = 287 (since €290 was paid externally via bank wire, wallet gets +€40 commission!)
    assert.strictEqual(wAfterApprove.balance, 287, `Expected €287 balance (247 + 40), got €${wAfterApprove.balance}`);
    assert.strictEqual(wAfterApprove.totalEarnedYtd, 100, 'Total Earned YTD should be €100 (60 + 40)');
    assert.strictEqual(wAfterApprove.pendingBalance, 0, 'Pending clearing should be €0');

    // Generate official Group Invoice PDF
    const pdfRes = await request('GET', `/agent/groups/${group2.id}/invoice-pdf`, null, agentToken);
    assert.strictEqual(pdfRes.status, 200, 'Group invoice PDF failed');
    assert.ok(pdfRes.body.data.fileUrl, 'Invoice PDF URL returned');

    // Request €87 payout -> remaining balance €200
    const payoutRes = await request(
      'POST',
      '/agent/payout-request',
      { amount: 87, bankName: 'ABB', iban: 'AZ21IBAZ000000001234', swiftBic: 'IBAZAZ2X' },
      agentToken
    );
    assert.strictEqual(payoutRes.status, 201, `Payout failed: ${JSON.stringify(payoutRes.body)}`);

    const wAfterPayout = (await request('GET', '/agent/wallet', null, agentToken)).body.data.wallet;
    assert.strictEqual(wAfterPayout.balance, 200, `Expected €200 after €87 payout, got €${wAfterPayout.balance}`);
    assert.strictEqual(wAfterPayout.totalEarnedYtd, 100, 'Total Earned YTD stays €100 after payout');
    console.log('   ✔ Passed: Bank Wire approval, Invoice PDF, and €87 Payout all verified!');

    console.log('\n===============================================================');
    console.log(' ✅ ALL PHASE 3 (TOUR AGENT PORTAL & WALLET) TESTS PASSED!');
    console.log('===============================================================\n');
  } finally {
    await cleanupUser(agentUser?.id);
    await cleanupUser(adminUser?.id);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ PHASE 3 TEST FAILED:', err);
    process.exit(1);
  });
