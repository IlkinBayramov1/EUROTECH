const prisma = require('../../config/db');
const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn, convertToEur } = require('../../config/constants');
const { getAgentCommissionRate, calculatePortalFees } = require('../../utils/finance.util');
const { getPricingCatalog } = require('../service/pricingConfig.service');
const promoService = require('../promo/promo.service');

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
 * Computes confirmed promo discounts + net paid EUR on a single dossier
 */
async function getDossierSettledCreditEur(dossierId, tx = prisma, eurToAznRate = DEFAULT_EUR_TO_AZN_RATE) {
  const [netPaidEur, confirmedDiscountEur] = await Promise.all([
    getDossierNetPaidEur(dossierId, tx, eurToAznRate),
    promoService.getDossierConfirmedDiscountEur(dossierId, tx),
  ]);
  return {
    netPaidEur,
    confirmedDiscountEur,
    settledCreditEur: Number((netPaidEur + confirmedDiscountEur).toFixed(2)),
  };
}

/**
 * Finds an already-settled PAID transaction belonging to a GroupBatch
 */
async function findPaidGroupBatchTransaction(tx, batch) {
  const paidTxs = await tx.transaction.findMany({
    where: { userId: batch.userId, status: 'PAID' },
    select: { id: true, amount: true, metadataJson: true, dossierId: true, paymentProvider: true },
  });
  return (
    paidTxs.find((t) => {
      const meta = t.metadataJson && typeof t.metadataJson === 'object' ? t.metadataJson : {};
      return meta.groupBatchId === batch.id || (batch.code && meta.batchCode === batch.code);
    }) || null
  );
}

async function ensureGroupBatchPrimaryDossierInTx(tx, batch, catalog = null, { skipPaidCheck = false } = {}) {
  if (batch.dossiers && batch.dossiers.length > 0) {
    return batch.dossiers[0];
  }

  const dest = String(batch.destination || '').trim();
  let country = null;
  if (dest) {
    country = await tx.country.findFirst({
      where: {
        OR: [
          { code: dest.toUpperCase() },
          { nameEn: { equals: dest } },
          { nameAz: { equals: dest } },
          { nameEn: { contains: dest } },
        ],
      },
    });
  }
  if (!country) {
    country = (await tx.country.findFirst({ where: { code: 'HU' } })) || (await tx.country.findFirst());
  }
  if (!country) {
    country = await tx.country.create({
      data: { code: 'HU', nameAz: 'Macarıstan', nameEn: 'Hungary', nameRu: 'Vengriya' },
    });
  }

  let category = await tx.visaCategory.findFirst({ where: { countryId: country.id } });
  if (!category) {
    category = await tx.visaCategory.create({
      data: {
        countryId: country.id,
        code: 'SCHENGEN_TOURIST',
        nameAz: 'Şengen Turist',
        nameEn: 'Schengen Tourist',
        nameRu: 'Schengen Tourist',
      },
    });
  }

  const resolvedCatalog = catalog || (await getPricingCatalog(tx));
  const fees = calculatePortalFees({
    portalType: batch.portalType || 'GROUP_AGENT',
    paxCount: 1,
    activePackage: batch.packageTier || 'standard',
    duration: batch.duration || 'short',
    catalog: resolvedCatalog,
  });

  const matchingPaidTx = skipPaidCheck ? null : await findPaidGroupBatchTransaction(tx, batch);
  const paidInv = !skipPaidCheck && Array.isArray(batch.invoices) ? batch.invoices.find((i) => i.status === 'PAID') : null;
  const isAlreadyPaid = !!(matchingPaidTx || paidInv);
  const resolvedTotal = Number(matchingPaidTx?.amount || paidInv?.amount || fees.grandTotalEur || 145);

  const createdDossier = await tx.dossier.create({
    data: {
      dossierNumber: `${batch.code}-${Date.now().toString().slice(-4)}`,
      portalType: batch.portalType || 'GROUP_AGENT',
      userId: batch.userId,
      groupBatchId: batch.id,
      countryId: country.id,
      visaCategoryId: category.id,
      status: isAlreadyPaid ? 'UNDER_REVIEW' : 'RECEIVED',
      currentStep: isAlreadyPaid ? 6 : 1,
      governmentFee: fees.govFeePerPax,
      serviceFee: fees.serviceFeePerPaxForDossier,
      extraServicesFee: fees.extraServicesTotalForDossier,
      totalAmount: resolvedTotal,
      paymentStatus: isAlreadyPaid ? 'PAID' : 'PENDING',
    },
    include: { applicants: true, country: true, visaCategory: true },
  });

  if (matchingPaidTx && !matchingPaidTx.dossierId) {
    await tx.transaction.update({
      where: { id: matchingPaidTx.id },
      data: { dossierId: createdDossier.id },
    }).catch(() => {});
  }

  batch.dossiers = [createdDossier];
  return createdDossier;
}

/**
 * Atomically settles a GroupBatch (Tour Agent or Corporate) inside an active transaction
 * - Marks all linked Dossiers PAID & UNDER_REVIEW
 * - Marks CorporateInvoice PAID (if exists) and updates CorporateDepartment spentBudget
 * - Marks GroupBatch PROCESSING & confirms Appointments
 * - Credits Tour Agent Commission (PENDING -> PAID) and recalculates Agent Wallet
 */
async function settleGroupBatchInTx(
  tx,
  {
    groupBatchId,
    payerUserId,
    paymentProvider = 'WALLET',
    referenceCode,
    receiptUrl = null,
    explicitAmountEur = null,
    existingTransactionId = null,
    promoMeta = null,
  }
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

  if (!batch.dossiers || batch.dossiers.length === 0) {
    await ensureGroupBatchPrimaryDossierInTx(tx, batch, null, { skipPaidCheck: true });
  }

  const primaryDossier = batch.dossiers[0] || null;
  const pendingInvoice = batch.invoices.find((inv) => inv.status !== 'PAID') || batch.invoices[0] || null;

  // Determine settlement amount (allows exact 0.00 when 100% covered by promo code)
  let totalDueEur = 0.0;
  if (explicitAmountEur !== null && explicitAmountEur !== undefined && Number(explicitAmountEur) >= 0) {
    totalDueEur = Number(Number(explicitAmountEur).toFixed(2));
  } else if (pendingInvoice) {
    totalDueEur = Number(Number(pendingInvoice.amount || 0).toFixed(2));
  } else if (batch.dossiers.length > 0) {
    totalDueEur = Number(
      batch.dossiers.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0).toFixed(2)
    );
  }

  const alreadyPaid =
    batch.dossiers.length > 0 &&
    batch.dossiers.every((d) => d.paymentStatus === 'PAID') &&
    (!pendingInvoice || pendingInvoice.status === 'PAID');

  const promoNoteSuffix =
    promoMeta && promoMeta.promoCode
      ? ` (Promo ${promoMeta.promoCode}: -€${Number(promoMeta.discountAmountEur || 0).toFixed(2)})`
      : '';

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
            notes: `Group/Batch (${batch.code}) settled via ${paymentProvider} (€${totalDueEur.toFixed(2)})${promoNoteSuffix}.`,
          },
        },
      },
    });
  }

  // 2. Update existing Stripe Transaction (prevents double revenue rows) OR create new Transaction
  const ref = referenceCode || `GRP-PAY-${batch.code}-${Date.now()}`;
  const txMeta = {
    groupBatchId: batch.id,
    batchCode: batch.code,
    portalType: batch.portalType,
    ...(promoMeta
      ? {
          promoCode: promoMeta.promoCode || null,
          promoRedemptionId: promoMeta.redemptionId || null,
          originalAmountEur: promoMeta.originalAmountEur ?? null,
          discountAmountEur: promoMeta.discountAmountEur ?? 0,
        }
      : {}),
  };

  let createdTx;
  if (existingTransactionId) {
    const existing = await tx.transaction.findUnique({ where: { id: existingTransactionId } });
    const prevMeta = existing?.metadataJson && typeof existing.metadataJson === 'object' ? existing.metadataJson : {};
    createdTx = await tx.transaction.update({
      where: { id: existingTransactionId },
      data: {
        dossierId: existing?.dossierId || (primaryDossier ? primaryDossier.id : null),
        status: 'PAID',
        receiptUrl: receiptUrl || existing?.receiptUrl || null,
        metadataJson: { ...prevMeta, ...txMeta },
      },
    });
  } else {
    createdTx = await tx.transaction.create({
      data: {
        dossierId: primaryDossier ? primaryDossier.id : null,
        userId: payerUserId || batch.userId,
        amount: totalDueEur,
        currency: 'EUR',
        paymentProvider,
        orderReference: ref,
        receiptUrl,
        status: 'PAID',
        metadataJson: txMeta,
      },
    });
  }

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

  // 4. Corporate Invoice & Department Budget update (uses actual net spent amount)
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

  // 5. Tour Agent Commission Settlement (with Promo Margin Protection against commission-farming)
  let commissionSettledEur = 0.0;
  if (
    batch.portalType === 'GROUP_AGENT' ||
    batch.user?.role === 'AGENT_TUR_OPERATOR' ||
    batch.user?.role === 'AGENT'
  ) {
    const catalog = await getPricingCatalog(tx);
    const paxCount = Math.max(
      1,
      batch.dossiers.reduce((sum, d) => sum + (d.applicants ? d.applicants.length : 0), 0)
    );
    const tier = batch.user?.agentTier || 'BRONZE';
    const ratePerPax = getAgentCommissionRate(tier, catalog);
    let rawCommission = Number((paxCount * ratePerPax).toFixed(2));

    if (promoMeta && promoMeta.promoCode) {
      if (promoMeta.allowAgentCommission === false) {
        rawCommission = 0.0;
      } else {
        const consularFloor = Number(promoMeta.consularFeeTotalEur ?? paxCount * 80);
        const netServiceMargin = Math.max(0, Number((totalDueEur - consularFloor).toFixed(2)));
        rawCommission = Math.min(rawCommission, netServiceMargin);
      }
    }
    commissionSettledEur = Number(Math.max(0, rawCommission).toFixed(2));

    const agentWallet = await getOrCreateWallet(batch.userId, tx);
    const existingComm = await tx.walletTransaction.findFirst({
      where: {
        walletId: agentWallet.id,
        referenceType: 'COMMISSION',
        referenceId: batch.code,
      },
    });

    const commDesc =
      promoMeta && promoMeta.promoCode && commissionSettledEur < Number((paxCount * ratePerPax).toFixed(2))
        ? `Commission (Promo Adjusted): ${batch.name} (${paxCount} Pax [${tier}], Promo ${promoMeta.promoCode})`
        : `Commission: ${batch.name} (${paxCount} Pax @ €${ratePerPax.toFixed(2)} [${tier}])`;

    if (commissionSettledEur > 0) {
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
    } else if (existingComm) {
      // Remove/zero-out pending commission if promo disabled or consumed full margin
      await tx.walletTransaction.update({
        where: { id: existingComm.id },
        data: {
          amount: 0,
          status: 'REFUNDED',
          description: `Commission Waived (Promo ${promoMeta?.promoCode || 'DISCOUNT'}): ${batch.name}`,
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
  {
    dossierId,
    payerUserId,
    paymentProvider = 'WALLET',
    referenceCode,
    receiptUrl = null,
    explicitAmountEur = null,
    existingTransactionId = null,
    promoMeta = null,
  }
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
      existingTransactionId,
      promoMeta,
    });
  }

  const rate = await getEurToAznRate(tx);
  const { settledCreditEur } = await getDossierSettledCreditEur(dossier.id, tx, rate);
  const remainingDue = Math.max(0, Number((Number(dossier.totalAmount || 0) - settledCreditEur).toFixed(2)));
  const amountToRecord =
    explicitAmountEur !== null && explicitAmountEur !== undefined && Number(explicitAmountEur) >= 0
      ? Number(Number(explicitAmountEur).toFixed(2))
      : remainingDue;

  const promoNoteSuffix =
    promoMeta && promoMeta.promoCode
      ? ` (Promo ${promoMeta.promoCode}: -€${Number(promoMeta.discountAmountEur || 0).toFixed(2)})`
      : '';

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
          notes: `Payment settled via ${paymentProvider} (€${amountToRecord.toFixed(2)})${promoNoteSuffix}.`,
        },
      },
    },
  });

  const txMeta = {
    dossierNumber: dossier.dossierNumber,
    portalType: dossier.portalType,
    ...(promoMeta
      ? {
          promoCode: promoMeta.promoCode || null,
          promoRedemptionId: promoMeta.redemptionId || null,
          originalAmountEur: promoMeta.originalAmountEur ?? null,
          discountAmountEur: promoMeta.discountAmountEur ?? 0,
        }
      : {}),
  };

  let createdTx;
  if (existingTransactionId) {
    const existing = await tx.transaction.findUnique({ where: { id: existingTransactionId } });
    const prevMeta = existing?.metadataJson && typeof existing.metadataJson === 'object' ? existing.metadataJson : {};
    createdTx = await tx.transaction.update({
      where: { id: existingTransactionId },
      data: {
        status: 'PAID',
        receiptUrl: receiptUrl || existing?.receiptUrl || null,
        metadataJson: { ...prevMeta, ...txMeta },
      },
    });
  } else {
    createdTx = await tx.transaction.create({
      data: {
        dossierId: dossier.id,
        userId: payerUserId || dossier.userId,
        amount: amountToRecord,
        currency: 'EUR',
        paymentProvider,
        orderReference: referenceCode || `DOS-PAY-${dossier.dossierNumber}-${Date.now()}`,
        receiptUrl,
        status: 'PAID',
        metadataJson: txMeta,
      },
    });
  }

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

    const balanceAzn = convertEurToAzn(summary.balance, eurToAznRate);
    return {
      wallet: {
        ...summary.wallet,
        balance: summary.balance,
        balanceEur: summary.balance,
        balanceAzn,
      },
      balance: summary.balance,
      balanceEur: summary.balance,
      balanceAzn,
      transaction: walletTx,
    };
  });
}

/**
 * Save or update a user's withdrawal / payout bank coordinates on their Wallet
 */
async function saveWalletBankDetails(userId, { bankName, iban, swiftBic, accountHolder }) {
  const wallet = await getOrCreateWallet(userId);
  const updated = await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      bankName: bankName ? String(bankName).trim() : wallet.bankName,
      iban: iban ? String(iban).trim().toUpperCase() : wallet.iban,
      swiftBic: swiftBic ? String(swiftBic).trim().toUpperCase() : wallet.swiftBic,
      accountHolder: accountHolder ? String(accountHolder).trim() : wallet.accountHolder,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'WALLET_BANK_DETAILS_UPDATED',
        details: {
          bankName: updated.bankName,
          iban: updated.iban ? `***${updated.iban.slice(-4)}` : null,
          swiftBic: updated.swiftBic,
          accountHolder: updated.accountHolder,
        },
      },
    });
  } catch {}

  return {
    wallet: updated,
    bankName: updated.bankName,
    iban: updated.iban,
    swiftBic: updated.swiftBic,
    accountHolder: updated.accountHolder,
  };
}

/**
 * Request a withdrawal / payout from any user's Wallet (Individual, Agent, or Corporate)
 */
async function requestWalletPayout({
  userId,
  amount,
  currency = 'EUR',
  bankName,
  iban,
  swiftBic,
  accountHolder,
}) {
  const rawAmt = Number(amount);
  if (!rawAmt || isNaN(rawAmt) || rawAmt <= 0) {
    const err = new Error('Please enter a valid withdrawal amount greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const eurToAznRate = await getEurToAznRate(tx);
    const amountEur = convertToEur(rawAmt, currency, eurToAznRate);
    const wallet = await getOrCreateWallet(userId, tx);
    const currentSummary = await recalculateWalletBalances(wallet.id, tx);

    if (currentSummary.balance < amountEur) {
      const err = new Error(
        `Insufficient wallet balance for this withdrawal. Available: €${currentSummary.balance.toFixed(2)}, Requested: €${amountEur.toFixed(2)}.`
      );
      err.statusCode = 400;
      throw err;
    }

    const finalBankName = (bankName || wallet.bankName || 'International Bank of Azerbaijan (ABB)').trim();
    const finalIban = (iban || wallet.iban || '').trim().toUpperCase();
    const finalSwift = (swiftBic || wallet.swiftBic || 'IBAZAZ2X').trim().toUpperCase();
    const finalHolder = (accountHolder || wallet.accountHolder || 'Account Holder').trim();

    if (!finalIban) {
      const err = new Error('Please provide a valid IBAN or card number for withdrawal.');
      err.statusCode = 400;
      throw err;
    }

    // Persist bank coordinates on wallet for convenience
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        bankName: finalBankName,
        iban: finalIban,
        swiftBic: finalSwift,
        accountHolder: finalHolder,
      },
    });

    const payout = await tx.payoutRequest.create({
      data: {
        walletId: wallet.id,
        amount: amountEur,
        bankName: finalBankName,
        iban: finalIban,
        swiftBic: finalSwift,
        status: 'PENDING',
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -amountEur,
        type: 'DEBIT',
        referenceType: 'PAYOUT',
        referenceId: payout.id,
        description:
          String(currency).toUpperCase() === 'AZN'
            ? `Wallet Withdrawal Request to ${finalBankName} (${rawAmt.toFixed(2)} AZN ≈ €${amountEur.toFixed(2)})`
            : `Wallet Withdrawal Request to ${finalBankName} (${finalIban.slice(-4)})`,
        status: 'PENDING',
      },
    });

    const updatedSummary = await recalculateWalletBalances(wallet.id, tx);

    try {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_WITHDRAWAL_REQUESTED',
          details: {
            payoutId: payout.id,
            amountEur,
            originalAmount: rawAmt,
            currency,
            bankName: finalBankName,
            iban: `***${finalIban.slice(-4)}`,
            newBalance: updatedSummary.balance,
          },
        },
      });
    } catch {}

    const newBalanceAzn = Number((updatedSummary.balance * eurToAznRate).toFixed(2));
    return {
      payout,
      wallet: {
        ...updatedSummary.wallet,
        balance: updatedSummary.balance,
        balanceEur: updatedSummary.balance,
        balanceAzn: newBalanceAzn,
      },
      balance: updatedSummary.balance,
      balanceEur: updatedSummary.balance,
      balanceAzn: newBalanceAzn,
      newBalance: updatedSummary.balance,
      newBalanceEur: updatedSummary.balance,
      newBalanceAzn: convertEurToAzn(updatedSummary.balance, eurToAznRate),
    };
  });
}

/**
 * Pay a Dossier, GroupBatch, or CorporateInvoice directly using the user's Wallet balance
 * Supports optional promoCode (atomically validated & applied inside the same DB transaction).
 */
async function payWithWallet({
  userId,
  userRole,
  dossierId = null,
  groupBatchId = null,
  invoiceId = null,
  promoCode = null,
  scope = null,
  source = null,
}) {
  if (promoCode && String(source || '').toUpperCase() === 'WIZARD_5_STEP') {
    const err = new Error('Promo codes are not applicable in the 5-step application wizard.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const eurToAznRate = await getEurToAznRate(tx);
    const wallet = await getOrCreateWallet(userId, tx);

    // Row-level InnoDB lock on Wallet to prevent concurrent double-spend
    await tx.$queryRaw`SELECT id FROM Wallet WHERE id = ${wallet.id} FOR UPDATE`;

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
        include: { dossiers: { include: { applicants: true } }, invoices: true },
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
      const allDossiersPaid = batch.dossiers.length > 0 && batch.dossiers.every((d) => d.paymentStatus === 'PAID');
      const existingBatchPaidTx = batch.dossiers.length === 0 ? await findPaidGroupBatchTransaction(tx, batch) : null;

      if ((allDossiersPaid && (!inv || inv.status === 'PAID')) || existingBatchPaidTx) {
        const err = new Error('This group/batch has already been settled.');
        err.statusCode = 400;
        throw err;
      }

      const catalog = await getPricingCatalog(tx);
      const totalAppsCount = batch.dossiers.reduce((sum, d) => sum + (d.applicants ? d.applicants.length : 0), 0);
      let grossRequiredEur = inv
        ? Number(Number(inv.amount || 0).toFixed(2))
        : Number(batch.dossiers.reduce((s, d) => s + Number(d.totalAmount || 0), 0).toFixed(2));

      if (grossRequiredEur <= 0) {
        const dynamicFees = calculatePortalFees({
          portalType: batch.portalType || 'GROUP_AGENT',
          paxCount: Math.max(1, totalAppsCount),
          activePackage: batch.packageTier || 'standard',
          duration: batch.duration || 'short',
          catalog,
        });
        grossRequiredEur = Number(dynamicFees.grandTotalEur || 0);
      }

      const priorBatchDiscount = await promoService.getGroupBatchConfirmedDiscountEur(batch.id, tx);
      const originalDueEur = Math.max(0, Number((grossRequiredEur - priorBatchDiscount).toFixed(2)));

      if (originalDueEur <= 0) {
        const err = new Error('No payable amount found for this group/batch.');
        err.statusCode = 400;
        throw err;
      }

      // Optional Promo Code validation & atomic application
      let promoRes = null;
      let netPayableEur = originalDueEur;
      if (promoCode && String(promoCode).trim()) {
        promoRes = await promoService.reserveOrApplyPromoInTx(tx, {
          code: promoCode,
          userId,
          userRole,
          paymentMethod: 'WALLET',
          mode: 'APPLY',
          groupBatchId: batch.id,
          invoiceId: inv?.id || null,
          scope: scope || 'GROUP_BATCH_PAYMENT',
          source,
        });
        netPayableEur = promoRes.finalAmountEur;
      }

      if (netPayableEur > 0 && availableEur + 0.001 < netPayableEur) {
        const err = new Error(
          `Insufficient wallet balance. Available: €${availableEur.toFixed(2)}, Required: €${netPayableEur.toFixed(2)}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const ref = `${netPayableEur <= 0 ? 'PRM' : 'WLT'}-${batch.code}-${Date.now().toString().slice(-5)}`;
      if (netPayableEur > 0) {
        const promoSuffix = promoRes
          ? ` (Promo: ${promoRes.promo.code} -€${promoRes.discountAmountEur.toFixed(2)})`
          : '';
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -netPayableEur,
            type: 'DEBIT',
            referenceType: 'VISA_PAYMENT',
            referenceId: batch.code,
            description: `Group/Batch Visa Fees: ${batch.name} (${batch.code})${promoSuffix}`,
            status: 'PAID',
          },
        });
      }

      const settlement = await settleGroupBatchInTx(tx, {
        groupBatchId: batch.id,
        payerUserId: userId,
        paymentProvider: netPayableEur <= 0 ? 'PROMO_FULL_COVERAGE' : 'WALLET',
        referenceCode: ref,
        explicitAmountEur: netPayableEur,
        promoMeta: promoRes
          ? {
              promoCode: promoRes.promo.code,
              redemptionId: promoRes.redemption.id,
              originalAmountEur: promoRes.originalAmountEur,
              discountAmountEur: promoRes.discountAmountEur,
              allowAgentCommission: promoRes.allowAgentCommission,
              consularFeeTotalEur: promoRes.consularFeeTotalEur,
            }
          : null,
      });

      if (promoRes && settlement.transaction?.id) {
        await tx.promoCodeRedemption.update({
          where: { id: promoRes.redemption.id },
          data: { transactionId: settlement.transaction.id },
        });
      }

      const finalSummary = await recalculateWalletBalances(wallet.id, tx);

      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_GROUP_PAYMENT',
          details: {
            groupBatchId: batch.id,
            batchCode: batch.code,
            originalAmountEur: promoRes ? promoRes.originalAmountEur : originalDueEur,
            discountAmountEur: promoRes ? promoRes.discountAmountEur : 0,
            appliedPromoCode: promoRes ? promoRes.promo.code : null,
            paidEur: netPayableEur,
            newBalance: finalSummary.balance,
          },
        },
      });

      return {
        originalAmountEur: promoRes ? promoRes.originalAmountEur : originalDueEur,
        discountAmountEur: promoRes ? promoRes.discountAmountEur : 0,
        appliedPromoCode: promoRes ? promoRes.promo.code : null,
        paidAmountEur: netPayableEur,
        paidAmountAzn: convertEurToAzn(netPayableEur, eurToAznRate),
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

      const { settledCreditEur } = await getDossierSettledCreditEur(dossier.id, tx, eurToAznRate);
      const dueEur = Math.max(0, Number((Number(dossier.totalAmount || 0) - settledCreditEur).toFixed(2)));

      if (dueEur <= 0) {
        const err = new Error('This dossier is already fully paid.');
        err.statusCode = 400;
        throw err;
      }

      let promoRes = null;
      let netPayableEur = dueEur;
      if (promoCode && String(promoCode).trim()) {
        promoRes = await promoService.reserveOrApplyPromoInTx(tx, {
          code: promoCode,
          userId,
          userRole,
          paymentMethod: 'WALLET',
          mode: 'APPLY',
          dossierId: dossier.id,
          scope: scope || 'DOSSIER_PAYMENT',
          source,
        });
        netPayableEur = promoRes.finalAmountEur;
      }

      if (netPayableEur > 0 && availableEur + 0.001 < netPayableEur) {
        const err = new Error(
          `Insufficient wallet balance. Available: €${availableEur.toFixed(2)}, Required: €${netPayableEur.toFixed(2)}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const ref = `${netPayableEur <= 0 ? 'PRM' : 'WLT'}-${dossier.dossierNumber}-${Date.now().toString().slice(-4)}`;
      if (netPayableEur > 0) {
        const promoSuffix = promoRes
          ? ` (Promo: ${promoRes.promo.code} -€${promoRes.discountAmountEur.toFixed(2)})`
          : '';
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -netPayableEur,
            type: 'DEBIT',
            referenceType: 'VISA_PAYMENT',
            referenceId: dossier.dossierNumber,
            description: `Consular & Service Fees: Dossier ${dossier.dossierNumber}${promoSuffix}`,
            status: 'PAID',
          },
        });
      }

      const settled = await settleDossierInTx(tx, {
        dossierId: dossier.id,
        payerUserId: userId,
        paymentProvider: netPayableEur <= 0 ? 'PROMO_FULL_COVERAGE' : 'WALLET',
        referenceCode: ref,
        explicitAmountEur: netPayableEur,
        promoMeta: promoRes
          ? {
              promoCode: promoRes.promo.code,
              redemptionId: promoRes.redemption.id,
              originalAmountEur: promoRes.originalAmountEur,
              discountAmountEur: promoRes.discountAmountEur,
            }
          : null,
      });

      if (promoRes && settled.transaction?.id) {
        await tx.promoCodeRedemption.update({
          where: { id: promoRes.redemption.id },
          data: { transactionId: settled.transaction.id },
        });
      }

      const finalSummary = await recalculateWalletBalances(wallet.id, tx);

      await tx.auditLog.create({
        data: {
          userId,
          action: 'WALLET_DOSSIER_PAYMENT',
          details: {
            dossierId: dossier.id,
            dossierNumber: dossier.dossierNumber,
            originalAmountEur: promoRes ? promoRes.originalAmountEur : dueEur,
            discountAmountEur: promoRes ? promoRes.discountAmountEur : 0,
            appliedPromoCode: promoRes ? promoRes.promo.code : null,
            paidEur: netPayableEur,
            newBalance: finalSummary.balance,
          },
        },
      });

      // Trigger non-blocking Schengen PDF & ZIP archive fulfillment after transaction commits
      if (settled && settled.transaction && settled.transaction.dossierId) {
        setImmediate(async () => {
          try {
            const paymentSvc = require('./payment.service');
            if (typeof paymentSvc.fulfillDossierPayment === 'function') {
              await paymentSvc.fulfillDossierPayment(settled.transaction);
            }
          } catch {}
        });
      }

      return {
        originalAmountEur: promoRes ? promoRes.originalAmountEur : dueEur,
        discountAmountEur: promoRes ? promoRes.discountAmountEur : 0,
        appliedPromoCode: promoRes ? promoRes.promo.code : null,
        paidAmountEur: netPayableEur,
        paidAmountAzn: convertEurToAzn(netPayableEur, eurToAznRate),
        newBalance: finalSummary.balance,
        newBalanceEur: finalSummary.balance,
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
 * Also writes a WALLET_REFUND Transaction row when dossierId is supplied so net-paid math stays exact.
 */
async function refundToWallet({ userId, amountEur, reason, referenceId = null, dossierId = null }, tx = prisma) {
  const amt = Number(Number(amountEur || 0).toFixed(2));
  if (amt <= 0) return null;

  const ref = referenceId || `REFUND-${Date.now().toString().slice(-6)}`;
  const wallet = await getOrCreateWallet(userId, tx);
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: amt,
      type: 'CREDIT',
      referenceType: 'TOPUP',
      referenceId: ref,
      description: `Refund Credited: ${reason}`,
      status: 'PAID',
    },
  });

  if (dossierId) {
    await tx.transaction.create({
      data: {
        dossierId,
        userId,
        amount: amt,
        currency: 'EUR',
        paymentProvider: 'WALLET_REFUND',
        orderReference: ref,
        status: 'REFUNDED',
        metadataJson: { reason },
      },
    });
  }

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
    const { netPaidEur, confirmedDiscountEur, settledCreditEur } = await getDossierSettledCreditEur(
      d.id,
      prisma,
      eurToAznRate
    );
    const totalEur = Number(Number(d.totalAmount || 0).toFixed(2));
    const dueEur =
      d.paymentStatus === 'PAID' && settledCreditEur >= totalEur
        ? 0.0
        : Math.max(0, Number((totalEur - settledCreditEur).toFixed(2)));

    if (dueEur > 0) {
      totalUnpaidEur += dueEur;
    }

    dossierInvoices.push({
      id: d.id,
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
      discountAmountEur: confirmedDiscountEur,
      appliedPromoCode: d.appliedPromoCode || null,
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

  const balanceAzn = convertEurToAzn(summary.balance, eurToAznRate);
  const pendingBalanceAzn = convertEurToAzn(summary.pendingBalance, eurToAznRate);
  const totalDepositedAzn = convertEurToAzn(summary.totalTopups, eurToAznRate);
  const totalSpentAzn = convertEurToAzn(summary.totalSpent, eurToAznRate);
  const totalUnpaidEurFixed = Number(totalUnpaidEur.toFixed(2));
  const totalUnpaidAzn = convertEurToAzn(totalUnpaidEurFixed, eurToAznRate);

  const normalizedSlips = (pendingBankSlips || []).map((s) => {
    const meta = s.metadataJson && typeof s.metadataJson === 'object' ? s.metadataJson : {};
    return {
      ...s,
      bankName: meta.bankName || s.bankName || 'Bank Wire Transfer',
      senderName: meta.senderName || s.senderName || user?.fullName || 'Applicant',
      displayStatus: s.status === 'PAID' ? 'VERIFIED' : s.status === 'REFUNDED' ? 'REJECTED' : s.status,
    };
  });

  return {
    user,
    balance: summary.balance,
    balanceEur: summary.balance,
    balanceAzn,
    pendingBalance: summary.pendingBalance,
    pendingBalanceAzn,
    totalTopups: summary.totalTopups,
    totalDepositedEur: summary.totalTopups,
    totalDepositedAzn,
    totalSpent: summary.totalSpent,
    totalSpentEur: summary.totalSpent,
    totalSpentAzn,
    totalUnpaidEur: totalUnpaidEurFixed,
    totalUnpaidAzn,
    eurToAznRate,
    transactions: summary.transactions,
    payoutRequests,
    bankSlips: normalizedSlips,
    pendingBankSlips: normalizedSlips,
    dossierInvoices,
    wallet: {
      ...summary.wallet,
      balance: summary.balance,
      balanceEur: summary.balance,
      balanceAzn,
      pendingBalance: summary.pendingBalance,
      pendingBalanceAzn,
      totalEarnedCommissions: summary.totalEarnedCommissions,
      totalTopups: summary.totalTopups,
      totalDepositedEur: summary.totalTopups,
      totalDepositedAzn,
      totalSpent: summary.totalSpent,
      totalSpentEur: summary.totalSpent,
      totalSpentAzn,
      totalUnpaidEur: totalUnpaidEurFixed,
      totalUnpaidAzn,
      eurToAznRate,
      transactions: summary.transactions,
      payoutRequests,
    },
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
  getDossierSettledCreditEur,
  findPaidGroupBatchTransaction,
  ensureGroupBatchPrimaryDossierInTx,
  settleGroupBatchInTx,
  settleDossierInTx,
  topupWallet,
  saveWalletBankDetails,
  requestWalletPayout,
  payWithWallet,
  refundToWallet,
  getUserWalletOverview,
  adminGetAllWallets,
  adminAdjustWallet,
};

