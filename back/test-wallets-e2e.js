/**
 * Comprehensive End-to-End Test:
 * Verifies Wallet & Financial System Across ALL 4 Profiles:
 * 1. INDIVIDUAL (Client Portal)
 * 2. AGENT_TUR_OPERATOR (Tour Agent B2B Portal)
 * 3. CORPORATE_HR (Corporate Mobility Portal)
 * 4. ADMIN (Finance & Operations Desk)
 */
const prisma = require('./config/db');
const { createDossier } = require('./modules/dossier/services/dossierLifecycle.service');
const { createBatch } = require('./modules/corporate/services/corporateBatch.service');
const { createTourGroup, createGroup } = require('./modules/agent/services/agentGroup.service');
const {
  getOrCreateWallet,
  topupWallet,
  payWithWallet,
  getUserWalletOverview,
  adminGetAllWallets,
  adminAdjustWallet,
  recalculateWalletBalances,
} = require('./modules/payment/wallet.service');
const { addServiceToDossier, removeServiceFromDossier } = require('./modules/service/service.service');

async function runE2ETests() {
  console.log('================================================================');
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END WALLET VERIFICATION (ALL 4 PROFILES)');
  console.log('================================================================\n');

  let clientUser = null;
  let agentUser = null;
  let corporateUser = null;
  let adminUser = null;

  let clientDossier = null;
  let agentGroup = null;
  let corpBatch = null;

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // PROFILE 1: INDIVIDUAL CLIENT
    // -------------------------------------------------------------
    console.log('--- [1/4] TESTING INDIVIDUAL CLIENT WALLET FLOW ---');
    clientUser = await prisma.user.create({
      data: {
        email: `e2e-client-${timestamp}@eurotech.az`,
        passwordHash: 'dummy-hashed',
        fullName: 'Leyla Mammadova',
        role: 'INDIVIDUAL',
        passportNumber: 'C11223344',
      },
    });

    const huCountry = await prisma.country.findFirst({ where: { code: 'HU' } }) || await prisma.country.findFirst();
    const huVisa = await prisma.visaCategory.findFirst({ where: { countryId: huCountry.id } }) || await prisma.visaCategory.findFirst();

    // 1a. Create dossier with Premium package (€126 + €80 = €206)
    clientDossier = await createDossier({
      userId: clientUser.id,
      portalType: 'INDIVIDUAL',
      countryId: huCountry.id,
      visaCategoryId: huVisa.id,
      package: 'premium',
      applicantsCount: 1,
    });
    console.log(`✓ 1a. Client dossier created: ${clientDossier.dossierNumber}, totalAmount=€${clientDossier.totalAmount}`);

    // 1b. Fund Client Wallet with €300
    await topupWallet({
      userId: clientUser.id,
      amount: 300.0,
      currency: 'EUR',
      method: 'CARD',
      reference: `E2E-CL-TOPUP-${timestamp}`,
    });
    let clientWallet = await recalculateWalletBalances((await getOrCreateWallet(clientUser.id)).id);
    console.log(`✓ 1b. Client wallet funded: €${clientWallet.balance}`);

    // 1c. Settle dossier via Wallet
    await payWithWallet({
      userId: clientUser.id,
      userRole: clientUser.role,
      dossierId: clientDossier.id,
    });
    const paidClientDos = await prisma.dossier.findUnique({ where: { id: clientDossier.id } });
    clientWallet = await recalculateWalletBalances((await getOrCreateWallet(clientUser.id)).id);
    console.log(`✓ 1c. Client dossier paid: status=${paidClientDos.paymentStatus}, remaining balance=€${clientWallet.balance}`);
    if (paidClientDos.paymentStatus !== 'PAID') throw new Error('Client dossier failed to mark PAID');

    // 1d. Add extra service, settle, and remove -> auto-refund to wallet
    const extraSvc = await addServiceToDossier({
      dossierId: clientDossier.id,
      serviceType: 'PREMIUM_LOUNGE',
      user: clientUser,
    });
    await payWithWallet({
      userId: clientUser.id,
      userRole: clientUser.role,
      dossierId: clientDossier.id,
    });
    const refundResult = await removeServiceFromDossier(extraSvc.id, clientUser);
    clientWallet = await recalculateWalletBalances((await getOrCreateWallet(clientUser.id)).id);
    console.log(`✓ 1d. Client service cancelled & refunded to wallet: ${refundResult.message}, balance=€${clientWallet.balance}\n`);

    // -------------------------------------------------------------
    // PROFILE 2: TOUR OPERATOR AGENT
    // -------------------------------------------------------------
    console.log('--- [2/4] TESTING TOUR AGENT B2B WALLET & COMMISSIONS ---');
    agentUser = await prisma.user.create({
      data: {
        email: `e2e-agent-${timestamp}@eurotech.az`,
        passwordHash: 'dummy-hashed',
        fullName: 'Rashad Travel Agency',
        role: 'AGENT_TUR_OPERATOR',
        agentTier: 'BRONZE',
      },
    });

    // 2a. Create Tour Group with 2 travelers
    agentGroup = await createGroup({
      userId: agentUser.id,
      name: 'E2E Budapest Explorer Delegation',
      destination: 'Hungary',
      package: 'standard',
      applicants: [
        { firstName: 'Anar', lastName: 'Guliyev', passportNumber: 'P010101', birthDate: '1992-04-10' },
        { firstName: 'Gunel', lastName: 'Guliyeva', passportNumber: 'P020202', birthDate: '1994-08-20' },
      ],
    });
    console.log(`✓ 2a. Agent group created: Code=${agentGroup.code}, dossiersCount=${agentGroup.dossiers.length}`);

    // 2b. Fund Agent Wallet with €500
    await topupWallet({
      userId: agentUser.id,
      amount: 500.0,
      currency: 'EUR',
      method: 'CARD',
      reference: `E2E-AG-TOPUP-${timestamp}`,
    });
    let agentWallet = await recalculateWalletBalances((await getOrCreateWallet(agentUser.id)).id);
    console.log(`✓ 2b. Agent wallet pre-funded: €${agentWallet.balance}, pending commissions=€${agentWallet.pendingBalance}`);

    // 2c. Pay Group fees with Agency Wallet (2 pax * €145 = €290)
    const agentPayResult = await payWithWallet({
      userId: agentUser.id,
      userRole: agentUser.role,
      groupBatchId: agentGroup.id,
    });
    agentWallet = await recalculateWalletBalances((await getOrCreateWallet(agentUser.id)).id);
    console.log(`✓ 2c. Agent group settled from wallet: paid=€${agentPayResult.paidAmountEur}, Commission earned=€${agentPayResult.commissionSettledEur}, new balance=€${agentWallet.balance}`);
    if (agentPayResult.commissionSettledEur <= 0) throw new Error('Expected partner commission to settle upon group payment');
    console.log('');

    // -------------------------------------------------------------
    // PROFILE 3: CORPORATE HR
    // -------------------------------------------------------------
    console.log('--- [3/4] TESTING CORPORATE HR MOBILITY WALLET ---');
    corporateUser = await prisma.user.create({
      data: {
        email: `e2e-corp-${timestamp}@eurotech.az`,
        passwordHash: 'dummy-hashed',
        fullName: 'SOCAR Mobility Desk',
        role: 'CORPORATE_HR',
        companyName: 'SOCAR Energy LLC',
      },
    });

    // 3a. Create Corporate Batch with 2 employees
    corpBatch = await createBatch({
      userId: corporateUser.id,
      name: 'Vienna Tech Summit Delegation',
      destination: 'Austria',
      package: 'standard',
      employees: [
        { firstName: 'Eldar', lastName: 'Gasimov', passportNumber: 'C990011', department: 'IT', birthDate: '1988-02-14' },
        { firstName: 'Aysel', lastName: 'Jafarova', passportNumber: 'C990022', department: 'Legal', birthDate: '1991-11-05' },
      ],
    });
    console.log(`✓ 3a. Corporate batch created: Code=${corpBatch.code}, Invoice=${corpBatch.invoice ? corpBatch.invoice.invoiceNumber : 'Created'}`);

    // 3b. Fund Company Wallet with €600
    await topupWallet({
      userId: corporateUser.id,
      amount: 600.0,
      currency: 'EUR',
      method: 'CARD',
      reference: `E2E-CORP-TOPUP-${timestamp}`,
    });
    let corpWallet = await recalculateWalletBalances((await getOrCreateWallet(corporateUser.id)).id);
    console.log(`✓ 3b. Company wallet funded: €${corpWallet.balance}`);

    // 3c. Pay Corporate Proforma Invoice from Company Wallet (2 pax * €145 = €290)
    const corpPayResult = await payWithWallet({
      userId: corporateUser.id,
      userRole: corporateUser.role,
      groupBatchId: corpBatch.id,
    });
    corpWallet = await recalculateWalletBalances((await getOrCreateWallet(corporateUser.id)).id);
    console.log(`✓ 3c. Corporate batch settled from company wallet: paid=€${corpPayResult.paidAmountEur}, remaining balance=€${corpWallet.balance}`);
    const settledCorpBatch = await prisma.groupBatch.findUnique({
      where: { id: corpBatch.id },
      include: { invoices: true, dossiers: true },
    });
    if (settledCorpBatch.invoices.some(i => i.status !== 'PAID')) {
      throw new Error('Corporate invoice failed to mark PAID');
    }
    console.log('');

    // -------------------------------------------------------------
    // PROFILE 4: ADMIN FINANCE DESK
    // -------------------------------------------------------------
    console.log('--- [4/4] TESTING ADMIN FINANCE DESK OVERSIGHT & ADJUSTMENT ---');
    adminUser = await prisma.user.create({
      data: {
        email: `e2e-admin-${timestamp}@eurotech.az`,
        passwordHash: 'dummy-hashed',
        fullName: 'Chief Finance Officer',
        role: 'ADMIN',
      },
    });

    // 4a. Oversee all user wallets
    const allWallets = await adminGetAllWallets({ role: 'ALL' });
    console.log(`✓ 4a. Admin fetched all wallets: count=${allWallets.length}`);
    const foundClient = allWallets.find(w => w.userId === clientUser.id);
    const foundAgent = allWallets.find(w => w.userId === agentUser.id);
    const foundCorp = allWallets.find(w => w.userId === corporateUser.id);
    if (!foundClient || !foundAgent || !foundCorp) {
      throw new Error('Admin failed to locate wallets for all active profiles');
    }
    console.log(`    - Individual Client (${foundClient.fullName}): Balance=€${foundClient.balance}`);
    console.log(`    - Tour Operator (${foundAgent.fullName}): Balance=€${foundAgent.balance}`);
    console.log(`    - Corporate HR (${foundCorp.fullName}): Balance=€${foundCorp.balance}`);

    // 4b. Perform administrative credit adjustment (+€75 goodwill credit)
    const adjResult = await adminAdjustWallet({
      targetUserId: clientUser.id,
      amount: 75.0,
      type: 'CREDIT',
      reason: 'E2E Goodwill Promotion Credit',
      adminUserId: adminUser.id,
    });
    console.log(`✓ 4b. Admin adjusted client balance: new balance=€${adjResult.balance}`);
    if (adjResult.balance !== foundClient.balance + 75.0) {
      throw new Error(`Expected balance €${foundClient.balance + 75.0}, got €${adjResult.balance}`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL 4 PROFILES & WALLETS VERIFIED SUCCESSFULLY (END-TO-END)!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ E2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    // Teardown E2E test data cleanly
    console.log('Cleaning up test records...');
    const userIds = [clientUser?.id, agentUser?.id, corporateUser?.id, adminUser?.id].filter(Boolean);
    const batchIds = [agentGroup?.id, corpBatch?.id].filter(Boolean);
    const dossierIds = [clientDossier?.id].filter(Boolean);

    for (const bId of batchIds) {
      const bDossiers = await prisma.dossier.findMany({ where: { groupBatchId: bId } });
      for (const d of bDossiers) {
        await prisma.applicant.deleteMany({ where: { dossierId: d.id } }).catch(() => {});
        await prisma.additionalService.deleteMany({ where: { dossierId: d.id } }).catch(() => {});
        await prisma.transaction.deleteMany({ where: { dossierId: d.id } }).catch(() => {});
        await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: d.id } }).catch(() => {});
      }
      await prisma.appointment.deleteMany({ where: { groupBatchId: bId } }).catch(() => {});
      await prisma.corporateInvoice.deleteMany({ where: { groupBatchId: bId } }).catch(() => {});
      await prisma.dossier.deleteMany({ where: { groupBatchId: bId } }).catch(() => {});
      await prisma.groupBatch.delete({ where: { id: bId } }).catch(() => {});
    }

    for (const dId of dossierIds) {
      await prisma.additionalService.deleteMany({ where: { dossierId: dId } }).catch(() => {});
      await prisma.applicant.deleteMany({ where: { dossierId: dId } }).catch(() => {});
      await prisma.appointment.deleteMany({ where: { dossierId: dId } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { dossierId: dId } }).catch(() => {});
      await prisma.dossierStatusHistory.deleteMany({ where: { dossierId: dId } }).catch(() => {});
      await prisma.dossier.delete({ where: { id: dId } }).catch(() => {});
    }

    for (const uId of userIds) {
      const w = await prisma.wallet.findUnique({ where: { userId: uId } }).catch(() => null);
      if (w) {
        await prisma.walletTransaction.deleteMany({ where: { walletId: w.id } }).catch(() => {});
        await prisma.payoutRequest.deleteMany({ where: { walletId: w.id } }).catch(() => {});
        await prisma.wallet.delete({ where: { id: w.id } }).catch(() => {});
      }
      await prisma.transaction.deleteMany({ where: { userId: uId } }).catch(() => {});
      await prisma.bankPaymentReceipt.deleteMany({ where: { userId: uId } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: uId } }).catch(() => {});
      await prisma.user.delete({ where: { id: uId } }).catch(() => {});
    }

    await prisma.$disconnect();
  }
}

runE2ETests();
