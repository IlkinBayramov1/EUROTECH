const prisma = require('../../config/db');
const notificationService = require('../notification/notification.service');

async function getDashboardMetrics() {
  const activeDossiers = await prisma.dossier.count({
    where: {
      status: { in: ['RECEIVED', 'UNDER_REVIEW', 'SUBMITTED_TO_CONSULATE'] },
    },
  });

  const underReviewCount = await prisma.dossier.count({
    where: { status: 'UNDER_REVIEW' },
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const approvedThisMonth = await prisma.dossier.count({
    where: {
      status: 'APPROVED',
      updatedAt: { gte: startOfMonth },
    },
  });

  const paidTransactions = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { status: 'PAID' },
  });

  const totalRevenue = paidTransactions._sum.amount || 0;

  return {
    activeDossiers,
    underReviewCount,
    approvedThisMonth,
    totalRevenue,
  };
}

async function getAllDossiers({ status, portalType, search, page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (portalType) where.portalType = portalType;
  if (search) {
    where.OR = [
      { dossierNumber: { contains: search } },
      { user: { fullName: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }

  const [total, dossiers] = await Promise.all([
    prisma.dossier.count({ where }),
    prisma.dossier.findMany({
      where,
      include: {
        user: true,
        country: true,
        visaCategory: true,
        applicants: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
  ]);

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    dossiers,
  };
}

async function updateDossierStatusAndDecision({ dossierId, nextStatus, notes, reviewerUserId }) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { user: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const updatedDossier = await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      status: nextStatus,
      statusHistory: {
        create: {
          fromStatus: dossier.status,
          toStatus: nextStatus,
          changedByUserId: reviewerUserId,
          notes,
        },
      },
    },
    include: { user: true, country: true, visaCategory: true },
  });

  let statusText = 'Yoxlamada';
  if (nextStatus === 'SUBMITTED_TO_CONSULATE') statusText = 'Konsulluq Mərhələsində';
  if (nextStatus === 'APPROVED') statusText = 'Təsdiqləndi! (Vizanız Hazırdır)';
  if (nextStatus === 'REJECTED') statusText = 'Müraciətiniz Rədd Edildi';

  await notificationService.sendDecisionNotification(
    dossier.user.email,
    dossier.user.fullName,
    dossier.dossierNumber,
    statusText,
    notes
  );

  return updatedDossier;
}

async function getAgentPayouts() {
  const payouts = await prisma.payoutRequest.findMany({
    include: {
      wallet: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, companyName: true, phone: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return payouts.map((p) => ({
    id: p.id,
    walletId: p.walletId,
    agentName: p.wallet?.user?.fullName || 'Agent',
    companyName: p.wallet?.user?.companyName || 'Travel Partner',
    email: p.wallet?.user?.email,
    phone: p.wallet?.user?.phone,
    amount: p.amount,
    bankName: p.bankName,
    iban: p.iban,
    swiftBic: p.swiftBic,
    status: p.status,
    createdAt: p.createdAt,
    processedAt: p.processedAt,
  }));
}

async function updateAgentPayoutStatus(payoutId, status) {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: payoutId },
    include: { wallet: true },
  });

  if (!payout) {
    const error = new Error('Payout request not found');
    error.statusCode = 404;
    throw error;
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status,
        processedAt: new Date(),
      },
    });

    const txRecord = await tx.walletTransaction.findFirst({
      where: { walletId: payout.walletId, referenceId: payoutId, referenceType: 'PAYOUT' },
    });

    if (status === 'PROCESSED') {
      if (txRecord) {
        await tx.walletTransaction.update({
          where: { id: txRecord.id },
          data: { status: 'PAID' },
        });
      }
    } else if (status === 'REJECTED') {
      if (txRecord) {
        await tx.walletTransaction.update({
          where: { id: txRecord.id },
          data: { status: 'REFUNDED' },
        });
      }
      // Refund back to agent balance
      await tx.wallet.update({
        where: { id: payout.walletId },
        data: { balance: { increment: payout.amount } },
      });
    }

    return updated;
  });
}

module.exports = {
  getDashboardMetrics,
  getAllDossiers,
  updateDossierStatusAndDecision,
  getAgentPayouts,
  updateAgentPayoutStatus,
};
