const prisma = require('../../config/db');
const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn, convertToEur } = require('../../config/constants');
const { getAgentCommissionRate } = require('../../utils/finance.util');

async function getEurToAznRate(tx = prisma) {
  try {
    const setting = await tx.systemSetting.findUnique({ where: { key: 'EUR_TO_AZN_RATE' } });
    return Number(setting?.value || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
  } catch {
    return DEFAULT_EUR_TO_AZN_RATE || 1.85;
  }
}

async function getOrCreateWallet(userId, tx = prisma) {
  let wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await tx.wallet.create({
      data: {
        userId,
        balance: 0.0,
        pendingBalance: 0.0,
        currency: 'EUR',
      },
    });
  }
  return wallet;
}

/**
 * Deterministically recalculates a wallet's balance and pendingBalance from its ledger rows.
 */
async function recalculateWalletBalances(walletId, tx = prisma) {
  const allTxs = await tx.walletTransaction.findMany({
    where: { walletId },
    orderBy: { createdAt: 'desc' },
  });

  let balance = 0.0;
  let pendingBalance = 0.0;
  let totalEarnedCommissions = 0.0;
  let totalTopups = 0.0;
  let totalSpent = 0.0;

  for (const t of allTxs) {
    const amt = Math.abs(Number(t.amount || 0));
    if (t.type === 'CREDIT') {
      if (t.status === 'PAID') {
        balance += amt;
        if (t.referenceType === 'COMMISSION') {
          totalEarnedCommissions += amt;
        } else if (t.referenceType === 'TOPUP') {
          totalTopups += amt;
        }
      } else if (t.status === 'PENDING') {
        pendingBalance += amt;
      }
    } else if (t.type === 'DEBIT') {
      // Both PAID and PENDING debits (e.g. pending payout requests) reserve funds; REFUNDED debits do not
      if (t.status === 'PAID' || t.status === 'PENDING') {
        balance -= amt;
        if (t.referenceType === 'VISA_PAYMENT') {
          totalSpent += amt;
        }
      }
    }
  }

  balance = Number(Math.max(0, balance).toFixed(2));
  pendingBalance = Number(Math.max(0, pendingBalance).toFixed(2));

  const updatedWallet = await tx.wallet.update({
    where: { id: walletId },
    data: { balance, pendingBalance },
  });

  return {
    wallet: updatedWallet,
    balance,
    pendingBalance,
    totalEarnedCommissions: Number(totalEarnedCommissions.toFixed(2)),
    totalTopups: Number(totalTopups.toFixed(2)),
    totalSpent: Number(totalSpent.toFixed(2)),
    transactions: allTxs,
  };
}

/**
 * Computes net paid EUR on a single dossier (PAID minus REFUNDED EUR transactions)
 */
async function getDossierNetPaidEur(dossierId, tx = prisma, eurToAznRate = DEFAULT_EUR_TO_AZN_RATE) {
  const txs = await tx.transaction.findMany({
    where: { dossierId, status: { in: ['PAID', 'REFUNDED'] } },
  });

  let netPaid = 0.0;
  for (const t of txs) {
    const amtEur = convertToEur(Math.abs(Number(t.amount || 0)), t.currency || 'EUR', eurToAznRate);
    if (t.status === 'PAID') {
      netPaid += amtEur;
    } else if (t.status === 'REFUNDED' && t.paymentProvider === 'WALLET_REFUND') {
      netPaid -= amtEur;
    }
  }
  return Number(Math.max(0, netPaid).toFixed(2));
}

/**
 * Atomically settles a GroupBatch (Tour Agent group OR Corporate batch) inside an active transaction:
 * - Marks all linked Dossiers PAID & UNDER_REVIEW
 * - Marks CorporateInvoice PAID (if exists) and updates CorporateDepartment spentBudget
 * - Marks GroupBatch PROCESSING & confirms Appointments
 * - Credits Tour Agent Commission (PENDING -> PAID) and recalculates Agent Wallet
 */
async function settleGroupBatchInTx(
  tx,
  { groupBatchId, payerUserId, paymentProvider = 'WALLET', referenceCode, receiptUrl = null, explicitAmountEur = null }
) {
  const batch = await tx.groupBatch.findUnique({
    where: { id: groupBatchId },
    include: {
      user: true,
      dossiers: { include: { applicants: true } },
      invoices: true,
    },
  });

  if (!batch) {
    const err = new Error('Group / Batch not found');
    err.statusCode = 404;
    throw err;
  }

  const primaryDossier = batch.dossiers[0] || null;
  const pendingInvoice = batch.invoices.find((inv) => inv.status !== 'PAID') || batch.invoices[0] || null;

  // Determine settlement amount
  let totalDueEur = 0.0;
  if (explicitAmountEur !== null && explicitAmountEur !== undefined && Number(explicitAmountEur) > 0) {
    totalDueEur = Number(Number(explicitAmountEur).toFixed(2));
  } else if (pendingInvoice) {
    totalDueEur = Number(Number(pendingInvoice.amount || 0).toFixed(2));
  } else if (batch.dossiers.length > 0) {
    totalDueEur = Number(
      batch.dossiers.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0).toFixed(2)
    );
  }

  const alreadyPaid = batch.dossiers.length > 0 && batch.dossiers.every((d) => d.paymentStatus === 'PAID') && (!pendingInvoice || pendingInvoice.status === 'PAID');

  // 1. Update all dossiers in this batch
  for (const d of batch.dossiers) {
    const nextStatus = d.status === 'RECEIVED' ? 'UNDER_REVIEW' : d.status;
    await tx.dossier.update({
      where: { id: d.id },
      data: {
        paymentStatus: 'PAID',
        status: nextStatus,
        statusHistory: {
          create: {
            fromStatus: d.status,
            toStatus: nextStatus,
            changedByUserId: payerUserId || batch.userId,
            notes: `Group/Batch (${batch.code}) settled via ${paymentProvider} (€${totalDueEur.toFixed(2)}).`,
          },
        },
      },
    });
  }

  // 2. Record payment Transaction if not already settled with same reference
  const ref = referenceCode || `GRP-PAY-${batch.code}-${Date.now()}`;
  const createdTx = await tx.transaction.create({
    data: {
      dossierId: primaryDossier ? primaryDossier.id : null,
      userId: payerUserId || batch.userId,
      amount: totalDueEur,
      currency: 'EUR',
      paymentProvider,
      orderReference: ref,
      receiptUrl,
      status: 'PAID',
      metadataJson: {
        groupBatchId: batch.id,
        batchCode: batch.code,
        portalType: batch.portalType,
      },
    },
  });

  // 3. Advance GroupBatch status & confirm Appointments
  const nextBatchStatus = batch.status === 'DRAFT' ? 'PROCESSING' : batch.status;
  await tx.groupBatch.update({
    where: { id: batch.id },
    data: { status: nextBatchStatus },
  });

  await tx.appointment.updateMany({
    where: {
      OR: [
        { groupBatchId: batch.id },
        ...(batch.dossiers.length > 0 ? [{ dossierId: { in: batch.dossiers.map((d) => d.id) } }] : []),
      ],
      status: 'PENDING_PAYMENT',
    },
    data: { status: 'CONFIRMED' },
  });

  // 4. Corporate Invoice & Department Budget update
  if (batch.invoices.length > 0) {
    await tx.corporateInvoice.updateMany({
      where: { groupBatchId: batch.id },
      data: { status: 'PAID' },
    });
  }

  if (!alreadyPaid && batch.portalType === 'CORPORATE') {
    const allApplicants = batch.dossiers.flatMap((d) => d.applicants || []);
    if (allApplicants.length > 0 && totalDueEur > 0) {
      const perEmp = totalDueEur / allApplicants.length;
      const deptSpendMap = {};
      for (const app of allApplicants) {
        const deptName = (app.formDataJson && app.formDataJson.department) || 'General';
        deptSpendMap[deptName] = (deptSpendMap[deptName] || 0) + perEmp;
      }
      for (const [deptName, spend] of Object.entries(deptSpendMap)) {
        const dept = await tx.corporateDepartment.findFirst({
          where: { corporateUserId: batch.userId, name: deptName },
        });
        if (dept) {
          await tx.corporateDepartment.update({
            where: { id: dept.id },
            data: { spentBudget: { increment: Number(spend.toFixed(2)) } },
          });
        }
      }
    }
  }

  // 5. Tour Agent Commission Settlement (PENDING -> PAID)
  let commissionSettledEur = 0.0;
  if (batch.portalType === 'GROUP_AGENT' || batch.user?.role === 'AGENT_TUR_OPERATOR') {
    const paxCount = Math.max(
      1,
      batch.dossiers.reduce((sum, d) => sum + (d.applicants ? d.applicants.length : 0), 0)
    );
    const tier = batch.user?.agentTier || 'BRONZE';
    const ratePerPax = getAgentCommissionRate(tier);
    commissionSettledEur = Number((paxCount * ratePerPax).toFixed(2));

    const agentWallet = await getOrCreateWallet(batch.userId, tx);
    const existingComm = await tx.walletTransaction.findFirst({
      where: {
        walletId: agentWallet.id,
        referenceType: 'COMMISSION',
        referenceId: batch.code,
      },
    });

    const commDesc = `Commission: ${batch.name} (${paxCount} Pax @ €${ratePerPax.toFixed(2)} [${tier}])`;
    if (existingComm) {
      await tx.walletTransaction.update({
        where: { id: existingComm.id },
        data: {
          amount: commissionSettledEur,
          status: 'PAID',
          description: commDesc,
        },
      });
    } else {
      await tx.walletTransaction.create({
        data: {
          walletId: agentWallet.id,
          amount: commissionSettledEur,
          type: 'CREDIT',
          referenceType: 'COMMISSION',
          referenceId: batch.code,
          description: commDesc,
          status: 'PAID',
        },
      });
    }

    await recalculateWalletBalances(agentWallet.id, tx);
  }

  return {
    batchId: batch.id,
    batchCode: batch.code,
    settledAmountEur: totalDueEur,
    commissionSettledEur,
    transaction: createdTx,
  };
}

/**
 * Atomically settles an Individual Dossier inside an active transaction
 */
async function settleDossierInTx(
  tx,
  { dossierId, payerUserId, paymentProvider = 'WALLET', referenceCode, receiptUrl = null, explicitAmountEur = null }
) {
  const dossier = await tx.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true, user: true },
  });

  if (!dossier) {
    const err = new Error('Dossier not found');
    err.statusCode = 404;
    throw err;
  }

  // If this dossier belongs to a B2B group/batch, settle the whole groupBatch cleanly
  if (dossier.groupBatchId && dossier.portalType !== 'INDIVIDUAL') {
    return settleGroupBatchInTx(tx, {
      groupBatchId: dossier.groupBatchId,
      payerUserId,
      paymentProvider,
      referenceCode,
      receiptUrl,
      explicitAmountEur,
    });
  }

  const rate = await getEurToAznRate(tx);
  const netPaid = await getDossierNetPaidEur(dossier.id, tx, rate);
  const remainingDue = Math.max(0, Number((Number(dossier.totalAmount || 0) - netPaid).toFixed(2)));
  const amountToRecord =
    explicitAmountEur !== null && explicitAmountEur !== undefined && Number(explicitAmountEur) > 0
      ? Number(Number(explicitAmountEur).toFixed(2))
      : remainingDue > 0
        ? remainingDue
        : Number(dossier.totalAmount || 0);

  const nextStatus = dossier.status === 'RECEIVED' ? 'UNDER_REVIEW' : dossier.status;
  const updatedDossier = await tx.dossier.update({
    where: { id: dossier.id },
    data: {
      paymentStatus: 'PAID',
      status: nextStatus,
      currentStep: Math.max(dossier.currentStep || 1, 5),
      statusHistory: {
        create: {
          fromStatus: dossier.status,
          toStatus: nextStatus,
          changedByUserId: payerUserId || dossier.userId,
          notes: `Payment settled via ${paymentProvider} (€${amountToRecord.toFixed(2)}).`,
        },
      },
    },
  });

  const createdTx = await tx.transaction.create({
    data: {
      dossierId: dossier.id,
      userId: payerUserId || dossier.userId,
      amount: amountToRecord,
      currency: 'EUR',
      paymentProvider,
      orderReference: referenceCode || `DOS-PAY-${dossier.dossierNumber}-${Date.now()}`,
      receiptUrl,
      status: 'PAID',
      metadataJson: {
        dossierNumber: dossier.dossierNumber,
        portalType: dossier.portalType,
      },
    },
  });

  await tx.appointment.updateMany({
    where: { dossierId: dossier.id, status: 'PENDING_PAYMENT' },
    data: { status: 'CONFIRMED' },
  });

  return {
    dossier: updatedDossier,
    settledAmountEur: amountToRecord,
    transaction: createdTx,
  };
}

/**
 * Top up any user's wallet immediately via Card (or mock gateway)
 */
async function topupWallet({ userId, amount, currency = 'EUR', method = 'CARD', reference = null }) {
  const rawAmt = Number(amount);
  if (!rawAmt || isNaN(rawAmt) || rawAmt <= 0) {
    const err = new Error('Please enter a valid deposit amount greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const eurToAznRate = await getEurToAznRate(tx);
    const amountEur = convertToEur(rawAmt, currency, eurToAznRate);
    const wallet = await getOrCreateWallet(userId, tx);
    const ref = reference || `TOPUP-${Date.now().toString().slice(-6)}`;

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: amountEur,
        type: 'CREDIT',
        referenceType: 'TOPUP',
        referenceId: ref,
        description:
          String(currency).toUpperCase() === 'AZN'
            ? `Wallet Deposit via ${method} (${rawAmt.toFixed(2)} AZN ≈ €${amountEur.toFixed(2)})`
            : `Wallet Deposit via ${method} (€${amountEur.toFixed(2)})`,
        status: 'PAID',
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: amountEur,
        currency: 'EUR',
        paymentProvider: method === 'CARD' ? 'STRIPE' : 'WALLET_TOPUP',
        orderReference: ref,
        status: 'PAID',
        metadataJson: {
          purpose: 'WALLET_TOPUP',
          originalAmount: rawAmt,
          originalCurrency: currency,
        },
      },
    });

    const summary = await recalculateWalletBalances(wallet.id, tx);

    await tx.auditLog.create({
      data: {
        userId,
        action: 'WALLET_TOPUP',
        details: { amountEur, originalAmount: rawAmt, currency, method, reference: ref, newBalance: summary.balance },
      },
    });

    return {
      wallet: summary.wallet,
      balance: summary.balance,
      balanceAzn: convertEurToAzn(summary.balance, eurToAznRate),
      transaction: walletTx,
    };
  });
}

/**
 * Pay a Dossier, GroupBatch, or CorporateInvoice directly using the user's Wallet balance
 */
async function payWithWallet({ userId, userRole, dossierId = null, groupBatchId = null, invoiceId = null }) {
  return await prisma.$transaction(async (tx) => {
    const eurToAznRate = await getEurToAznRate(tx);
    const wallet = await getOrCreateWallet(userId, tx);
    const initialSummary = await recalculateWalletBalances(wallet.id, tx);
    const availableEur = initialSummary.balance;
    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(userRole);

    // Resolve invoiceId -> groupBatchId if needed
    let resolvedGroupBatchId = groupBatchId;
    let targetInvoice = null;
    if (invoiceId) {
      targetInvoice = await tx.corporateInvoice.findUnique({ where: { id: invoiceId } });
      if (!targetInvoice) {
        const err = new Error('Corporate invoice not found');
        err.statusCode = 404;
        throw err;
      }
      if (!isStaff && targetInvoice.corporateUserId !== userId) {
        const err = new Error('Access denied to this invoice');
        err.statusCode = 403;
        throw err;
      }
      if (targetInvoice.status === 'PAID') {
        const err = new Error('This invoice is already paid.');
        err.statusCode = 400;
        throw err;
      }
      resolvedGroupBatchId = targetInvoice.groupBatchId || resolvedGroupBatchId;
    }

    // CASE 1: GroupBatch / Corporate Invoice payment
    if (resolvedGroupBatchId) {
      const batch = await tx.groupBatch.findUnique({
        where: { id: resolvedGroupBatchId },
        include: { dossiers: true, invoices: true },
      });
      if (!batch) {
        const err = new Error('Group or Corporate Batch not found');
        err.statusCode = 404;
        throw err;
      }
      if (!isStaff && batch.userId !== userId) {
        const err = new Error('Access denied to this group/batch');
        err.statusCode = 403;
        throw err;
      }

      const inv = targetInvoice || batch.invoices.find((i) => i.status !== 'PAID') || null;
      const requiredEur = inv
        ? Number(Number(inv.amount).toFixed(2))
        : Number(batch.dossiers.reduce((s, d) => s + Number(d.totalAmount || 0), 0).toFixed(2));

      if (requiredEur <= 0) {
        const err = new Error('No payable amount found for this group/batch.');
        err.statusCode = 400;
        throw err;
      }

      const allDossiersPaid = batch.dossiers.length > 0 && batch.dossiers.every((d) => d.paymentStatus === 'PAID');
      if (allDossiersPaid && (!inv || inv.status === 'PAID')) {
        const err = new Error('This group/batch has already been settled.');
        err.statusCode = 400;
        throw err;
      }

      if (availableEur < requiredEur) {
        const err = new Error(
          `Insufficient wallet balance. Available: €${availableEur.toFixed(2)}, Required: €${requiredEur.toFixed(2)}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const ref = `WLT-${batch.code}-${Date.now().toString().slice(-5)}`;
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -requiredEur,
          type: 'DEBIT',
          referenceType: 'VISA_PAYMENT',
          referenceId: batch.code,
          description: `Group/Batch Visa Fees: ${batch.name} (${batch.code})`,
          status: 'PAID',
        },
      });

      const settlement = await settleGroupBatchInTx(tx, {
        groupBatchId: batch.id,
        payerUserId: userId,
        paymentProvider: 'WALLET',
        referenceCode: ref,
        explicitAmountEur: requiredEur,
      });

      const finalSummary = await recalculateWalletBalances(wallet.id, tx);

      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_GROUP_PAYMENT',
          details: { groupBatchId: batch.id, batchCode: batch.code, paidEur: requiredEur, newBalance: finalSummary.balance },
        },
      });

      return {
        paidAmountEur: requiredEur,
        paidAmountAzn: convertEurToAzn(requiredEur, eurToAznRate),
        newBalance: finalSummary.balance,
        newBalanceAzn: convertEurToAzn(finalSummary.balance, eurToAznRate),
        commissionSettledEur: settlement.commissionSettledEur,
        reference: ref,
      };
    }

    // CASE 2: Individual Dossier payment
    if (dossierId) {
      const dossier = await tx.dossier.findUnique({
        where: { id: dossierId },
        include: { applicants: true },
      });
      if (!dossier) {
        const err = new Error('Dossier not found');
        err.statusCode = 404;
        throw err;
      }
      if (!isStaff && dossier.userId !== userId) {
        const err = new Error('Access denied to this dossier');
        err.statusCode = 403;
        throw err;
      }

      const netPaid = await getDossierNetPaidEur(dossier.id, tx, eurToAznRate);
      const dueEur = Math.max(0, Number((Number(dossier.totalAmount || 0) - netPaid).toFixed(2)));

      if (dueEur <= 0 && dossier.paymentStatus === 'PAID') {
        const err = new Error('This dossier is already fully paid.');
        err.statusCode = 400;
        throw err;
      }

      const payableEur = dueEur > 0 ? dueEur : Number(dossier.totalAmount || 0);
      if (availableEur < payableEur) {
        const err = new Error(
          `Insufficient wallet balance. Available: €${availableEur.toFixed(2)}, Required: €${payableEur.toFixed(2)}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const ref = `WLT-${dossier.dossierNumber}-${Date.now().toString().slice(-4)}`;
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -payableEur,
          type: 'DEBIT',
          referenceType: 'VISA_PAYMENT',
          referenceId: dossier.dossierNumber,
          description: `Consular & Service Fees: Dossier ${dossier.dossierNumber}`,
          status: 'PAID',
        },
      });

      await settleDossierInTx(tx, {
        dossierId: dossier.id,
        payerUserId: userId,
        paymentProvider: 'WALLET',
        referenceCode: ref,
        explicitAmountEur: payableEur,
      });

      const finalSummary = await recalculateWalletBalances(wallet.id, tx);

      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_DOSSIER_PAYMENT',
          details: { dossierId: dossier.id, dossierNumber: dossier.dossierNumber, paidEur: payableEur, newBalance: finalSummary.balance },
        },
      });

      return {
        paidAmountEur: payableEur,
        paidAmountAzn: convertEurToAzn(payableEur, eurToAznRate),
        newBalance: finalSummary.balance,
        newBalanceAzn: convertEurToAzn(finalSummary.balance, eurToAznRate),
        reference: ref,
      };
    }

    const err = new Error('Please specify dossierId, groupBatchId, or invoiceId to pay from wallet.');
    err.statusCode = 400;
    throw err;
  });
}

/**
 * Refunds an EUR amount directly back into a user's Wallet (e.g. cancelled paid add-on service)
 */
async function refundToWallet({ userId, amountEur, reason, referenceId = null }, tx = prisma) {
  const amt = Number(Number(amountEur || 0).toFixed(2));
  if (amt <= 0) return null;

  const wallet = await getOrCreateWallet(userId, tx);
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: amt,
      type: 'CREDIT',
      referenceType: 'TOPUP',
      referenceId: referenceId || `REFUND-${Date.now().toString().slice(-6)}`,
      description: `Refund Credited: ${reason}`,
      status: 'PAID',
    },
  });

  return recalculateWalletBalances(wallet.id, tx);
}

/**
 * Comprehensive Wallet & Billing Overview for ANY authenticated profile
 */
async function getUserWalletOverview(userId) {
  const eurToAznRate = await getEurToAznRate();
  const wallet = await getOrCreateWallet(userId);
  const summary = await recalculateWalletBalances(wallet.id);

  const [payoutRequests, pendingBankSlips, dossiers, user] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.bankPaymentReceipt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.dossier.findMany({
      where: { userId },
      include: {
        country: true,
        visaCategory: true,
        applicants: true,
        services: { where: { status: 'ACTIVE' } },
        transactions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, phone: true, role: true, companyName: true, taxId: true, agentTier: true },
    }),
  ]);

  const dossierInvoices = [];
  let totalUnpaidEur = 0.0;

  for (const d of dossiers) {
    const netPaidEur = await getDossierNetPaidEur(d.id, prisma, eurToAznRate);
    const totalEur = Number(Number(d.totalAmount || 0).toFixed(2));
    const dueEur = d.paymentStatus === 'PAID' && netPaidEur >= totalEur
      ? 0.0
      : Math.max(0, Number((totalEur - netPaidEur).toFixed(2)));

    if (dueEur > 0) {
      totalUnpaidEur += dueEur;
    }

    dossierInvoices.push({
      dossierId: d.id,
      dossierNumber: d.dossierNumber,
      portalType: d.portalType,
      destination: d.country?.nameEn || d.country?.nameAz || 'Schengen',
      countryCode: d.country?.code || 'EU',
      visaCategory: d.visaCategory?.nameEn || d.visaCategory?.nameAz || 'Schengen Visa',
      paxCount: Math.max(1, (d.applicants || []).length),
      governmentFee: Number(d.governmentFee || 80),
      serviceFee: Number(d.serviceFee || 0),
      extraServicesFee: Number(d.extraServicesFee || 0),
      totalAmountEur: totalEur,
      totalAmountAzn: convertEurToAzn(totalEur, eurToAznRate),
      paidAmountEur: netPaidEur,
      dueAmountEur: dueEur,
      dueAmountAzn: convertEurToAzn(dueEur, eurToAznRate),
      paymentStatus: dueEur <= 0 && totalEur > 0 ? 'PAID' : d.paymentStatus,
      dossierStatus: d.status,
      services: d.services || [],
      createdAt: d.createdAt,
    });
  }

  return {
    user,
    wallet: {
      ...summary.wallet,
      balance: summary.balance,
      balanceAzn: convertEurToAzn(summary.balance, eurToAznRate),
      pendingBalance: summary.pendingBalance,
      pendingBalanceAzn: convertEurToAzn(summary.pendingBalance, eurToAznRate),
      totalEarnedCommissions: summary.totalEarnedCommissions,
      totalTopups: summary.totalTopups,
      totalSpent: summary.totalSpent,
      totalUnpaidEur: Number(totalUnpaidEur.toFixed(2)),
      totalUnpaidAzn: convertEurToAzn(totalUnpaidEur, eurToAznRate),
      eurToAznRate,
      transactions: summary.transactions,
      payoutRequests,
    },
    pendingBankSlips,
    dossierInvoices,
  };
}

/**
 * Admin: List all user wallets across INDIVIDUAL, AGENT_TUR_OPERATOR, CORPORATE_HR
 */
async function adminGetAllWallets({ role = null, search = null } = {}) {
  const userWhere = {};
  if (role && role !== 'ALL') {
    userWhere.role = role;
  } else {
    userWhere.role = { in: ['INDIVIDUAL', 'AGENT_TUR_OPERATOR', 'CORPORATE_HR'] };
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    userWhere.OR = [
      { fullName: { contains: q } },
      { email: { contains: q } },
      { companyName: { contains: q } },
    ];
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      wallet: {
        include: {
          transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      _count: {
        select: { dossiers: true, groupBatches: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return users.map((u) => ({
    userId: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    companyName: u.companyName,
    agentTier: u.agentTier,
    walletId: u.wallet?.id || null,
    balance: Number(u.wallet?.balance || 0),
    pendingBalance: Number(u.wallet?.pendingBalance || 0),
    currency: u.wallet?.currency || 'EUR',
    iban: u.wallet?.iban || null,
    bankName: u.wallet?.bankName || null,
    dossiersCount: u._count?.dossiers || 0,
    batchesCount: u._count?.groupBatches || 0,
    recentTransactions: u.wallet?.transactions || [],
    updatedAt: u.wallet?.updatedAt || u.updatedAt,
  }));
}

/**
 * Admin: Credit or Debit a user's wallet with full audit logging
 */
async function adminAdjustWallet({ targetUserId, amount, type = 'CREDIT', reason, adminUserId }) {
  const amt = Math.abs(Number(amount || 0));
  if (!amt || amt <= 0) {
    const err = new Error('Adjustment amount must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }
  if (!reason || !String(reason).trim()) {
    const err = new Error('Please provide an official audit reason for this balance adjustment.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(targetUserId, tx);
    const current = await recalculateWalletBalances(wallet.id, tx);

    if (type === 'DEBIT' && current.balance < amt) {
      const err = new Error(`Cannot debit €${amt.toFixed(2)}: user only has €${current.balance.toFixed(2)} available.`);
      err.statusCode = 400;
      throw err;
    }

    const ref = `ADM-ADJ-${Date.now().toString().slice(-6)}`;
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: type === 'DEBIT' ? -amt : amt,
        type: type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
        referenceType: type === 'DEBIT' ? 'VISA_PAYMENT' : 'TOPUP',
        referenceId: ref,
        description: `Admin Finance Adjustment: ${String(reason).trim()}`,
        status: 'PAID',
      },
    });

    const updated = await recalculateWalletBalances(wallet.id, tx);

    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_WALLET_ADJUSTMENT',
        details: {
          targetUserId,
          type,
          amountEur: amt,
          reason: String(reason).trim(),
          newBalance: updated.balance,
        },
      },
    });

    return {
      wallet: updated.wallet,
      balance: updated.balance,
      pendingBalance: updated.pendingBalance,
    };
  });
}

module.exports = {
  getEurToAznRate,
  getOrCreateWallet,
  recalculateWalletBalances,
  getDossierNetPaidEur,
  settleGroupBatchInTx,
  settleDossierInTx,
  topupWallet,
  payWithWallet,
  refundToWallet,
  getUserWalletOverview,
  adminGetAllWallets,
  adminAdjustWallet,
};

