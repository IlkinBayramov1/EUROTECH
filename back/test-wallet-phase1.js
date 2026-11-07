const http = require('http');
const assert = require('assert');
const bcrypt = require('bcryptjs');
const app = require('./app');
const prisma = require('./config/db');
const { parseSafeDate, calculatePortalFees, getAgentCommissionRate } = require('./utils/finance.util');

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

async function cleanupTestUser(userId) {
  if (!userId) return;
  try {
    const dossiers = await prisma.dossier.findMany({ where: { userId }, select: { id: true } });
    const dIds = dossiers.map((d) => d.id);
    if (dIds.length) {
      await prisma.additionalService.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.applicant.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.appointment.deleteMany({ where: { dossierId: { in: dIds } } });
      await prisma.transaction.deleteMany({ where: { dossierId: { in: dIds } } });
    }
    await prisma.bankPaymentReceipt.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.dossier.deleteMany({ where: { userId } });
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
  console.log(' EUROTECH WALLET OVERHAUL — PHASE 1 TEST SUITE');
  console.log('===============================================================\n');

  // 1. Unit tests on finance.util.js
  console.log('[1/7] Verifying finance.util.js (Safe Dates & Unified Pricing Matrix)...');
  const d1 = parseSafeDate('1992-05-14', 'Birth Date', { required: true });
  const d2 = parseSafeDate('14.05.1992', 'Birth Date', { required: true });
  assert.strictEqual(d1.toISOString().slice(0, 10), '1992-05-14');
  assert.strictEqual(d2.toISOString().slice(0, 10), '1992-05-14');

  let threw400 = false;
  try {
    parseSafeDate('C10293847', 'Birth Date', { required: true });
  } catch (err) {
    threw400 = err.statusCode === 400;
  }
  assert.strictEqual(threw400, true, 'Invalid passport string in date field must throw 400');

  const indivPrem = calculatePortalFees({ portalType: 'INDIVIDUAL', paxCount: 2, activePackage: 'premium' });
  assert.strictEqual(indivPrem.totalAmountEur, 412, 'Individual 2x Premium (€80 + €126)*2 = €412');

  const corpPrem = calculatePortalFees({ portalType: 'CORPORATE', paxCount: 3, activePackage: 'premium' });
  assert.strictEqual(corpPrem.totalAmountEur, 813, 'Corporate 3x Premium (€145 + €126)*3 = €813');

  const agentVip = calculatePortalFees({ portalType: 'GROUP_AGENT', paxCount: 2, activePackage: 'vip' });
  assert.strictEqual(agentVip.totalAmountEur, 804, 'Agent 2x VIP (€145 + €257)*2 = €804');
  assert.strictEqual(getAgentCommissionRate('GOLD'), 28);
  console.log('  -> finance.util.js assertions passed ✔️');

  let server;
  let testClientUser = null;
  let testAdminUser = null;

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    const request = makeClient(port);
    console.log(`[INIT] Ephemeral test server running on port ${port}`);

    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const ts = Date.now();
    testClientUser = await prisma.user.create({
      data: {
        email: `wallet.p1.client.${ts}@eurotech.test`,
        passwordHash,
        fullName: 'Phase1 Wallet Client',
        role: 'INDIVIDUAL',
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });
    testAdminUser = await prisma.user.create({
      data: {
        email: `wallet.p1.admin.${ts}@eurotech.test`,
        passwordHash,
        fullName: 'Phase1 Finance Admin',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });

    const clientLogin = await request('POST', '/auth/login', {
      email: testClientUser.email,
      password: 'TestPass123!',
      expectedRole: 'INDIVIDUAL',
    });
    assert.strictEqual(clientLogin.status, 200);
    const clientToken = clientLogin.body.data.accessToken;

    const adminLogin = await request('POST', '/auth/login', {
      email: testAdminUser.email,
      password: 'TestPass123!',
      expectedRole: 'ADMIN',
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.body.data.accessToken;

    // 2. Auto-provision wallet & Card Top-Up
    console.log('[2/7] Testing Wallet Auto-Provision & Card Top-Up...');
    const initWallet = await request('GET', '/payments/wallet', null, clientToken);
    assert.strictEqual(initWallet.status, 200);
    assert.strictEqual(initWallet.body.data.wallet.balance, 0);

    const topup1 = await request('POST', '/payments/wallet/topup', { amount: 300, currency: 'EUR', method: 'CARD' }, clientToken);
    assert.strictEqual(topup1.status, 201);
    assert.strictEqual(topup1.body.data.balance, 300);

    // Also test Stripe PaymentIntent flow for WALLET_TOPUP
    const piTopup = await request(
      'POST',
      '/payments/create-intent',
      { amount: 100, currency: 'EUR', purpose: 'WALLET_TOPUP' },
      clientToken
    );
    assert.strictEqual(piTopup.status, 200);
    const confirmPi = await request('POST', '/payments/confirm-mock', { paymentIntentId: piTopup.body.data.paymentIntentId }, clientToken);
    assert.strictEqual(confirmPi.status, 200);

    const afterCardTopup = await request('GET', '/payments/wallet', null, clientToken);
    assert.strictEqual(afterCardTopup.body.data.wallet.balance, 400);
    console.log('  -> Wallet balance after Card Top-Ups: €400.00 ✔️');

    // 3. Bank Slip Top-Up (null dossierId) + Admin Reconciliation
    console.log('[3/7] Testing Bank Wire Slip Wallet Top-Up & Admin Approval (null dossierId)...');
    const slipRes = await request(
      'POST',
      '/payments/bank-slip',
      {
        amount: 185,
        currency: 'AZN',
        referenceCode: `SLIP-P1-${ts}`,
        bankName: 'ABB Bank',
        senderName: 'Phase1 Wallet Client',
        purpose: 'WALLET_TOPUP',
      },
      clientToken
    );
    assert.strictEqual(slipRes.status, 201);
    const receiptId = slipRes.body.data.receipt.id;

    const adminSlips = await request('GET', '/admin/bank-slips', null, adminToken);
    assert.strictEqual(adminSlips.status, 200);
    const foundSlip = adminSlips.body.data.slips.find((s) => s.id === receiptId);
    assert.ok(foundSlip, 'Admin bank slips list must include null-dossierId WALLET_TOPUP slip');
    assert.strictEqual(foundSlip.purpose, 'WALLET_TOPUP');

    const reviewRes = await request(
      'PATCH',
      `/admin/bank-slips/${receiptId}/review`,
      { status: 'APPROVED', notes: '185 AZN converted to EUR' },
      adminToken
    );
    assert.strictEqual(reviewRes.status, 200, `Admin review failed: ${JSON.stringify(reviewRes.body)}`);

    const afterSlipWallet = await request('GET', '/payments/wallet', null, clientToken);
    assert.strictEqual(afterSlipWallet.body.data.wallet.balance, 500, '185 AZN @ 1.85 = €100 -> total €500');
    console.log('  -> Admin Bank Slip reconciliation credited €100.00 -> €500.00 ✔️');

    // 4. Pay Individual Dossier from Wallet
    console.log('[4/7] Testing Dossier Settlement from Wallet...');
    let country = await prisma.country.findFirst();
    if (!country) {
      country = await prisma.country.create({
        data: { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Венгрия' },
      });
    }
    let category = await prisma.visaCategory.findFirst({ where: { countryId: country.id } });
    if (!category) {
      category = await prisma.visaCategory.create({
        data: { countryId: country.id, code: 'TOURISM', nameAz: 'Turizm', nameEn: 'Tourism', nameRu: 'Туризм' },
      });
    }

    const dossier = await prisma.dossier.create({
      data: {
        dossierNumber: `DOS-P1-${ts}`,
        userId: testClientUser.id,
        countryId: country.id,
        visaCategoryId: category.id,
        portalType: 'INDIVIDUAL',
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        governmentFee: 80,
        serviceFee: 0,
        totalAmount: 80,
        applicants: {
          create: {
            firstName: 'Ilkin',
            lastName: 'Bayramov',
            passportNumber: 'C9988776',
            birthDate: new Date('1995-04-10'),
            nationality: 'AZ',
          },
        },
      },
    });

    const payDossierRes = await request('POST', '/payments/wallet/pay', { dossierId: dossier.id }, clientToken);
    assert.strictEqual(payDossierRes.status, 200);
    assert.strictEqual(payDossierRes.body.data.paidAmountEur, 80);
    assert.strictEqual(payDossierRes.body.data.newBalance, 420);

    const updatedDossier1 = await prisma.dossier.findUnique({ where: { id: dossier.id } });
    assert.strictEqual(updatedDossier1.paymentStatus, 'PAID');
    assert.strictEqual(updatedDossier1.status, 'UNDER_REVIEW');
    console.log('  -> Dossier settled from Wallet (€80.00), new balance €420.00 ✔️');

    // 5. Add-on Service Checkout via Wallet
    console.log('[5/7] Testing Add-on Service Checkout via Wallet...');
    const srvCheckout = await request(
      'POST',
      '/services/checkout',
      {
        dossierId: dossier.id,
        paymentMethod: 'WALLET',
        items: [{ serviceType: 'TRAVEL_INSURANCE' }],
      },
      clientToken
    );
    assert.strictEqual(srvCheckout.status, 201, `Service checkout failed: ${JSON.stringify(srvCheckout.body)}`);
    assert.strictEqual(srvCheckout.body.data.settledSubtotalEur, 35);
    assert.strictEqual(srvCheckout.body.data.requiresPayment, false);
    const createdServiceId = srvCheckout.body.data.services[0].id;

    const afterSrvWallet = await request('GET', '/payments/wallet', null, clientToken);
    assert.strictEqual(afterSrvWallet.body.data.wallet.balance, 385);
    console.log('  -> Add-on service (€35.00) paid via Wallet, balance €385.00 ✔️');

    // 6. Service Cancellation Auto-Refund to Wallet
    console.log('[6/7] Testing Service Cancellation Auto-Refund to Wallet...');
    const cancelSrv = await request('DELETE', `/services/${createdServiceId}`, null, clientToken);
    assert.strictEqual(cancelSrv.status, 200);
    assert.strictEqual(cancelSrv.body.data.refundedToWalletEur, 35);

    const afterRefundWallet = await request('GET', '/payments/wallet', null, clientToken);
    assert.strictEqual(afterRefundWallet.body.data.wallet.balance, 420);
    console.log('  -> Cancelled service refunded €35.00 to Wallet -> balance €420.00 ✔️');

    // 7. Admin Wallet Oversight & Manual Balance Adjustment
    console.log('[7/7] Testing Admin Wallets Oversight & Manual Balance Adjustment...');
    const adminWallets = await request('GET', `/admin/wallets?search=${encodeURIComponent(testClientUser.email)}`, null, adminToken);
    assert.strictEqual(adminWallets.status, 200);
    assert.strictEqual(adminWallets.body.data.wallets.length, 1);
    assert.strictEqual(adminWallets.body.data.wallets[0].balance, 420);

    const creditAdj = await request(
      'POST',
      `/admin/wallets/${testClientUser.id}/adjust`,
      { amount: 30, type: 'CREDIT', reason: 'Goodwill loyalty credit' },
      adminToken
    );
    assert.strictEqual(creditAdj.status, 200);
    assert.strictEqual(creditAdj.body.data.balance, 450);

    const debitAdj = await request(
      'POST',
      `/admin/wallets/${testClientUser.id}/adjust`,
      { amount: 20, type: 'DEBIT', reason: 'Manual courier correction' },
      adminToken
    );
    assert.strictEqual(debitAdj.status, 200);
    assert.strictEqual(debitAdj.body.data.balance, 430);
    console.log('  -> Admin Wallet list & Credit/Debit adjustments passed (€430.00) ✔️');

    console.log('\n✅ ALL PHASE 1 TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (testClientUser) await cleanupTestUser(testClientUser.id);
    if (testAdminUser) await cleanupTestUser(testAdminUser.id);
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ PHASE 1 TEST FAILED:', err);
  process.exit(1);
});
