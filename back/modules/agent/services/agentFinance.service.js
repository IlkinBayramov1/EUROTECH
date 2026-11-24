const prisma = require('../../../config/db');
const pdfUtil = require('../../../utils/pdf.util');
const { calculatePortalFees, getAgentCommissionRate } = require('../../../utils/finance.util');
const { getPricingCatalog } = require('../../service/pricingConfig.service');
const walletService = require('../../payment/wallet.service');

const TIER_RANK = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
};

async function getAgentWallet(userId) {
  const [catalog, eurToAznRate] = await Promise.all([
    getPricingCatalog(),
    walletService.getEurToAznRate(),
  ]);

  let wallet = await walletService.getOrCreateWallet(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agentTier: true, fullName: true, companyName: true },
  });
  let tier = String(user?.agentTier || 'BRONZE').toUpperCase();

  // Retrieve all groups for this agent with dossiers and applicants
  const allGroups = await prisma.groupBatch.findMany({
    where: { userId },
    include: {
      dossiers: {
        include: {
          applicants: true,
          country: true,
          visaCategory: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Auto-heal any legacy GroupBatch that has 0 linked dossiers so paymentStatus & fees match DB
  for (const group of allGroups) {
    if (!group.dossiers || group.dossiers.length === 0) {
      await walletService.ensureGroupBatchPrimaryDossierInTx(prisma, group, catalog);
    }
  }

  const paidBatchIds = new Set();
  try {
    const paidTxs = await prisma.transaction.findMany({
      where: { userId, status: 'PAID' },
      select: { metadataJson: true, dossierId: true },
    });
    paidTxs.forEach((t) => {
      const meta = t.metadataJson && typeof t.metadataJson === 'object' ? t.metadataJson : {};
      if (meta.groupBatchId) paidBatchIds.add(meta.groupBatchId);
    });
  } catch {}

  let totalPaxLifetime = 0;
  let totalPaxDraft = 0;

  // First pass: calculate lifetime paid pax and auto-advance paid DRAFT groups to PROCESSING
  for (const group of allGroups) {
    let paxCount = 0;
    group.dossiers.forEach((d) => {
      paxCount += d.applicants ? d.applicants.length : 0;
    });

    const isPaid =
      (group.dossiers.length > 0 && group.dossiers.every((d) => d.paymentStatus === 'PAID')) ||
      paidBatchIds.has(group.id);
    if (isPaid && group.status === 'DRAFT') {
      await prisma.groupBatch.update({
        where: { id: group.id },
        data: { status: 'PROCESSING' },
      });
      group.status = 'PROCESSING';
    }

    const isProcessed =
      isPaid && ['PROCESSING', 'READY', 'COMPLETED'].includes(String(group.status || '').toUpperCase());

    if (isProcessed) {
      totalPaxLifetime += paxCount;
    } else {
      totalPaxDraft += paxCount;
    }
  }

  // Auto-upgrade agentTier based on lifetime paid pax (never downgrade if Admin promoted higher)
  let computedTier = 'BRONZE';
  if (totalPaxLifetime >= 120) computedTier = 'PLATINUM';
  else if (totalPaxLifetime >= 60) computedTier = 'GOLD';
  else if (totalPaxLifetime >= 25) computedTier = 'SILVER';

  if ((TIER_RANK[computedTier] || 1) > (TIER_RANK[tier] || 1)) {
    tier = computedTier;
    await prisma.user.update({
      where: { id: userId },
      data: { agentTier: tier },
    }).catch(() => {});
  }

  const ratePerPax = getAgentCommissionRate(tier, catalog);

  // Second pass: synchronize commission transactions for every group
  for (const group of allGroups) {
    let paxCount = 0;
    group.dossiers.forEach((d) => {
      paxCount += d.applicants ? d.applicants.length : 0;
    });

    const isPaid =
      (group.dossiers.length > 0 && group.dossiers.every((d) => d.paymentStatus === 'PAID')) ||
      paidBatchIds.has(group.id);
    const isProcessed =
      isPaid && ['PROCESSING', 'READY', 'COMPLETED'].includes(String(group.status || '').toUpperCase());

    if (paxCount > 0) {
      const commissionAmount = Number((paxCount * ratePerPax).toFixed(2));
      const expectedStatus = isProcessed ? 'PAID' : 'PENDING';
      const expectedDesc =
        expectedStatus === 'PENDING'
          ? `Pending Commission: ${group.name} (${paxCount} Pax @ €${ratePerPax.toFixed(2)} [${tier}])`
          : `Commission: ${group.name} (${paxCount} Pax @ €${ratePerPax.toFixed(2)} [${tier}])`;

      const existingTx = await prisma.walletTransaction.findFirst({
        where: {
          walletId: wallet.id,
          referenceId: group.code,
          referenceType: 'COMMISSION',
        },
      });

      if (!existingTx) {
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: commissionAmount,
            type: 'CREDIT',
            referenceType: 'COMMISSION',
            referenceId: group.code,
            description: expectedDesc,
            status: expectedStatus,
          },
        });
      } else if (
        existingTx.status === 'PENDING' &&
        (existingTx.status !== expectedStatus ||
          Math.abs(Number(existingTx.amount) - commissionAmount) > 0.01 ||
          existingTx.description !== expectedDesc)
      ) {
        // Never overwrite already-settled PAID or promo-waived REFUNDED commission rows
        await prisma.walletTransaction.update({
          where: { id: existingTx.id },
          data: {
            amount: commissionAmount,
            status: expectedStatus,
            description: expectedDesc,
          },
        });
      }
    }
  }

  // Deterministically recalculate wallet balances using unified wallet engine
  const summary = await walletService.recalculateWalletBalances(wallet.id);
  wallet = summary.wallet;

  const [updatedTransactions, payoutRequests, rawBankSlips] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.payoutRequest.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.bankPaymentReceipt.findMany({
      where: { userId },
      include: {
        groupBatch: { select: { id: true, code: true, name: true } },
        dossier: { select: { id: true, dossierNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  let totalEarnedYtd = 0;
  updatedTransactions.forEach((tx) => {
    if (tx.type === 'CREDIT' && tx.status === 'PAID' && tx.referenceType === 'COMMISSION') {
      totalEarnedYtd += Number(tx.amount || 0);
    }
  });
  totalEarnedYtd = Number(totalEarnedYtd.toFixed(2));

  const bankSlips = rawBankSlips.map((s) => {
    const meta = s.metadataJson && typeof s.metadataJson === 'object' ? s.metadataJson : {};
    return {
      ...s,
      bankName: meta.bankName || s.bankName || 'Bank Wire Transfer',
      senderName: meta.senderName || user?.companyName || user?.fullName || 'Travel Agency Partner',
      groupCode: s.groupBatch?.code || null,
      groupName: s.groupBatch?.name || null,
      displayStatus: s.status === 'PAID' ? 'APPROVED' : s.status === 'REFUNDED' ? 'REJECTED' : s.status,
    };
  });
  const pendingBankSlips = bankSlips.filter((s) => s.status === 'PENDING');

  // Build group invoices & consular payments list using dynamic Admin catalog
  const groupInvoices = [];
  for (const g of allGroups) {
    const primaryDossier = g.dossiers?.[0];
    const allApps = g.dossiers.flatMap((d) => d.applicants || []);
    const paxCount = Math.max(1, allApps.length);
    const pkg = g.packageTier || allApps[0]?.formDataJson?.package || 'standard';
    const fees = calculatePortalFees({
      portalType: 'GROUP_AGENT',
      paxCount,
      activePackage: pkg,
      duration: g.duration || 'short',
      catalog,
    });
    const govFee = primaryDossier?.governmentFee ? Number(primaryDossier.governmentFee) * paxCount : fees.totalGovFee;
    const srvFee = primaryDossier?.serviceFee
      ? Number(primaryDossier.serviceFee) * paxCount
      : fees.totalBaseServiceFee + fees.totalPackageAddOnFee;
    const totalAmount =
      primaryDossier?.totalAmount && Number(primaryDossier.totalAmount) > 0
        ? Number(primaryDossier.totalAmount)
        : fees.grandTotalEur;

    const isPaid =
      (g.dossiers.length > 0 && g.dossiers.every((d) => d.paymentStatus === 'PAID')) ||
      paidBatchIds.has(g.id);
    const discountAmountEur = Number(g.discountAmount || primaryDossier?.discountAmount || 0);
    const appliedPromoCode = g.appliedPromoCode || primaryDossier?.appliedPromoCode || null;
    const netTotalAfterDiscount = Math.max(0, Number((totalAmount - discountAmountEur).toFixed(2)));
    const paidAmountEur = isPaid ? netTotalAfterDiscount : 0;
    const dueAmountEur = isPaid ? 0 : netTotalAfterDiscount;

    groupInvoices.push({
      groupId: g.id,
      dossierId: primaryDossier?.id || null,
      groupCode: g.code,
      groupName: g.name,
      destination: g.destination,
      package: pkg,
      paxCount: allApps.length,
      governmentFee: govFee,
      serviceFee: srvFee,
      totalAmount,
      discountAmountEur,
      appliedPromoCode,
      paidAmountEur,
      dueAmountEur,
      estimatedCommissionEur: Number((allApps.length * ratePerPax).toFixed(2)),
      currency: 'EUR',
      paymentStatus: isPaid ? 'PAID' : primaryDossier?.paymentStatus || 'PENDING',
      groupStatus: g.status,
      createdDate: g.createdAt ? new Date(g.createdAt).toISOString().split('T')[0] : 'Recent',
      travelDate: g.travelDate ? new Date(g.travelDate).toISOString().split('T')[0] : 'Flexible',
    });
  }

  const unpaidGroupFeesTotal = Number(
    groupInvoices
      .filter((i) => i.paymentStatus !== 'PAID')
      .reduce((acc, i) => acc + Number(i.dueAmountEur ?? i.totalAmount ?? 0), 0)
      .toFixed(2)
  );

  const balanceEur = Number(summary.balance || 0);
  const balanceAzn = Number((balanceEur * eurToAznRate).toFixed(2));
  const pendingBalanceEur = Number(summary.pendingBalance || 0);
  const pendingBalanceAzn = Number((pendingBalanceEur * eurToAznRate).toFixed(2));

  const commissionRates = {
    BRONZE: getAgentCommissionRate('BRONZE', catalog),
    SILVER: getAgentCommissionRate('SILVER', catalog),
    GOLD: getAgentCommissionRate('GOLD', catalog),
    PLATINUM: getAgentCommissionRate('PLATINUM', catalog),
  };

  return {
    ...wallet,
    balance: balanceEur,
    balanceEur,
    balanceAzn,
    pendingBalance: pendingBalanceEur,
    pendingBalanceAzn,
    totalEarnedYtd,
    totalTopups: summary.totalTopups,
    totalDepositedEur: summary.totalTopups,
    totalSpent: summary.totalSpent,
    totalSpentEur: summary.totalSpent,
    unpaidGroupFeesTotal,
    exchangeRate: eurToAznRate,
    agentTier: tier,
    ratePerPax,
    commissionRates,
    totalPaxLifetime,
    totalPaxDraft,
    transactions: updatedTransactions,
    payoutRequests,
    bankSlips,
    pendingBankSlips,
    groupInvoices,
  };
}

async function topupAgentWallet(userId, payload = {}) {
  const { amount, currency, method, paymentMethod, reference, referenceCode } = payload;
  const topupResult = await walletService.topupWallet({
    userId,
    amount,
    currency: currency || 'EUR',
    method: method || paymentMethod || 'CARD',
    reference: reference || referenceCode || `AG-TOPUP-${Date.now().toString().slice(-6)}`,
  });
  const updatedWallet = await getAgentWallet(userId);
  return {
    ...topupResult,
    wallet: updatedWallet,
  };
}

async function payGroupWithWallet(groupId, userId, userRole = 'AGENT', options = {}) {
  const settlement = await walletService.payWithWallet({
    userId,
    userRole,
    groupBatchId: groupId,
    promoCode: options.promoCode || null,
    scope: 'GROUP_BATCH_PAYMENT',
    source: options.source || null,
  });
  const updatedWallet = await getAgentWallet(userId);
  return {
    ...settlement,
    wallet: updatedWallet,
  };
}

async function generateGroupInvoicePdf(groupId, userId, isStaff = false) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, ...(isStaff ? {} : { userId }) },
    include: {
      dossiers: {
        include: {
          applicants: true,
          country: true,
          visaCategory: true,
        },
      },
    },
  });

  if (!group) {
    const err = new Error('Group not found');
    err.statusCode = 404;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: group.userId } });
  const primaryDossier = group.dossiers[0] || {
    dossierNumber: group.code,
    applicants: [],
    governmentFee: 80.0,
    serviceFee: 35.0,
    extraServicesFee: 0.0,
    totalAmount: 115.0,
  };

  return pdfUtil.generateGroupInvoicePdf(primaryDossier, user);
}

async function requestPayout({ userId, amount, currency = 'EUR', bankName, iban, swiftBic, accountHolder }) {
  const result = await walletService.requestWalletPayout({
    userId,
    amount,
    currency: currency || 'EUR',
    bankName,
    iban,
    swiftBic,
    accountHolder,
  });
  return result.payout;
}

async function exportTransactionsCsv(userId) {
  const walletData = await getAgentWallet(userId);
  const rows = ['Category,Reference ID,Type,Description,Amount (EUR),Status,Date'];

  (walletData.transactions || []).forEach((tx) => {
    const dateStr = tx.createdAt ? new Date(tx.createdAt).toISOString().split('T')[0] : '';
    const desc = (tx.description || '').replace(/"/g, '""');
    const isCredit = tx.type === 'CREDIT' || (tx.type !== 'DEBIT' && Number(tx.amount) > 0);
    const amtStr = `${isCredit ? '+' : '-'}${Math.abs(Number(tx.amount || 0)).toFixed(2)}`;
    rows.push(
      `"WALLET_TX","${tx.referenceId || tx.id}","${tx.referenceType || tx.type}","${desc}","${amtStr}","${tx.status}","${dateStr}"`
    );
  });

  (walletData.bankSlips || []).forEach((s) => {
    const dateStr = s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '';
    const desc = `${s.bankName || 'Bank Wire'} - ${s.purpose || 'Payment'}`.replace(/"/g, '""');
    rows.push(
      `"BANK_SLIP","${s.referenceCode || s.id}","WIRE_SLIP","${desc}","${Number(s.amount || 0).toFixed(2)}","${s.displayStatus || s.status}","${dateStr}"`
    );
  });

  (walletData.payoutRequests || []).forEach((p) => {
    const dateStr = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '';
    const desc = `${p.bankName || 'Bank'} (${p.iban || ''})`.replace(/"/g, '""');
    rows.push(
      `"PAYOUT","PO-${String(p.id).substring(0, 8).toUpperCase()}","WITHDRAWAL","${desc}","-${Number(p.amount || 0).toFixed(2)}","${p.status}","${dateStr}"`
    );
  });

  return rows.join('\n');
}

async function saveBankDetails(userId, { bankName, iban, swiftBic, accountHolder }) {
  const updated = await walletService.saveWalletBankDetails(userId, {
    bankName,
    iban,
    swiftBic,
    accountHolder,
  });
  return {
    success: true,
    ...updated,
  };
}

module.exports = {
  getAgentWallet,
  topupAgentWallet,
  payGroupWithWallet,
  generateGroupInvoicePdf,
  requestPayout,
  exportTransactionsCsv,
  saveBankDetails,
};
