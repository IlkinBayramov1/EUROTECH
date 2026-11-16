const prisma = require('../../../config/db');
const pdfUtil = require('../../../utils/pdf.util');
const { calculatePortalFees, getAgentCommissionRate } = require('../../../utils/finance.util');
const { getPricingCatalog } = require('../../service/pricingConfig.service');

async function getAgentWallet(userId) {
  const catalog = await getPricingCatalog();
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
      payoutRequests: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
      include: {
        transactions: true,
        payoutRequests: true,
      },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { agentTier: true } });
  const tier = user?.agentTier || 'BRONZE';
  const ratePerPax = getAgentCommissionRate(tier, catalog);

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

  let totalPaxLifetime = 0;
  let totalPaxDraft = 0;

  // Synchronize / ensure commission records exist for every group
  for (const group of allGroups) {
    let paxCount = 0;
    group.dossiers.forEach((d) => {
      paxCount += (d.applicants ? d.applicants.length : 0);
    });

    const isPaid = group.dossiers.some((d) => d.paymentStatus === 'PAID');
    const isProcessed = isPaid && (group.status === 'PROCESSING' || group.status === 'READY' || group.status === 'COMPLETED');

    if (isProcessed) {
      totalPaxLifetime += paxCount;
    } else {
      totalPaxDraft += paxCount;
    }

    if (paxCount > 0) {
      const commissionAmount = paxCount * ratePerPax;
      const expectedStatus = isProcessed ? 'PAID' : 'PENDING';

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
            description: expectedStatus === 'PENDING'
              ? `Pending Commission: ${group.name} (${paxCount} Pax @ €${ratePerPax} [${tier}])`
              : `Commission: ${group.name} (${paxCount} Pax @ €${ratePerPax} [${tier}])`,
            status: expectedStatus,
          },
        });
      } else {
        // Keep status, amount and description up to date
        if (existingTx.status !== expectedStatus || Math.abs(existingTx.amount - commissionAmount) > 0.01) {
          await prisma.walletTransaction.update({
            where: { id: existingTx.id },
            data: {
              amount: commissionAmount,
              status: expectedStatus,
              description: expectedStatus === 'PENDING'
                ? `Pending Commission: ${group.name} (${paxCount} Pax @ €${ratePerPax} [${tier}])`
                : `Commission: ${group.name} (${paxCount} Pax @ €${ratePerPax} [${tier}])`,
            },
          });
        }
      }
    }
  }

  // Auto-upgrade agentTier based on lifetime paid pax
  let newTier = 'BRONZE';
  if (totalPaxLifetime >= 50) newTier = 'GOLD';
  else if (totalPaxLifetime >= 20) newTier = 'SILVER';

  if (newTier !== tier) {
    await prisma.user.update({
      where: { id: userId },
      data: { agentTier: newTier },
    });
  }

  // Refetch transactions after synchronization
  const updatedTransactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Calculate real balances (subtracting DEBIT payouts in both PENDING and PAID state)
  let computedBalance = 0;
  let computedPending = 0;
  let totalEarnedYtd = 0;

  updatedTransactions.forEach((tx) => {
    if (tx.type === 'DEBIT') {
      if (tx.status === 'PAID' || tx.status === 'PENDING') {
        computedBalance -= Math.abs(tx.amount);
      }
    } else if (tx.type === 'CREDIT') {
      if (tx.status === 'PAID') {
        computedBalance += tx.amount;
        totalEarnedYtd += tx.amount;
      } else if (tx.status === 'PENDING') {
        computedPending += tx.amount;
      }
    }
  });

  computedBalance = Math.max(0, computedBalance);
  computedPending = Math.max(0, computedPending);

  // Update wallet record in DB if values differ
  if (Math.abs(wallet.balance - computedBalance) > 0.001 || Math.abs(wallet.pendingBalance - computedPending) > 0.001) {
    wallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: computedBalance,
        pendingBalance: computedPending,
      },
      include: {
        payoutRequests: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  // Build group invoices & consular payments list using dynamic Admin catalog
  const groupInvoices = allGroups.map((g) => {
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
    const srvFee = primaryDossier?.serviceFee ? Number(primaryDossier.serviceFee) * paxCount : fees.totalBaseServiceFee + fees.totalPackageAddOnFee;
    const totalAmount = primaryDossier?.totalAmount && Number(primaryDossier.totalAmount) > 0
      ? Number(primaryDossier.totalAmount)
      : fees.grandTotalEur;

    return {
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
      estimatedCommissionEur: Number((allApps.length * ratePerPax).toFixed(2)),
      currency: 'EUR',
      paymentStatus: primaryDossier?.paymentStatus || 'PENDING',
      groupStatus: g.status,
      createdDate: g.createdAt ? new Date(g.createdAt).toISOString().split('T')[0] : 'Recent',
      travelDate: g.travelDate ? new Date(g.travelDate).toISOString().split('T')[0] : 'Flexible',
    };
  });

  return {
    ...wallet,
    balance: computedBalance,
    pendingBalance: computedPending,
    totalEarnedYtd,
    agentTier: tier,
    ratePerPax,
    totalPaxLifetime,
    totalPaxDraft,
    transactions: updatedTransactions,
    groupInvoices,
  };
}

async function generateGroupInvoicePdf(groupId, userId) {
  const group = await prisma.groupBatch.findFirst({
    where: { id: groupId, userId },
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
    throw new Error('Group not found');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const primaryDossier = group.dossiers[0] || {
    dossierNumber: group.code,
    applicants: [],
    governmentFee: 80.0,
    serviceFee: 90.0,
    extraServicesFee: 0.0,
  };

  const pdfResult = await pdfUtil.generateGroupInvoicePdf(primaryDossier, user);
  return pdfResult;
}

async function requestPayout({ userId, amount, bankName, iban, swiftBic }) {
  const payoutAmount = Number(amount);
  if (!payoutAmount || payoutAmount <= 0) {
    const error = new Error('Invalid payout amount');
    error.statusCode = 400;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < payoutAmount) {
      const error = new Error('Insufficient wallet balance for this payout');
      error.statusCode = 400;
      throw error;
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: payoutAmount } },
    });

    const payout = await tx.payoutRequest.create({
      data: {
        walletId: wallet.id,
        amount: payoutAmount,
        bankName,
        iban,
        swiftBic: swiftBic || 'N/A',
        status: 'PENDING',
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -payoutAmount,
        type: 'DEBIT',
        referenceType: 'PAYOUT',
        referenceId: payout.id,
        description: `Payout to ${bankName} (${iban.slice(-4)})`,
        status: 'PENDING',
      },
    });

    return payout;
  });
}

async function exportTransactionsCsv(userId) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const rows = ['Transaction ID,Date,Reference,Description,Amount,Status'];
  if (wallet && wallet.transactions) {
    wallet.transactions.forEach((tx) => {
      const dateStr = tx.createdAt ? new Date(tx.createdAt).toISOString().split('T')[0] : '';
      const desc = (tx.description || '').replace(/"/g, '""');
      rows.push(`"${tx.id}","${dateStr}","${tx.referenceId || ''}","${desc}","${tx.amount}","${tx.status}"`);
    });
  }

  return rows.join('\n');
}

async function saveBankDetails(userId, { bankName, iban, swiftBic, accountHolder }) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0.0,
        pendingBalance: 0.0,
        currency: 'EUR',
        bankName,
        iban,
        swiftBic,
        accountHolder,
      },
    });
  } else {
    wallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        bankName,
        iban,
        swiftBic,
        accountHolder,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'UPDATE_BANK_DETAILS',
      details: { bankName, iban: iban ? `***${iban.slice(-4)}` : '', swiftBic, accountHolder },
    },
  });

  return {
    success: true,
    bankName: wallet.bankName,
    iban: wallet.iban,
    swiftBic: wallet.swiftBic,
    accountHolder: wallet.accountHolder,
  };
}

module.exports = {
  getAgentWallet,
  generateGroupInvoicePdf,
  requestPayout,
  exportTransactionsCsv,
  saveBankDetails,
};
