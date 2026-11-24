/**
 * EUROTECH Promo Codes & Wallet/Payment Integration E2E Verification Suite
 *
 * Tests all 16 critical financial, concurrency, portal-scoping, anti-arbitrage,
 * bank-slip lifecycle, refund-cap, and 5-step-wizard exclusion invariants.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const prisma = require('../config/db');
const promoService = require('../modules/promo/promo.service');
const walletService = require('../modules/payment/wallet.service');
const paymentService = require('../modules/payment/payment.service');
const serviceService = require('../modules/service/service.service');
const agentFinanceService = require('../modules/agent/services/agentFinance.service');
const corporateFinanceService = require('../modules/corporate/services/corporateFinance.service');

const TAG = `E2E_PROMO_${Date.now()}`;
const createdUserIds = [];
const createdPromoIds = [];
const createdDossierIds = [];
const createdBatchIds = [];

let passed = 0;
let failed = 0;

async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}`);
    console.error('       ', err.stack || err.message);
  }
}

async function expectThrows(fn, regex) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (regex && !regex.test(err.message || '')) {
      throw new Error(`Expected error matching ${regex}, got: "${err.message}"`);
    }
  }
  if (!threw) {
    throw new Error(`Expected function to throw (${regex || 'any error'}), but it succeeded.`);
  }
}

async function main() {
  console.log(`\n=== EUROTECH PROMO CODES E2E TEST SUITE (${TAG}) ===\n`);

  const country = await prisma.country.findFirst({ where: { isActive: true } });
  const otherCountry = await prisma.country.findFirst({
    where: { isActive: true, id: { not: country.id } },
  });
  const visaCat = await prisma.visaCategory.findFirst({ where: { countryId: country.id } });
  assert(country && visaCat, 'Seeded country & visaCategory required for E2E test');

  // Create isolated test users: Admin, Individual, Agent, Corporate
  const adminUser = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}_admin@eurotech.test`,
      fullName: 'E2E Admin Officer',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });
  createdUserIds.push(adminUser.id);

  const indUser = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}_ind@eurotech.test`,
      fullName: 'E2E Individual Client',
      role: 'INDIVIDUAL',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });
  createdUserIds.push(indUser.id);

  const indUser2 = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}_ind2@eurotech.test`,
      fullName: 'E2E Individual Client 2',
      role: 'INDIVIDUAL',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });
  createdUserIds.push(indUser2.id);

  const agentUser = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}_agent@eurotech.test`,
      fullName: 'E2E Tour Agent',
      companyName: 'E2E Travels MMC',
      role: 'AGENT_TUR_OPERATOR',
      agentTier: 'BRONZE',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });
  createdUserIds.push(agentUser.id);

  const corpUser = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}_corp@eurotech.test`,
      fullName: 'E2E Corporate HR',
      companyName: 'E2E Energy Corp',
      role: 'CORPORATE_HR',
      accountStatus: 'ACTIVE',
      isVerified: true,
    },
  });
  createdUserIds.push(corpUser.id);

  const corpDept = await prisma.corporateDepartment.create({
    data: {
      corporateUserId: corpUser.id,
      name: 'Engineering',
      annualBudget: 50000,
      spentBudget: 0,
    },
  });

  // Helper to create an unpaid individual dossier (€80 gov + €120 service = €200)
  async function createIndDossier(userId, suffix, gov = 80, srv = 120, cid = country.id) {
    const d = await prisma.dossier.create({
      data: {
        dossierNumber: `${TAG}-IND-${suffix}`,
        portalType: 'INDIVIDUAL',
        userId,
        countryId: cid,
        visaCategoryId: visaCat.id,
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        governmentFee: gov,
        serviceFee: srv,
        extraServicesFee: 0,
        totalAmount: gov + srv,
        applicants: {
          create: {
            firstName: 'Test',
            lastName: `Traveler${suffix}`,
            passportNumber: `P${Date.now().toString().slice(-7)}`,
            familyRole: 'PRIMARY',
          },
        },
      },
      include: { applicants: true },
    });
    createdDossierIds.push(d.id);
    return d;
  }

  // ============================================================================
  // 1. ADMIN CRUD TESTS
  // ============================================================================
  let pctPromo, fixedPromo, freePromo, expiredPromo, corpOnlyPromo, srvOnlyPromo, racePromo, countryPromo;

  await step('1. Admin creates Percentage (capped), Fixed EUR, 100% Free, Service-Only, Portal-Restricted, Country-Restricted & Expired promo codes', async () => {
    pctPromo = await promoService.createPromoCode(
      {
        code: `${TAG}_PCT20`,
        title: '20% Off Max €30',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscountEur: 30,
        minOrderAmountEur: 100,
        applyTarget: 'TOTAL_AMOUNT',
        applicableScope: 'ALL',
        allowedPortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
        maxUses: 10,
        maxUsesPerUser: 2,
      },
      adminUser.id
    );
    createdPromoIds.push(pctPromo.id);

    fixedPromo = await promoService.createPromoCode(
      {
        code: `${TAG}_FIX25`,
        title: 'Fixed €25 Off',
        discountType: 'FIXED_EUR',
        discountValue: 25,
        applyTarget: 'TOTAL_AMOUNT',
        applicableScope: 'ALL',
        maxUses: 10,
        maxUsesPerUser: 2,
      },
      adminUser.id
    );
    createdPromoIds.push(fixedPromo.id);

    freePromo = await promoService.createPromoCode(
      {
        code: `${TAG}_FREE100`,
        title: '100% VIP Comp',
        discountType: 'PERCENTAGE',
        discountValue: 100,
        applyTarget: 'TOTAL_AMOUNT',
        applicableScope: 'ALL',
        allowAgentCommission: false,
        maxUses: 5,
        maxUsesPerUser: 2,
      },
      adminUser.id
    );
    createdPromoIds.push(freePromo.id);

    srvOnlyPromo = await promoService.createPromoCode(
      {
        code: `${TAG}_SRV50`,
        title: '50% Off Service Fee Only',
        discountType: 'PERCENTAGE',
        discountValue: 50,
        applyTarget: 'SERVICE_AND_EXTRAS_ONLY',
        applicableScope: 'ALL',
        maxUses: 10,
        maxUsesPerUser: 2,
      },
      adminUser.id
    );
    createdPromoIds.push(srvOnlyPromo.id);

    corpOnlyPromo = await promoService.createPromoCode(
      {
        code: `${TAG}_CORP50`,
        title: 'Corporate €50 Off',
        discountType: 'FIXED_EUR',
        discountValue: 50,
        applicableScope: 'GROUP_BATCH_PAYMENT',
        allowedPortals: ['CORPORATE'],
        maxUses: 5,
        maxUsesPerUser: 1,
      },
      adminUser.id
    );
    createdPromoIds.push(corpOnlyPromo.id);

    expiredPromo = await promoService.createPromoCode(
      {
        code: `${TAG}_EXP`,
        title: 'Expired Promo',
        discountType: 'FIXED_EUR',
        discountValue: 10,
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      },
      adminUser.id
    );
    createdPromoIds.push(expiredPromo.id);

    racePromo = await promoService.createPromoCode(
      {
        code: `${TAG}_RACE1`,
        title: 'Single Global Use Race Test',
        discountType: 'FIXED_EUR',
        discountValue: 40,
        maxUses: 1,
        maxUsesPerUser: 1,
      },
      adminUser.id
    );
    createdPromoIds.push(racePromo.id);

    if (otherCountry) {
      countryPromo = await promoService.createPromoCode(
        {
          code: `${TAG}_CTRY`,
          title: 'Country Specific Promo',
          discountType: 'FIXED_EUR',
          discountValue: 15,
          countryId: otherCountry.id,
        },
        adminUser.id
      );
      createdPromoIds.push(countryPromo.id);
    }

    const list = await promoService.listPromoCodes({ search: TAG });
    assert(list.length >= 7, 'Admin list should return all created promo codes');
  });

  // ============================================================================
  // 2. INDIVIDUAL WALLET PAYMENT WITH PERCENTAGE CAP PROMO
  // ============================================================================
  let dossier1;
  await step('2. Individual Wallet payment with capped 20% promo (20% of €200 = €40, capped at €30 -> pays €170)', async () => {
    // Top up €175 (intentionally LESS than gross €200, but enough for discounted €170!)
    await walletService.topupWallet({ userId: indUser.id, amount: 175, currency: 'EUR', method: 'CARD' });
    dossier1 = await createIndDossier(indUser.id, 'WLT1', 80, 120);

    // Dry-run validate
    const preview = await promoService.validatePromoCode({
      code: pctPromo.code,
      userId: indUser.id,
      userRole: 'INDIVIDUAL',
      dossierId: dossier1.id,
    });
    assert.strictEqual(preview.originalAmountEur, 200);
    assert.strictEqual(preview.discountAmountEur, 30);
    assert.strictEqual(preview.finalAmountEur, 170);

    // Actual wallet settlement
    const res = await walletService.payWithWallet({
      userId: indUser.id,
      userRole: 'INDIVIDUAL',
      dossierId: dossier1.id,
      promoCode: pctPromo.code,
      scope: 'DOSSIER_PAYMENT',
    });
    assert.strictEqual(res.paidAmountEur, 170);
    assert.strictEqual(res.discountAmountEur, 30);
    assert.strictEqual(res.newBalance, 5); // 175 - 170 = 5

    // Verify dossier & wallet overview dueEur === 0
    const updatedDossier = await prisma.dossier.findUnique({ where: { id: dossier1.id } });
    assert.strictEqual(updatedDossier.paymentStatus, 'PAID');
    assert.strictEqual(updatedDossier.discountAmount, 30);
    assert.strictEqual(updatedDossier.appliedPromoCode, pctPromo.code);

    const overview = await walletService.getUserWalletOverview(indUser.id);
    const invRow = overview.dossierInvoices.find((i) => i.dossierId === dossier1.id);
    assert.strictEqual(invRow.dueAmountEur, 0, 'Due amount must be 0 after promo-discounted settlement');
    assert.strictEqual(invRow.discountAmountEur, 30);
  });

  // ============================================================================
  // 3. SUBSEQUENT ADD-ON SERVICE PRESERVES PRIOR PROMO + ANTI-ARBITRAGE REFUND CAP
  // ============================================================================
  await step('3. Subsequent Add-On Service preserves prior €30 promo discount & caps wallet refund on cancel', async () => {
    // Add €20 COURIER add-on to already-paid dossier1
    const staged = await serviceService.checkoutServices({
      dossierId: dossier1.id,
      user: indUser,
      items: [{ serviceType: 'COURIER', applicantId: dossier1.applicants[0].id }],
    });
    // Remaining balance MUST be €20.00 (NOT €50.00!)
    assert.strictEqual(staged.remainingBalanceEur, 20, `Expected remaining €20, got €${staged.remainingBalanceEur}`);

    // Pay the €20 add-on with 50% service-only promo -> pays €10 cash + €10 promo discount!
    await walletService.topupWallet({ userId: indUser.id, amount: 10, currency: 'EUR', method: 'CARD' }); // bal: 5 + 10 = 15
    const payAddon = await walletService.payWithWallet({
      userId: indUser.id,
      userRole: 'INDIVIDUAL',
      dossierId: dossier1.id,
      promoCode: srvOnlyPromo.code,
      scope: 'ADDITIONAL_SERVICES',
    });
    assert.strictEqual(payAddon.discountAmountEur, 10);
    assert.strictEqual(payAddon.paidAmountEur, 10);
    assert.strictEqual(payAddon.newBalance, 5); // 15 - 10 = 5

    // Now cancel that €20 COURIER service: user only paid €10 cash for it -> refund MUST be capped at €10 (NOT €20!)
    const addedSrvId = staged.services[0].id;
    const removal = await serviceService.removeServiceFromDossier(addedSrvId, indUser);
    assert.strictEqual(removal.refundedAmountEur, 10, `Refund must be capped at €10 cash paid, got €${removal.refundedAmountEur}`);

    const walletAfter = await walletService.getUserWalletOverview(indUser.id);
    assert.strictEqual(walletAfter.balanceEur, 15, 'Wallet balance after capped refund should be €15 (5 + 10)');
  });

  // ============================================================================
  // 4. ONLINE CARD PAYMENT (CREATE INTENT -> CONFIRM) WITH FIXED EUR PROMO
  // ============================================================================
  await step('4. Individual Online Card payment (RESERVED -> APPLIED) with Fixed €25 promo', async () => {
    const dCard = await createIndDossier(indUser.id, 'CARD1', 80, 120);
    const intent = await paymentService.createPaymentIntent(
      {
        dossierId: dCard.id,
        purpose: 'DOSSIER_PAYMENT',
        promoCode: fixedPromo.code,
      },
      indUser.id,
      null,
      'INDIVIDUAL'
    );
    assert.strictEqual(intent.amount, 175);
    assert.strictEqual(intent.discountAmountEur, 25);

    const reservedRow = await prisma.promoCodeRedemption.findFirst({
      where: { dossierId: dCard.id, status: 'RESERVED' },
    });
    assert(reservedRow, 'Redemption should be RESERVED while card intent is PENDING');

    await paymentService.confirmPaymentSuccess(intent.paymentIntentId);

    const appliedRow = await prisma.promoCodeRedemption.findUnique({ where: { id: reservedRow.id } });
    assert.strictEqual(appliedRow.status, 'APPLIED');

    const dCardAfter = await prisma.dossier.findUnique({ where: { id: dCard.id } });
    assert.strictEqual(dCardAfter.paymentStatus, 'PAID');
    assert.strictEqual(dCardAfter.discountAmount, 25);
  });

  // ============================================================================
  // 5. 100% FREE PROMO CODE SETTLEMENT WITH €0.00 WALLET BALANCE
  // ============================================================================
  await step('5. 100% Free Promo Code settles dossier with €0.00 wallet balance (PROMO_FULL_COVERAGE)', async () => {
    const dFree = await createIndDossier(indUser2.id, 'FREE1', 80, 120);
    // indUser2 has €0.00 wallet balance!
    const res = await walletService.payWithWallet({
      userId: indUser2.id,
      userRole: 'INDIVIDUAL',
      dossierId: dFree.id,
      promoCode: freePromo.code,
    });
    assert.strictEqual(res.paidAmountEur, 0);
    assert.strictEqual(res.discountAmountEur, 200);
    assert.strictEqual(res.newBalance, 0);

    const updated = await prisma.dossier.findUnique({ where: { id: dFree.id } });
    assert.strictEqual(updated.paymentStatus, 'PAID');
    assert.strictEqual(updated.discountAmount, 200);

    // Also test 100% free via createPaymentIntent (zeroDueSettled)
    const dFree2 = await createIndDossier(indUser2.id, 'FREE2', 80, 120);
    const intentFree = await paymentService.createPaymentIntent(
      { dossierId: dFree2.id, purpose: 'DOSSIER_PAYMENT', promoCode: freePromo.code },
      indUser2.id,
      null,
      'INDIVIDUAL'
    );
    assert.strictEqual(intentFree.zeroDueSettled, true);
    assert.strictEqual(intentFree.amount, 0);
    const updated2 = await prisma.dossier.findUnique({ where: { id: dFree2.id } });
    assert.strictEqual(updated2.paymentStatus, 'PAID');
  });

  // ============================================================================
  // 6. BANK WIRE SLIP LIFECYCLE: REJECT RELEASES QUOTA, APPROVE APPLIES DISCOUNT
  // ============================================================================
  await step('6. Bank Wire Slip Reject releases RESERVED promo quota -> Retry & Approve commits APPLIED', async () => {
    const dSlip = await createIndDossier(indUser.id, 'SLIP1', 80, 120);
    const slipPromo = await promoService.createPromoCode(
      {
        code: `${TAG}_SLIP1X`,
        discountType: 'FIXED_EUR',
        discountValue: 30,
        maxUses: 1,
        maxUsesPerUser: 1,
      },
      adminUser.id
    );
    createdPromoIds.push(slipPromo.id);

    // 1. Submit slip -> RESERVED, currentUses = 1
    const slip1 = await paymentService.submitBankPaymentSlip({
      dossierId: dSlip.id,
      userId: indUser.id,
      userRole: 'INDIVIDUAL',
      amount: 170,
      currency: 'EUR',
      referenceCode: `${TAG}-WIRE-1`,
      promoCode: slipPromo.code,
    });
    let pState = await prisma.promoCode.findUnique({ where: { id: slipPromo.id } });
    assert.strictEqual(pState.currentUses, 1);

    // 2. Admin REJECTS slip -> RELEASED, currentUses = 0
    await paymentService.reviewBankPaymentSlip({
      receiptId: slip1.id,
      adminUserId: adminUser.id,
      action: 'REJECTED',
      adminNotes: 'Incorrect wire ref',
    });
    pState = await prisma.promoCode.findUnique({ where: { id: slipPromo.id } });
    assert.strictEqual(pState.currentUses, 0, 'Rejected bank slip must restore promo currentUses to 0');

    // 3. User retries with SAME single-use promo code -> succeeds!
    const slip2 = await paymentService.submitBankPaymentSlip({
      dossierId: dSlip.id,
      userId: indUser.id,
      userRole: 'INDIVIDUAL',
      amount: 170,
      currency: 'EUR',
      referenceCode: `${TAG}-WIRE-2`,
      promoCode: slipPromo.code,
    });
    // 4. Admin APPROVES slip2 -> APPLIED, dossier PAID, due = 0
    await paymentService.reviewBankPaymentSlip({
      receiptId: slip2.id,
      adminUserId: adminUser.id,
      action: 'APPROVED',
      adminNotes: 'Wire verified',
    });
    const dSlipAfter = await prisma.dossier.findUnique({ where: { id: dSlip.id } });
    assert.strictEqual(dSlipAfter.paymentStatus, 'PAID');
    assert.strictEqual(dSlipAfter.discountAmount, 30);

    const red2 = await prisma.promoCodeRedemption.findFirst({ where: { bankPaymentReceiptId: slip2.id } });
    assert.strictEqual(red2.status, 'APPLIED');
  });

  // ============================================================================
  // 7. TOUR OPERATOR GROUP WALLET PAYMENT + PROMO + COMMISSION MARGIN SAFETY
  // ============================================================================
  await step('7. Tour Operator Group Wallet payment with promo settles net amount & respects commission safety', async () => {
    // 2 pax: €160 gov + €130 base service = €290 total
    const groupBatch = await prisma.groupBatch.create({
      data: {
        code: `${TAG}-GRP`,
        portalType: 'GROUP_AGENT',
        userId: agentUser.id,
        name: 'E2E Vienna Tour',
        destination: country.nameEn,
        status: 'DRAFT',
      },
    });
    createdBatchIds.push(groupBatch.id);

    const grpDossier = await prisma.dossier.create({
      data: {
        dossierNumber: `${TAG}-GRP-DOS`,
        portalType: 'GROUP_AGENT',
        userId: agentUser.id,
        groupBatchId: groupBatch.id,
        countryId: country.id,
        visaCategoryId: visaCat.id,
        governmentFee: 80,
        serviceFee: 65,
        extraServicesFee: 0,
        totalAmount: 290,
        paymentStatus: 'PENDING',
        applicants: {
          create: [
            { firstName: 'Pax', lastName: 'One', passportNumber: 'AG100001', familyRole: 'PRIMARY' },
            { firstName: 'Pax', lastName: 'Two', passportNumber: 'AG100002', familyRole: 'OTHER' },
          ],
        },
      },
    });
    createdDossierIds.push(grpDossier.id);

    await walletService.topupWallet({ userId: agentUser.id, amount: 300, currency: 'EUR', method: 'CARD' });

    const payRes = await agentFinanceService.payGroupWithWallet(groupBatch.id, agentUser.id, 'AGENT_TUR_OPERATOR', {
      promoCode: fixedPromo.code, // -€25 -> €265 paid; margin over €160 gov is €105 >= €40 commission
    });
    assert.strictEqual(payRes.paidAmountEur, 265);
    assert.strictEqual(payRes.discountAmountEur, 25);
    assert.strictEqual(payRes.commissionSettledEur, 40, 'Standard 2x€20 BRONZE commission should credit cleanly');
    // Balance: 300 - 265 + 40 = 75
    assert.strictEqual(payRes.wallet.balanceEur, 75);
  });

  // ============================================================================
  // 8. CORPORATE INVOICE WALLET PAYMENT + PROMO + DEPARTMENT NET BUDGET
  // ============================================================================
  await step('8. Corporate Partner Invoice payment with Corporate-only promo updates Invoice & Department net budget', async () => {
    const corpBatch = await prisma.groupBatch.create({
      data: {
        code: `${TAG}-CORP`,
        portalType: 'CORPORATE',
        userId: corpUser.id,
        name: 'E2E Engineering Delegation',
        destination: country.nameEn,
        status: 'DRAFT',
      },
    });
    createdBatchIds.push(corpBatch.id);

    const corpDossier = await prisma.dossier.create({
      data: {
        dossierNumber: `${TAG}-CORP-DOS`,
        portalType: 'CORPORATE',
        userId: corpUser.id,
        groupBatchId: corpBatch.id,
        countryId: country.id,
        visaCategoryId: visaCat.id,
        governmentFee: 160,
        serviceFee: 130,
        totalAmount: 290,
        paymentStatus: 'PENDING',
        applicants: {
          create: [
            {
              firstName: 'Eng',
              lastName: 'One',
              passportNumber: 'CP100001',
              familyRole: 'PRIMARY',
              formDataJson: { department: 'Engineering' },
            },
            {
              firstName: 'Eng',
              lastName: 'Two',
              passportNumber: 'CP100002',
              familyRole: 'OTHER',
              formDataJson: { department: 'Engineering' },
            },
          ],
        },
      },
    });
    createdDossierIds.push(corpDossier.id);

    const corpInv = await prisma.corporateInvoice.create({
      data: {
        corporateUserId: corpUser.id,
        groupBatchId: corpBatch.id,
        invoiceNumber: `${TAG}-INV`,
        amount: 290,
        dueDate: new Date(Date.now() + 7 * 86400 * 1000),
        status: 'PENDING',
      },
    });

    await walletService.topupWallet({ userId: corpUser.id, amount: 300, currency: 'EUR', method: 'CARD' });

    const payRes = await walletService.payWithWallet({
      userId: corpUser.id,
      userRole: 'CORPORATE_HR',
      invoiceId: corpInv.id,
      groupBatchId: corpBatch.id,
      promoCode: corpOnlyPromo.code, // -€50 -> €240 paid
    });
    assert.strictEqual(payRes.paidAmountEur, 240);
    assert.strictEqual(payRes.discountAmountEur, 50);
    assert.strictEqual(payRes.newBalance, 60);

    const invAfter = await prisma.corporateInvoice.findUnique({ where: { id: corpInv.id } });
    assert.strictEqual(invAfter.status, 'PAID');
    assert.strictEqual(invAfter.discountAmount, 50);
    assert.strictEqual(invAfter.appliedPromoCode, corpOnlyPromo.code);

    const deptAfter = await prisma.corporateDepartment.findUnique({ where: { id: corpDept.id } });
    assert.strictEqual(deptAfter.spentBudget, 240, 'Department spentBudget must reflect net €240, not gross €290');
  });

  // ============================================================================
  // 9. SECURITY, VALIDATION & CONCURRENCY RACE-CONDITION GUARDS
  // ============================================================================
  await step('9. Rejects expired code, wrong portal, wrong country, below minOrder, WALLET_TOPUP & WIZARD_5_STEP', async () => {
    const dTest = await createIndDossier(indUser.id, 'SEC1', 40, 20); // €60 total (below €100 minOrder of pctPromo)

    // Expired
    await expectThrows(
      () => promoService.validatePromoCode({ code: expiredPromo.code, userId: indUser.id, userRole: 'INDIVIDUAL', dossierId: dTest.id }),
      /expired/i
    );
    // Wrong portal (CORPORATE-only used by INDIVIDUAL)
    await expectThrows(
      () => promoService.validatePromoCode({ code: corpOnlyPromo.code, userId: indUser.id, userRole: 'INDIVIDUAL', dossierId: dTest.id }),
      /portal/i
    );
    // Below minimum order (€60 < €100)
    await expectThrows(
      () => promoService.validatePromoCode({ code: pctPromo.code, userId: indUser.id, userRole: 'INDIVIDUAL', dossierId: dTest.id }),
      /minimum order/i
    );
    // Wrong country
    if (countryPromo) {
      await expectThrows(
        () => promoService.validatePromoCode({ code: countryPromo.code, userId: indUser.id, userRole: 'INDIVIDUAL', dossierId: dTest.id }),
        /country/i
      );
    }
    // Anti-arbitrage: WALLET_TOPUP blocked on createPaymentIntent & submitBankPaymentSlip
    await expectThrows(
      () => paymentService.createPaymentIntent({ purpose: 'WALLET_TOPUP', amount: 100, promoCode: fixedPromo.code }, indUser.id, null, 'INDIVIDUAL'),
      /top-up/i
    );
    await expectThrows(
      () => paymentService.submitBankPaymentSlip({ purpose: 'WALLET_TOPUP', amount: 100, userId: indUser.id, promoCode: fixedPromo.code }),
      /top-up/i
    );
    // Strict 5-step wizard exclusion guard
    await expectThrows(
      () => walletService.payWithWallet({ userId: indUser.id, userRole: 'INDIVIDUAL', dossierId: dTest.id, promoCode: fixedPromo.code, source: 'WIZARD_5_STEP' }),
      /5-step/i
    );
  });

  await step('10. Atomic Concurrency Race Test: two simultaneous requests on maxUses=1 allow EXACTLY 1 winner', async () => {
    await walletService.topupWallet({ userId: indUser.id, amount: 300, currency: 'EUR', method: 'CARD' });
    await walletService.topupWallet({ userId: indUser2.id, amount: 300, currency: 'EUR', method: 'CARD' });

    const dRace1 = await createIndDossier(indUser.id, 'RACE1', 80, 120);
    const dRace2 = await createIndDossier(indUser2.id, 'RACE2', 80, 120);

    const results = await Promise.allSettled([
      walletService.payWithWallet({ userId: indUser.id, userRole: 'INDIVIDUAL', dossierId: dRace1.id, promoCode: racePromo.code }),
      walletService.payWithWallet({ userId: indUser2.id, userRole: 'INDIVIDUAL', dossierId: dRace2.id, promoCode: racePromo.code }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1, `Expected exactly 1 race winner, got ${fulfilled.length}`);
    assert.strictEqual(rejected.length, 1, `Expected exactly 1 race rejection, got ${rejected.length}`);

    const raceAfter = await prisma.promoCode.findUnique({ where: { id: racePromo.id } });
    assert.strictEqual(raceAfter.currentUses, 1);
  });

  await step('11. Admin Archive Protection & Analytics Summary accuracy', async () => {
    // Deleting a USED promo code archives it safely instead of deleting audit history
    const archiveRes = await promoService.deleteOrArchivePromoCode(racePromo.id, adminUser.id);
    assert.strictEqual(archiveRes.action, 'ARCHIVED');

    // Deleting an UNUSED promo code permanently deletes it
    const unused = await promoService.createPromoCode(
      { code: `${TAG}_UNUSED`, discountType: 'FIXED_EUR', discountValue: 5 },
      adminUser.id
    );
    const delRes = await promoService.deleteOrArchivePromoCode(unused.id, adminUser.id);
    assert.strictEqual(delRes.action, 'DELETED');

    const analytics = await promoService.getPromoAnalytics();
    assert(analytics.confirmedRedemptions >= 7, 'Analytics should reflect confirmed redemptions');
    assert(analytics.totalDiscountGrantedEur > 0, 'Analytics should reflect granted discount total');
  });

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
}

async function cleanup() {
  try {
    if (createdPromoIds.length > 0) {
      await prisma.promoCodeRedemption.deleteMany({ where: { promoCodeId: { in: createdPromoIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.bankPaymentReceipt.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.transaction.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.corporateInvoice.deleteMany({ where: { corporateUserId: { in: createdUserIds } } });
      await prisma.corporateDepartment.deleteMany({ where: { corporateUserId: { in: createdUserIds } } });
    }
    if (createdDossierIds.length > 0) {
      await prisma.dossier.deleteMany({ where: { id: { in: createdDossierIds } } });
    }
    if (createdBatchIds.length > 0) {
      await prisma.groupBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
    }
    if (createdPromoIds.length > 0) {
      await prisma.promoCode.deleteMany({ where: { id: { in: createdPromoIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  } catch (cleanupErr) {
    console.warn('Cleanup notice:', cleanupErr.message);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((err) => {
    console.error('Fatal E2E Error:', err);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    process.exit(failed > 0 ? 1 : 0);
  });
