const crypto = require('crypto');
const prisma = require('../../config/db');

function generateGroupCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `GRP-${digits}`;
}

async function createGroup({ userId, name, destination, travelDate, duration, projectReason }) {
  const code = generateGroupCode();
  return prisma.groupBatch.create({
    data: {
      code,
      portalType: 'GROUP_AGENT',
      userId,
      name,
      destination: destination || 'Europe / Schengen',
      travelDate: travelDate ? new Date(travelDate) : null,
      duration: duration || 'short',
      projectReason: projectReason || 'Tourism',
      status: 'DRAFT',
    },
  });
}

async function getAgentGroups(userId) {
  const groups = await prisma.groupBatch.findMany({
    where: { userId, portalType: 'GROUP_AGENT' },
    include: {
      dossiers: {
        include: {
          applicants: {
            include: { documents: true },
          },
        },
      },
      appointments: {
        include: { timeSlot: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return groups.map((g) => {
    let allApplicants = [];
    g.dossiers.forEach((d) => {
      if (d.applicants) allApplicants.push(...d.applicants);
    });

    const totalApplicants = allApplicants.length;
    const verifiedApplicants = allApplicants.filter((a) =>
      a.documents.length > 0 && a.documents.every((doc) => doc.status === 'VERIFIED')
    ).length;

    const formProgress = totalApplicants > 0 ? Math.round((verifiedApplicants / totalApplicants) * 100) : 0;

    return {
      ...g,
      totalApplicants,
      verifiedApplicants,
      formProgress,
      applicants: allApplicants,
    };
  });
}

async function getGroupById(groupId, userId, isStaff = false) {
  const group = await prisma.groupBatch.findUnique({
    where: { id: groupId },
    include: {
      dossiers: {
        include: {
          applicants: {
            include: { documents: true, services: true },
          },
          documents: true,
          services: true,
        },
      },
      appointments: {
        include: { timeSlot: true },
      },
    },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isStaff && group.userId !== userId) {
    const error = new Error('Access denied to this group');
    error.statusCode = 403;
    throw error;
  }

  return group;
}

async function submitGroup(groupId, userId) {
  return await prisma.$transaction(async (tx) => {
    const group = await tx.groupBatch.findUnique({
      where: { id: groupId },
      include: {
        dossiers: {
          include: { applicants: true },
        },
      },
    });

    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    if (group.userId !== userId) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    const updated = await tx.groupBatch.update({
      where: { id: groupId },
      data: { status: 'PROCESSING' },
    });

    // Calculate commission: €20 per passenger
    let totalPassengers = 0;
    group.dossiers.forEach((d) => {
      totalPassengers += (d.applicants ? d.applicants.length : 0);
    });
    if (totalPassengers === 0) totalPassengers = 1; // Minimum base

    const commissionAmount = totalPassengers * 20.0;

    // Get or create wallet
    let wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId, balance: 0.0, pendingBalance: 0.0, currency: 'EUR' },
      });
    }

    // Credit commission
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: commissionAmount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: commissionAmount,
        type: 'CREDIT',
        referenceType: 'COMMISSION',
        referenceId: group.code,
        description: `Commission: ${group.name} (${totalPassengers} Applicants)`,
        status: 'PAID',
      },
    });

    return {
      group: updated,
      commissionCredited: commissionAmount,
    };
  });
}

async function getAgentWallet(userId) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      payoutRequests: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 480.0, pendingBalance: 1250.0, currency: 'EUR' },
      include: {
        transactions: true,
        payoutRequests: true,
      },
    });
  }

  // Calculate YTD earned
  const creditAgg = await prisma.walletTransaction.aggregate({
    _sum: { amount: true },
    where: { walletId: wallet.id, type: 'CREDIT' },
  });

  const totalEarnedYtd = creditAgg._sum.amount || wallet.balance;

  return {
    ...wallet,
    totalEarnedYtd,
  };
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
      const dateStr = new Date(tx.createdAt).toISOString().split('T')[0];
      rows.push(`"${tx.id}","${dateStr}","${tx.referenceId || ''}","${tx.description.replace(/"/g, '""')}","${tx.amount}","${tx.status}"`);
    });
  }

  return rows.join('\n');
}

module.exports = {
  createGroup,
  getAgentGroups,
  getGroupById,
  submitGroup,
  getAgentWallet,
  requestPayout,
  exportTransactionsCsv,
};
