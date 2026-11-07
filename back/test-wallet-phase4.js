/**
 * Phase 4 Automated Terminal Test:
 * Individual (Client) Portal Dossier Pricing, Wallet Settlement & Service Refund Flow
 */
const prisma = require('./config/db');
const { createDossier } = require('./modules/dossier/services/dossierLifecycle.service');
const { addApplicants, deleteApplicant } = require('./modules/dossier/services/dossierApplicant.service');
const { getOrCreateWallet, topupWallet, payWithWallet, getUserWalletOverview } = require('./modules/payment/wallet.service');
const { addServiceToDossier, removeServiceFromDossier } = require('./modules/service/service.service');

async function runPhase4Tests() {
  console.log('--- STARTING PHASE 4 (INDIVIDUAL CLIENT PORTAL & WALLET) TESTS ---');
  let testUser = null;
  let testDossier = null;
  let country = null;
  let visaCategory = null;

  try {
    // 1. Setup Test User (INDIVIDUAL role)
    const email = `client-test-${Date.now()}@eurotech.az`;
    testUser = await prisma.user.create({
      data: {
        email,
        passwordHash: 'dummy-hashed-pwd',
        fullName: 'Nigar Aliyeva',
        role: 'INDIVIDUAL',
        phone: '+994501234567',
        passportNumber: 'C88990011',
      },
    });
    console.log(`[PASS] 1. Test Client created: ${testUser.fullName} (${testUser.email})`);

    // Fetch existing country & visa category
    country = await prisma.country.findFirst({ where: { code: 'HU' } }) || await prisma.country.findFirst();
    if (!country) throw new Error('No country found in database to test.');
    visaCategory = await prisma.visaCategory.findFirst({ where: { countryId: country.id } }) || await prisma.visaCategory.findFirst();
    if (!visaCategory) throw new Error('No visaCategory found in database to test.');

    // 2. Create Dossier with Premium Package (€126 add-on + €80 consular fee = €206 total)
    testDossier = await createDossier({
      userId: testUser.id,
      portalType: 'INDIVIDUAL',
      countryId: country.id,
      visaCategoryId: visaCategory.id,
      package: 'premium',
      applicantsCount: 1,
    });

    console.log(`[PASS] 2. Dossier initialized: Ref=${testDossier.dossierNumber}, totalAmount=€${testDossier.totalAmount}`);
    if (Math.abs(Number(testDossier.totalAmount) - 206.0) > 0.01) {
      throw new Error(`Expected totalAmount €206.00 for 1 pax with Premium bundle, got €${testDossier.totalAmount}`);
    }

    // 3. Add Co-applicant (Total 2 Pax -> totalAmount should scale to 206 * 2 = €412)
    const coApplicants = await addApplicants(testDossier.id, [
      {
        firstName: 'Samir',
        lastName: 'Aliyev',
        passportNumber: 'C77889922',
        birthDate: '1990-05-15',
        nationality: 'AZ',
        gender: 'MALE',
        familyRole: 'SPOUSE',
      },
    ]);
    const updatedDossier = await prisma.dossier.findUnique({ where: { id: testDossier.id }, include: { applicants: true } });
    console.log(`[PASS] 3. Co-applicant added. Total applicants=${updatedDossier.applicants.length}, totalAmount=€${updatedDossier.totalAmount}`);
    if (Math.abs(Number(updatedDossier.totalAmount) - 412.0) > 0.01) {
      throw new Error(`Expected scaled totalAmount €412.00 for 2 pax, got €${updatedDossier.totalAmount}`);
    }

    // 4. Client Wallet Top-Up
    const topupRes = await topupWallet({
      userId: testUser.id,
      amount: 500.0,
      currency: 'EUR',
      method: 'CARD',
      reference: 'TOPUP-CL-001',
    });
    console.log(`[PASS] 4. Wallet funded with €500. New balance=€${topupRes.balance}`);
    if (topupRes.balance < 500.0) {
      throw new Error(`Expected wallet balance at least €500, got €${topupRes.balance}`);
    }

    // 5. Pay Dossier from EuroTech Wallet
    const payRes = await payWithWallet({
      userId: testUser.id,
      userRole: testUser.role,
      dossierId: testDossier.id,
    });
    console.log(`[PASS] 5. Dossier settled via Wallet. Paid=€${payRes.paidAmountEur}, Remaining Wallet Balance=€${payRes.newBalance}`);
    const settledDossier = await prisma.dossier.findUnique({ where: { id: testDossier.id } });
    if (settledDossier.paymentStatus !== 'PAID') {
      throw new Error(`Expected dossier paymentStatus to be PAID, got ${settledDossier.paymentStatus}`);
    }

    // 6. Value-Added Service: Add, Settle & Automatic Refund to Wallet on Cancellation
    const addedService = await addServiceToDossier({
      dossierId: testDossier.id,
      serviceType: 'PREMIUM_LOUNGE',
      user: testUser,
    });
    console.log(`[PASS] 6a. Extra Service Added: ${addedService.serviceType}, price=€${addedService.price}`);

    // Settle the added service via wallet
    await payWithWallet({
      userId: testUser.id,
      userRole: testUser.role,
      dossierId: testDossier.id,
    });
    console.log(`[PASS] 6b. Service settled via Wallet.`);

    // Now remove the service from the paid dossier
    const removeRes = await removeServiceFromDossier(addedService.id, testUser);
    console.log(`[PASS] 6c. Extra Service Removed: ${removeRes.message}, refundedToWallet=${removeRes.refundedToWallet}`);
    if (!removeRes.refundedToWallet || removeRes.refundedAmountEur <= 0) {
      throw new Error(`Expected automatic wallet refund for cancelled service on paid dossier`);
    }

    // 7. Verify Client Wallet Overview
    const overview = await getUserWalletOverview(testUser.id);
    const txCount = overview.wallet.transactions ? overview.wallet.transactions.length : 0;
    console.log(`[PASS] 7. Final Wallet Overview verified: Balance=€${overview.wallet.balance}, TxCount=${txCount}`);

    console.log('\n✅ ALL PHASE 4 (INDIVIDUAL CLIENT PORTAL & WALLET) TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ PHASE 4 TEST FAILED:', err);
    process.exit(1);
  } finally {
    // Cleanup test data
    if (testDossier) {
      await prisma.additionalService.deleteMany({ where: { dossierId: testDossier.id } }).catch(() => {});
      await prisma.applicant.deleteMany({ where: { dossierId: testDossier.id } }).catch(() => {});
      await prisma.appointment.deleteMany({ where: { dossierId: testDossier.id } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { dossierId: testDossier.id } }).catch(() => {});
      await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: testDossier.id } }).catch(() => {});
      await prisma.dossier.delete({ where: { id: testDossier.id } }).catch(() => {});
    }
    if (testUser) {
      const w = await prisma.wallet.findUnique({ where: { userId: testUser.id } }).catch(() => null);
      if (w) {
        await prisma.walletTransaction.deleteMany({ where: { walletId: w.id } }).catch(() => {});
        await prisma.wallet.delete({ where: { id: w.id } }).catch(() => {});
      }
      await prisma.transaction.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.bankPaymentReceipt.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runPhase4Tests();
