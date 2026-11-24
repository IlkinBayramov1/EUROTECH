/* eslint-disable no-console */
const prisma = require('../config/db');
const adminAnalyticsService = require('../modules/admin/adminAnalytics.service');
const adminService = require('../modules/admin/admin.service');
const { convertToEur } = require('../config/constants');

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${label}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

function approxEq(a, b, tol = 0.05) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

async function run() {
  const tag = `ANL${Date.now().toString().slice(-6)}`;
  const createdIds = {
    redemptions: [],
    promos: [],
    appointments: [],
    slots: [],
    payouts: [],
    bankSlips: [],
    transactions: [],
    documents: [],
    applicants: [],
    dossiers: [],
    wallets: [],
    users: [],
    visaCategories: [],
    countries: [],
  };

  try {
    console.log('=== EuroTech Admin Executive Analytics E2E Verification ===');

    // 1. Capture live DB baselines before injecting fixtures
    const baseAll30 = await adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'ALL' });
    const baseInd30 = await adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'INDIVIDUAL' });
    const baseAgent30 = await adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'GROUP_AGENT' });
    const baseCorp30 = await adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'CORPORATE' });
    const baseSummary = await adminService.getDashboardMetrics();
    const rate = baseAll30.meta.eurToAznRate;

    console.log(`Live FX Rate: 1 EUR = ${rate} AZN`);

    // 2. Seed isolated test countries & visa categories
    const cA = await prisma.country.create({
      data: {
        code: `T${tag.slice(-2)}A`.slice(0, 5),
        nameAz: `AnalyticsTestland A ${tag}`,
        nameEn: `AnalyticsTestland A ${tag}`,
        nameRu: `AnalyticsTestland A ${tag}`,
      },
    });
    const cB = await prisma.country.create({
      data: {
        code: `T${tag.slice(-2)}B`.slice(0, 5),
        nameAz: `AnalyticsTestland B ${tag}`,
        nameEn: `AnalyticsTestland B ${tag}`,
        nameRu: `AnalyticsTestland B ${tag}`,
      },
    });
    createdIds.countries.push(cA.id, cB.id);

    const vcA = await prisma.visaCategory.create({
      data: {
        countryId: cA.id,
        code: `TOUR_${tag}`,
        nameAz: 'Tourist',
        nameEn: 'Tourist',
        nameRu: 'Tourist',
        baseFee: 80,
      },
    });
    const vcB = await prisma.visaCategory.create({
      data: {
        countryId: cB.id,
        code: `BIZ_${tag}`,
        nameAz: 'Business',
        nameEn: 'Business',
        nameRu: 'Business',
        baseFee: 100,
      },
    });
    createdIds.visaCategories.push(vcA.id, vcB.id);

    // 3. Seed 3 portal users + wallets
    const uInd = await prisma.user.create({
      data: {
        email: `ind_${tag.toLowerCase()}@eurotech.test`,
        fullName: `Ind Tester ${tag}`,
        role: 'INDIVIDUAL',
        accountStatus: 'ACTIVE',
      },
    });
    const uAgent = await prisma.user.create({
      data: {
        email: `agent_${tag.toLowerCase()}@eurotech.test`,
        fullName: `Agent Tester ${tag}`,
        role: 'AGENT_TUR_OPERATOR',
        accountStatus: 'ACTIVE',
      },
    });
    const uCorp = await prisma.user.create({
      data: {
        email: `corp_${tag.toLowerCase()}@eurotech.test`,
        fullName: `Corp Tester ${tag}`,
        role: 'CORPORATE_HR',
        accountStatus: 'ACTIVE',
      },
    });
    createdIds.users.push(uInd.id, uAgent.id, uCorp.id);

    const wInd = await prisma.wallet.create({ data: { userId: uInd.id, balance: 500, pendingBalance: 0 } });
    const wAgent = await prisma.wallet.create({ data: { userId: uAgent.id, balance: 1200, pendingBalance: 50 } });
    const wCorp = await prisma.wallet.create({ data: { userId: uCorp.id, balance: 800, pendingBalance: 0 } });
    createdIds.wallets.push(wInd.id, wAgent.id, wCorp.id);

    // 4. Seed 4 dossiers across portals & statuses
    const d1 = await prisma.dossier.create({
      data: {
        dossierNumber: `DOS-${tag}-1`,
        portalType: 'INDIVIDUAL',
        userId: uInd.id,
        countryId: cA.id,
        visaCategoryId: vcA.id,
        status: 'APPROVED',
        paymentStatus: 'PAID',
        totalAmount: 200,
        discountAmount: 40,
        appliedPromoCode: `PROMO_${tag}`,
      },
    });
    const d2 = await prisma.dossier.create({
      data: {
        dossierNumber: `DOS-${tag}-2`,
        portalType: 'GROUP_AGENT',
        userId: uAgent.id,
        countryId: cA.id,
        visaCategoryId: vcA.id,
        status: 'REJECTED',
        paymentStatus: 'PAID',
        totalAmount: 200,
      },
    });
    const d3 = await prisma.dossier.create({
      data: {
        dossierNumber: `DOS-${tag}-3`,
        portalType: 'CORPORATE',
        userId: uCorp.id,
        countryId: cB.id,
        visaCategoryId: vcB.id,
        status: 'UNDER_REVIEW',
        paymentStatus: 'PAID',
        totalAmount: 500,
      },
    });
    const d4 = await prisma.dossier.create({
      data: {
        dossierNumber: `DOS-${tag}-4`,
        portalType: 'INDIVIDUAL',
        userId: uInd.id,
        countryId: cB.id,
        visaCategoryId: vcB.id,
        status: 'NEEDS_CORRECTION',
        paymentStatus: 'PENDING',
        totalAmount: 180,
      },
    });
    createdIds.dossiers.push(d1.id, d2.id, d3.id, d4.id);

    // Applicants (2 + 3 + 1 + 1 = 7 pax)
    const appRows = [
      { dossierId: d1.id, firstName: 'A1', lastName: 'T', passportNumber: `P${tag}1` },
      { dossierId: d1.id, firstName: 'A2', lastName: 'T', passportNumber: `P${tag}2` },
      { dossierId: d2.id, firstName: 'B1', lastName: 'T', passportNumber: `P${tag}3` },
      { dossierId: d2.id, firstName: 'B2', lastName: 'T', passportNumber: `P${tag}4` },
      { dossierId: d2.id, firstName: 'B3', lastName: 'T', passportNumber: `P${tag}5` },
      { dossierId: d3.id, firstName: 'C1', lastName: 'T', passportNumber: `P${tag}6` },
      { dossierId: d4.id, firstName: 'D1', lastName: 'T', passportNumber: `P${tag}7` },
    ];
    for (const row of appRows) {
      const a = await prisma.applicant.create({ data: row });
      createdIds.applicants.push(a.id);
    }

    // Documents (+1 VERIFIED, +1 PENDING)
    const doc1 = await prisma.applicantDocument.create({
      data: {
        dossierId: d1.id,
        applicantId: createdIds.applicants[0],
        requiredDocumentType: 'PASSPORT',
        fileUrl: '/uploads/test1.pdf',
        fileName: 'test1.pdf',
        fileSize: 1024,
        status: 'VERIFIED',
      },
    });
    const doc2 = await prisma.applicantDocument.create({
      data: {
        dossierId: d3.id,
        applicantId: createdIds.applicants[5],
        requiredDocumentType: 'BANK_STATEMENT',
        fileUrl: '/uploads/test2.pdf',
        fileName: 'test2.pdf',
        fileSize: 2048,
        status: 'PENDING',
      },
    });
    createdIds.documents.push(doc1.id, doc2.id);

    // 5. Transactions (test WALLET_TOPUP exclusion, AZN conversion, and REFUNDED subtraction)
    const txTopup = await prisma.transaction.create({
      data: {
        userId: uInd.id,
        amount: 1000,
        currency: 'EUR',
        paymentProvider: 'WALLET_TOPUP',
        orderReference: `TOPUP-${tag}`,
        status: 'PAID',
      },
    });
    const txWalletPaid = await prisma.transaction.create({
      data: {
        dossierId: d1.id,
        userId: uInd.id,
        amount: 200,
        currency: 'EUR',
        paymentProvider: 'WALLET',
        orderReference: `ORD-${tag}-1`,
        status: 'PAID',
      },
    });
    const txAznPaid = await prisma.transaction.create({
      data: {
        dossierId: d2.id,
        userId: uAgent.id,
        amount: 370,
        currency: 'AZN',
        paymentProvider: 'STRIPE',
        orderReference: `ORD-${tag}-2`,
        status: 'PAID',
      },
    });
    const txBankPaid = await prisma.transaction.create({
      data: {
        dossierId: d3.id,
        userId: uCorp.id,
        amount: 500,
        currency: 'EUR',
        paymentProvider: 'BANK_TRANSFER',
        orderReference: `ORD-${tag}-3`,
        status: 'PAID',
      },
    });
    const txRefund = await prisma.transaction.create({
      data: {
        dossierId: d1.id,
        userId: uInd.id,
        amount: 50,
        currency: 'EUR',
        paymentProvider: 'WALLET',
        orderReference: `REF-${tag}-1`,
        status: 'REFUNDED',
      },
    });
    createdIds.transactions.push(txTopup.id, txWalletPaid.id, txAznPaid.id, txBankPaid.id, txRefund.id);

    // 6. Pending Bank Slip & Pending Payout
    const slip = await prisma.bankPaymentReceipt.create({
      data: {
        dossierId: d4.id,
        userId: uInd.id,
        purpose: 'DOSSIER_PAYMENT',
        fileUrl: '/uploads/slip.pdf',
        fileName: 'slip.pdf',
        amount: 300,
        currency: 'EUR',
        referenceCode: `SLIP-${tag}`,
        status: 'PENDING',
      },
    });
    createdIds.bankSlips.push(slip.id);

    const payout = await prisma.payoutRequest.create({
      data: {
        walletId: wAgent.id,
        amount: 180,
        bankName: 'Test Bank',
        iban: 'AZ00TEST00000000001',
        swiftBic: 'TESTAZ22',
        status: 'PENDING',
      },
    });
    createdIds.payouts.push(payout.id);

    // 7. Tomorrow's TimeSlot (+20 capacity, +12 booked) & Confirmed Appointment (+1)
    const tomorrowUtc = new Date();
    tomorrowUtc.setUTCDate(tomorrowUtc.getUTCDate() + 1);
    tomorrowUtc.setUTCHours(0, 0, 0, 0);
    const tomorrowKey = tomorrowUtc.toISOString().slice(0, 10);

    const slot = await prisma.timeSlot.create({
      data: {
        date: tomorrowUtc,
        slotDate: tomorrowKey,
        monthKey: tomorrowKey.slice(0, 7),
        startTime: '10:30',
        capacity: 20,
        bookedCount: 12,
        location: 'EuroTech Analytics Test Center',
        isActive: true,
        slotStatus: 'AVAILABLE',
        countryId: cA.id,
      },
    });
    createdIds.slots.push(slot.id);

    const appt = await prisma.appointment.create({
      data: {
        bookingCode: `AP-${tag}`,
        timeSlotId: slot.id,
        userId: uInd.id,
        dossierId: d1.id,
        status: 'CONFIRMED',
        groupSize: 2,
      },
    });
    createdIds.appointments.push(appt.id);

    // 8. Active Promo Code & Applied Redemption (+40 EUR discount)
    const promo = await prisma.promoCode.create({
      data: {
        code: `PROMO_${tag}`,
        title: 'Analytics Test Promo',
        discountType: 'FIXED_EUR',
        discountValue: 40,
        status: 'ACTIVE',
      },
    });
    createdIds.promos.push(promo.id);

    const redemp = await prisma.promoCodeRedemption.create({
      data: {
        promoCodeId: promo.id,
        promoCodeSnapshot: promo.code,
        discountTypeSnapshot: 'FIXED_EUR',
        discountValueSnapshot: 40,
        userId: uInd.id,
        portalType: 'INDIVIDUAL',
        scope: 'DOSSIER_PAYMENT',
        paymentMethod: 'WALLET',
        dossierId: d1.id,
        originalAmountEur: 200,
        eligibleAmountEur: 200,
        discountAmountEur: 40,
        finalAmountEur: 160,
        status: 'APPLIED',
        confirmedAt: new Date(),
      },
    });
    createdIds.redemptions.push(redemp.id);

    // =========================================================================
    // RUN ANALYTICS QUERIES & ASSERT EXACT MATH
    // =========================================================================
    const [an7, an30, an90, an12m, anAll, anInd, anAgent, anCorp, afterSummary] = await Promise.all([
      adminAnalyticsService.getExecutiveAnalytics({ range: '7D', portalType: 'ALL' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'ALL' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: '90D', portalType: 'ALL' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: '12M', portalType: 'ALL' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: 'ALL', portalType: 'ALL' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'INDIVIDUAL' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'GROUP_AGENT' }),
      adminAnalyticsService.getExecutiveAnalytics({ range: '30D', portalType: 'CORPORATE' }),
      adminService.getDashboardMetrics(),
    ]);

    // Test 1: Continuous Zero-Gap Time-Series Bucket Lengths
    assert(
      an7.timeSeries.length === 7 &&
        an30.timeSeries.length === 30 &&
        an90.timeSeries.length === 13 &&
        an12m.timeSeries.length === 12 &&
        anAll.timeSeries.length >= 6,
      '1. Continuous time-series bucket lengths (7D=7, 30D=30, 90D=13, 12M=12, ALL>=6)',
      `Got 7D=${an7.timeSeries.length}, 30D=${an30.timeSeries.length}, 90D=${an90.timeSeries.length}, 12M=${an12m.timeSeries.length}, ALL=${anAll.timeSeries.length}`
    );

    // Test 2: Exact Net Earned Revenue Math (excludes WALLET_TOPUP, converts AZN->EUR, deducts REFUNDED)
    const expectedAznEur = convertToEur(370, 'AZN', rate);
    const expectedTotalRevDelta = Number((200 + expectedAznEur + 500 - 50).toFixed(2));
    const actualRevDelta = Number((an30.kpis.netRevenueEur - baseAll30.kpis.netRevenueEur).toFixed(2));
    const actualSummaryRevDelta = Number((afterSummary.totalRevenue - baseSummary.totalRevenue).toFixed(2));

    assert(
      approxEq(actualRevDelta, expectedTotalRevDelta) && approxEq(actualSummaryRevDelta, expectedTotalRevDelta),
      '2. Net Revenue excludes WALLET_TOPUP, converts AZN->EUR, and subtracts REFUNDED in both /analytics and /metrics',
      `Expected delta +${expectedTotalRevDelta} EUR; analytics delta=${actualRevDelta}, metrics delta=${actualSummaryRevDelta}`
    );

    // Test 3: Portal Filter Isolation (INDIVIDUAL, GROUP_AGENT, CORPORATE)
    const indRevDelta = Number((anInd.kpis.netRevenueEur - baseInd30.kpis.netRevenueEur).toFixed(2));
    const agentRevDelta = Number((anAgent.kpis.netRevenueEur - baseAgent30.kpis.netRevenueEur).toFixed(2));
    const corpRevDelta = Number((anCorp.kpis.netRevenueEur - baseCorp30.kpis.netRevenueEur).toFixed(2));

    assert(
      anInd.kpis.totalApplications - baseInd30.kpis.totalApplications === 2 &&
        anAgent.kpis.totalApplications - baseAgent30.kpis.totalApplications === 1 &&
        anCorp.kpis.totalApplications - baseCorp30.kpis.totalApplications === 1 &&
        approxEq(indRevDelta, 150) &&
        approxEq(agentRevDelta, expectedAznEur) &&
        approxEq(corpRevDelta, 500),
      '3. Portal filter isolation (dossiers & net revenue split exactly per portal)',
      `Ind rev=${indRevDelta} (exp 150), Agent rev=${agentRevDelta} (exp ${expectedAznEur}), Corp rev=${corpRevDelta} (exp 500)`
    );

    // Test 4: Applications, Travelers (Pax), and Pipeline Stage Deltas
    const appDelta = an30.kpis.totalApplications - baseAll30.kpis.totalApplications;
    const paxDelta = an30.kpis.totalApplicantsInRange - baseAll30.kpis.totalApplicantsInRange;
    const approvedDelta = an30.kpis.approvedCount - baseAll30.kpis.approvedCount;
    const rejectedDelta = an30.kpis.rejectedCount - baseAll30.kpis.rejectedCount;
    const underReviewDelta = an30.kpis.underReviewCount - baseAll30.kpis.underReviewCount;
    const corrDelta = an30.kpis.needsCorrectionCount - baseAll30.kpis.needsCorrectionCount;

    assert(
      appDelta === 4 &&
        paxDelta === 7 &&
        approvedDelta === 1 &&
        rejectedDelta === 1 &&
        underReviewDelta === 1 &&
        corrDelta === 1,
      '4. Pipeline counts & traveler (pax) aggregations match exact deltas (+4 dossiers, +7 pax)',
      `app=${appDelta}, pax=${paxDelta}, appr=${approvedDelta}, rej=${rejectedDelta}, rev=${underReviewDelta}, corr=${corrDelta}`
    );

    // Test 5: Document Verification Health Delta
    assert(
      an30.documentHealth.verified - baseAll30.documentHealth.verified === 1 &&
        an30.documentHealth.pending - baseAll30.documentHealth.pending === 1,
      '5. Document Verification Health reflects +1 VERIFIED and +1 PENDING document',
      `verified delta=${an30.documentHealth.verified - baseAll30.documentHealth.verified}, pending delta=${an30.documentHealth.pending - baseAll30.documentHealth.pending}`
    );

    // Test 6: Treasury Wallet Float by Portal + Pending Bank Slips & Payouts
    const floatDelta = Number((an30.treasury.totalWalletFloatEur - baseAll30.treasury.totalWalletFloatEur).toFixed(2));
    const slipCountDelta = an30.treasury.pendingBankSlipsCount - baseAll30.treasury.pendingBankSlipsCount;
    const slipEurDelta = Number((an30.treasury.pendingBankSlipsEur - baseAll30.treasury.pendingBankSlipsEur).toFixed(2));
    const payoutCountDelta = an30.treasury.pendingPayoutsCount - baseAll30.treasury.pendingPayoutsCount;
    const payoutEurDelta = Number((an30.treasury.pendingPayoutsEur - baseAll30.treasury.pendingPayoutsEur).toFixed(2));

    assert(
      approxEq(floatDelta, 2500) &&
        approxEq(an30.treasury.walletFloatByPortal.INDIVIDUAL - baseAll30.treasury.walletFloatByPortal.INDIVIDUAL, 500) &&
        approxEq(an30.treasury.walletFloatByPortal.GROUP_AGENT - baseAll30.treasury.walletFloatByPortal.GROUP_AGENT, 1200) &&
        approxEq(an30.treasury.walletFloatByPortal.CORPORATE - baseAll30.treasury.walletFloatByPortal.CORPORATE, 800) &&
        slipCountDelta === 1 &&
        approxEq(slipEurDelta, 300) &&
        payoutCountDelta === 1 &&
        approxEq(payoutEurDelta, 180),
      '6. Treasury ledger (Wallet Float +2500 EUR by portal, Pending Slips +300 EUR, Pending Payouts +180 EUR)',
      `float=${floatDelta}, slip=${slipCountDelta}/${slipEurDelta}, payout=${payoutCountDelta}/${payoutEurDelta}`
    );

    // Test 7: 14-Day Slot Capacity & Appointments
    const capDelta = an30.appointments.totalCapacityNext14d - baseAll30.appointments.totalCapacityNext14d;
    const bookedDelta = an30.appointments.totalBookedNext14d - baseAll30.appointments.totalBookedNext14d;
    const upcomingApptDelta = an30.appointments.upcomingConfirmedCount - baseAll30.appointments.upcomingConfirmedCount;
    assert(
      an30.appointments.dailyCapacity.length === 14 &&
        capDelta === 20 &&
        bookedDelta === 12 &&
        upcomingApptDelta === 1,
      '7. Biometric 14-day slot capacity (+20 cap, +12 booked) & upcoming confirmed appointment (+1)',
      `days=${an30.appointments.dailyCapacity.length}, cap=${capDelta}, booked=${bookedDelta}, upcoming=${upcomingApptDelta}`
    );

    // Test 8: Promo Code Impact Analytics
    const activePromoDelta = an30.promoImpact.activeCodesCount - baseAll30.promoImpact.activeCodesCount;
    const promoRedempDelta = an30.promoImpact.redemptionsCount - baseAll30.promoImpact.redemptionsCount;
    const promoDiscDelta = Number((an30.promoImpact.totalDiscountEur - baseAll30.promoImpact.totalDiscountEur).toFixed(2));
    assert(
      activePromoDelta === 1 && promoRedempDelta === 1 && approxEq(promoDiscDelta, 40),
      '8. Promo Codes Impact (+1 active code, +1 applied redemption, +40 EUR savings)',
      `active=${activePromoDelta}, redemp=${promoRedempDelta}, disc=${promoDiscDelta}`
    );

    // Test 9: User Base & Growth
    const totalUsersDelta = an30.userGrowth.totalUsers - baseAll30.userGrowth.totalUsers;
    const newUsersDelta = an30.userGrowth.newUsersInRange - baseAll30.userGrowth.newUsersInRange;
    assert(
      totalUsersDelta === 3 &&
        newUsersDelta === 3 &&
        an30.userGrowth.byRole.INDIVIDUAL - baseAll30.userGrowth.byRole.INDIVIDUAL === 1 &&
        an30.userGrowth.byRole.AGENT_TUR_OPERATOR - baseAll30.userGrowth.byRole.AGENT_TUR_OPERATOR === 1 &&
        an30.userGrowth.byRole.CORPORATE_HR - baseAll30.userGrowth.byRole.CORPORATE_HR === 1,
      '9. User Growth (+3 total portal users, +3 new in range, exact role split)',
      `total=${totalUsersDelta}, new=${newUsersDelta}`
    );

    // Test 10: Destination Country Drill-Down Search in Dossier Registry
    const drillRes = await adminService.getAllDossiers({ search: `AnalyticsTestland A ${tag}`, limit: 10 });
    assert(
      drillRes.total === 2 && drillRes.dossiers.length === 2,
      '10. Country name drill-down search returns exact matching dossiers (2 for Testland A)',
      `Got total=${drillRes.total}`
    );

    // Test 11: Time-Series Today Bucket Matches Current Revenue & Dossier Deltas
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayBucketAfter = an7.timeSeries.find((b) => b.key === todayKey);
    const baseAn7 = baseAll30.timeSeries.find((b) => b.key === todayKey);
    const todayAppsDelta = (todayBucketAfter?.applications || 0) - (baseAn7?.applications || 0);
    const todayRevDelta = Number(((todayBucketAfter?.revenueEur || 0) - (baseAn7?.revenueEur || 0)).toFixed(2));
    assert(
      todayAppsDelta === 4 && approxEq(todayRevDelta, expectedTotalRevDelta),
      '11. Today time-series bucket captures +4 dossiers and exact net EUR revenue delta',
      `todayAppsDelta=${todayAppsDelta}, todayRevDelta=${todayRevDelta} (exp ${expectedTotalRevDelta})`
    );

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    // Full deterministic cleanup in reverse FK order
    console.log('Cleaning up isolated analytics test fixtures...');
    if (createdIds.redemptions.length) {
      await prisma.promoCodeRedemption.deleteMany({ where: { id: { in: createdIds.redemptions } } });
    }
    if (createdIds.promos.length) {
      await prisma.promoCode.deleteMany({ where: { id: { in: createdIds.promos } } });
    }
    if (createdIds.appointments.length) {
      await prisma.appointment.deleteMany({ where: { id: { in: createdIds.appointments } } });
    }
    if (createdIds.slots.length) {
      await prisma.timeSlot.deleteMany({ where: { id: { in: createdIds.slots } } });
    }
    if (createdIds.payouts.length) {
      await prisma.payoutRequest.deleteMany({ where: { id: { in: createdIds.payouts } } });
    }
    if (createdIds.bankSlips.length) {
      await prisma.bankPaymentReceipt.deleteMany({ where: { id: { in: createdIds.bankSlips } } });
    }
    if (createdIds.transactions.length) {
      await prisma.transaction.deleteMany({ where: { id: { in: createdIds.transactions } } });
    }
    if (createdIds.documents.length) {
      await prisma.applicantDocument.deleteMany({ where: { id: { in: createdIds.documents } } });
    }
    if (createdIds.applicants.length) {
      await prisma.applicant.deleteMany({ where: { id: { in: createdIds.applicants } } });
    }
    if (createdIds.dossiers.length) {
      await prisma.dossier.deleteMany({ where: { id: { in: createdIds.dossiers } } });
    }
    if (createdIds.wallets.length) {
      await prisma.wallet.deleteMany({ where: { id: { in: createdIds.wallets } } });
    }
    if (createdIds.users.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    }
    if (createdIds.visaCategories.length) {
      await prisma.visaCategory.deleteMany({ where: { id: { in: createdIds.visaCategories } } });
    }
    if (createdIds.countries.length) {
      await prisma.country.deleteMany({ where: { id: { in: createdIds.countries } } });
    }
    await prisma.$disconnect();
    console.log('Cleanup completed.');
  }
}

run().catch((err) => {
  console.error('Unhandled error in E2E analytics test:', err);
  process.exit(1);
});
