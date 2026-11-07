const stripe = require('stripe')(require('../../config/env').STRIPE_SECRET_KEY);
const prisma = require('../../config/db');
const env = require('../../config/env');
const { convertToEur } = require('../../config/constants');
const { getAgentCommissionRate } = require('../../utils/finance.util');
const { generateApplicationPdf } = require('../../utils/pdf.util');
const { archiveDossierFiles } = require('../../utils/zip.util');
const notificationService = require('../notification/notification.service');
const localBankAdapter = require('./adapters/localBankAdapter');
const walletService = require('./wallet.service');

/**
 * Fulfills a dossier payment once confirmed via Stripe, Local Bank, Wallet, or Bank Slip
 */
async function fulfillDossierPayment(transaction) {
  if (!transaction || !transaction.dossierId) {
    return null;
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: transaction.dossierId },
    include: {
      applicants: true,
      documents: true,
      user: true,
      groupBatch: true,
    },
  });

  if (!dossier) {
    throw new Error('Dossier not found for fulfillment');
  }

  // 1. Generate 37-point Harmonized Schengen Application PDFs
  const generatedPdfs = [];
  for (const applicant of dossier.applicants) {
    try {
      const pdf = await generateApplicationPdf(dossier, applicant);
      generatedPdfs.push(pdf.filePath);
    } catch (err) {
      console.warn('PDF generation notice during fulfillment:', err.message);
    }
  }

  // 2. Archive dossier files into ZIP package
  const userDocPaths = dossier.documents.map((d) => d.fileUrl.replace('/uploads/', './uploads/'));
  const allFilesToArchive = [...generatedPdfs, ...userDocPaths];

  let zipUrl = dossier.archivedZipUrl;
  try {
    const archiveResult = await archiveDossierFiles(dossier.dossierNumber, allFilesToArchive);
    zipUrl = archiveResult.fileUrl;
  } catch (err) {
    console.warn('ZIP archive notice during fulfillment:', err.message);
  }

  // 3. Update dossier status to UNDER_REVIEW and confirm appointments
  const nextStatus = dossier.status === 'RECEIVED' ? 'UNDER_REVIEW' : dossier.status;
  const updatedDossier = await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      paymentStatus: 'PAID',
      status: nextStatus,
      currentStep: Math.max(dossier.currentStep || 1, 8),
      archivedZipUrl: zipUrl,
      statusHistory: {
        create: {
          fromStatus: dossier.status,
          toStatus: nextStatus,
          changedByUserId: dossier.userId,
          notes: `Payment confirmed via ${transaction.paymentProvider} (${transaction.amount} ${transaction.currency}). Dossier queued for consular review.`,
        },
      },
    },
  });

  await prisma.appointment.updateMany({
    where: { dossierId: dossier.id, status: 'PENDING_PAYMENT' },
    data: { status: 'CONFIRMED' },
  });

  // 4. B2B Group Agent Commission Settlement (Idempotent using group.code or dossier.dossierNumber)
  if (dossier.portalType === 'GROUP_AGENT' || dossier.user?.role === 'AGENT_TUR_OPERATOR') {
    try {
      const tier = dossier.user?.agentTier || 'BRONZE';
      const tierRate = getAgentCommissionRate(tier);
      const applicantCount = Math.max(dossier.applicants.length, 1);
      const totalCommission = Number((tierRate * applicantCount).toFixed(2));
      const commRefId = dossier.groupBatch?.code || dossier.dossierNumber;

      const wallet = await walletService.getOrCreateWallet(dossier.userId);
      const existingComm = await prisma.walletTransaction.findFirst({
        where: {
          walletId: wallet.id,
          referenceType: 'COMMISSION',
          referenceId: commRefId,
        },
      });

      const desc = `Commission: ${dossier.groupBatch?.name || dossier.dossierNumber} (${applicantCount} Pax @ €${tierRate.toFixed(2)} [${tier}])`;
      if (existingComm) {
        await prisma.walletTransaction.update({
          where: { id: existingComm.id },
          data: {
            amount: totalCommission,
            status: 'PAID',
            description: desc,
          },
        });
      } else {
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: totalCommission,
            type: 'CREDIT',
            referenceType: 'COMMISSION',
            referenceId: commRefId,
            description: desc,
            status: 'PAID',
          },
        });
      }

      await walletService.recalculateWalletBalances(wallet.id);
    } catch (commErr) {
      console.error('Agent commission credit failed:', commErr);
    }
  }

  // 5. Send confirmation notification to applicant
  try {
    await notificationService.sendDossierSubmittedNotification(
      dossier.user.email,
      dossier.user.fullName,
      dossier.dossierNumber
    );
  } catch (notifErr) {
    console.error('Notification dispatch warning:', notifErr.message);
  }

  return updatedDossier;
}

/**
 * Creates Stripe PaymentIntent supporting Dossier, GroupBatch, CorporateInvoice, or Wallet Top-Up
 */
async function createPaymentIntent(input, userId, idempotencyKey = null) {
  let dossierId = null;
  let groupBatchId = null;
  let invoiceId = null;
  let explicitAmount = null;
  let currency = 'EUR';
  let purpose = 'DOSSIER_PAYMENT';

  if (typeof input === 'string') {
    dossierId = input;
  } else if (input && typeof input === 'object') {
    dossierId = input.dossierId || null;
    groupBatchId = input.groupBatchId || null;
    invoiceId = input.invoiceId || null;
    explicitAmount = input.amount;
    currency = input.currency || 'EUR';
    purpose = input.purpose || (groupBatchId || invoiceId ? 'GROUP_BATCH_PAYMENT' : 'DOSSIER_PAYMENT');
    if (input.idempotencyKey && !idempotencyKey) {
      idempotencyKey = input.idempotencyKey;
    }
  }

  if (idempotencyKey) {
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTx && existingTx.metadataJson && existingTx.metadataJson.clientSecret) {
      return {
        clientSecret: existingTx.metadataJson.clientSecret,
        paymentIntentId: existingTx.stripePaymentIntentId,
        amount: existingTx.amount,
        currency: existingTx.currency,
        idempotencyKey: existingTx.idempotencyKey,
      };
    }
  }

  const eurToAznRate = await walletService.getEurToAznRate();
  let targetAmountEur = 0.0;
  let resolvedDossierId = dossierId;
  let resolvedGroupBatchId = groupBatchId;
  let refTag = 'PAY';

  if (invoiceId && !resolvedGroupBatchId) {
    const inv = await prisma.corporateInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new Error('Corporate invoice not found');
    resolvedGroupBatchId = inv.groupBatchId || null;
    targetAmountEur = Number(inv.amount || 0);
    refTag = inv.invoiceNumber;
  }

  if (String(purpose).toUpperCase() === 'WALLET_TOPUP') {
    targetAmountEur = convertToEur(explicitAmount, currency, eurToAznRate);
    refTag = 'TOPUP';
    if (targetAmountEur <= 0) {
      throw new Error('Valid top-up amount is required');
    }
  } else if (resolvedGroupBatchId) {
    const batch = await prisma.groupBatch.findUnique({
      where: { id: resolvedGroupBatchId },
      include: { dossiers: true, invoices: true },
    });
    if (!batch) {
      throw new Error('Group / Batch not found');
    }
    resolvedDossierId = resolvedDossierId || batch.dossiers[0]?.id || null;
    const inv = batch.invoices.find((i) => i.status !== 'PAID') || batch.invoices[0] || null;
    const computedBatchTotal = inv
      ? Number(inv.amount || 0)
      : batch.dossiers.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
    targetAmountEur =
      computedBatchTotal > 0
        ? Number(computedBatchTotal.toFixed(2))
        : convertToEur(explicitAmount || 145, currency, eurToAznRate);
    refTag = batch.code;
  } else if (resolvedDossierId) {
    const dossier = await prisma.dossier.findUnique({
      where: { id: resolvedDossierId },
      include: { applicants: true },
    });
    if (!dossier) {
      throw new Error('Dossier not found');
    }
    const netPaid = await walletService.getDossierNetPaidEur(dossier.id, prisma, eurToAznRate);
    const dueEur = Math.max(0, Number((Number(dossier.totalAmount || 0) - netPaid).toFixed(2)));
    targetAmountEur = dueEur > 0 ? dueEur : Number(dossier.totalAmount || 0);
    refTag = dossier.dossierNumber;

    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { currentStep: Math.max(dossier.currentStep || 1, 5) },
    });
  } else {
    throw new Error('Dossier ID, Group Batch ID, or Wallet Top-Up purpose is required');
  }

  const generatedIdempotencyKey = idempotencyKey || `tx_idemp_${refTag}_${Date.now()}`;
  const amountInCents = Math.max(50, Math.round(targetAmountEur * 100));

  let paymentIntent;
  const isMockStripe = !env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.includes('mock');
  if (isMockStripe) {
    const mockId = `pi_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    paymentIntent = {
      id: mockId,
      client_secret: `${mockId}_secret`,
      amount: amountInCents,
    };
  } else {
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: 'eur',
          metadata: {
            dossierId: resolvedDossierId || '',
            groupBatchId: resolvedGroupBatchId || '',
            purpose,
            userId,
          },
        },
        { idempotencyKey: generatedIdempotencyKey }
      );
    } catch (err) {
      console.warn('Stripe SDK live error (using sandbox fallback):', err.message);
      const mockId = `pi_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      paymentIntent = {
        id: mockId,
        client_secret: `${mockId}_secret`,
        amount: amountInCents,
      };
    }
  }

  await prisma.transaction.create({
    data: {
      dossierId: resolvedDossierId || null,
      userId,
      amount: targetAmountEur,
      currency: 'EUR',
      paymentProvider: 'STRIPE',
      stripePaymentIntentId: paymentIntent.id,
      idempotencyKey: generatedIdempotencyKey,
      status: 'PENDING',
      metadataJson: {
        clientSecret: paymentIntent.client_secret,
        groupBatchId: resolvedGroupBatchId || null,
        invoiceId: invoiceId || null,
        purpose,
      },
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: targetAmountEur,
    currency: 'EUR',
    idempotencyKey: generatedIdempotencyKey,
  };
}

/**
 * Confirms payment success via Stripe PaymentIntent ID (Dossier, GroupBatch, or Wallet Top-Up)
 */
async function confirmPaymentSuccess(paymentIntentId) {
  const transaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!transaction) {
    throw new Error(`Transaction with paymentIntentId ${paymentIntentId} not found`);
  }

  if (transaction.status === 'PAID') {
    if (transaction.dossierId) {
      return prisma.dossier.findUnique({ where: { id: transaction.dossierId } });
    }
    return { alreadyConfirmed: true, transaction };
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: 'PAID' },
  });

  const meta = transaction.metadataJson || {};

  // Case 1: Wallet Top-Up via Card
  if (String(meta.purpose || '').toUpperCase() === 'WALLET_TOPUP') {
    await prisma.$transaction(async (tx) => {
      const wallet = await walletService.getOrCreateWallet(transaction.userId, tx);
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: Number(transaction.amount),
          type: 'CREDIT',
          referenceType: 'TOPUP',
          referenceId: paymentIntentId,
          description: `Wallet Top-Up via Online Card (€${Number(transaction.amount).toFixed(2)})`,
          status: 'PAID',
        },
      });
      await walletService.recalculateWalletBalances(wallet.id, tx);
    });
    return { purpose: 'WALLET_TOPUP', creditedEur: transaction.amount };
  }

  // Case 2: GroupBatch / Corporate Invoice Card Settlement
  if (meta.groupBatchId) {
    const settlement = await prisma.$transaction(async (tx) => {
      return walletService.settleGroupBatchInTx(tx, {
        groupBatchId: meta.groupBatchId,
        payerUserId: transaction.userId,
        paymentProvider: 'STRIPE_CARD',
        referenceCode: paymentIntentId,
        explicitAmountEur: Number(transaction.amount),
      });
    });
    if (transaction.dossierId) {
      return prisma.dossier.findUnique({ where: { id: transaction.dossierId } });
    }
    return settlement;
  }

  // Case 3: Individual Dossier Settlement
  return fulfillDossierPayment(transaction);
}

/**
 * Handles Stripe Cryptographic Webhook
 */
async function handleStripeWebhook({ rawBody, signatureHeader, eventBody }) {
  let event;
  const endpointSecret = env.STRIPE_WEBHOOK_SECRET;

  if (signatureHeader && rawBody && endpointSecret && !endpointSecret.includes('mock')) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret);
    } catch (err) {
      const error = new Error(`Webhook Signature Verification Failed: ${err.message}`);
      error.statusCode = 400;
      throw error;
    }
  } else {
    event = eventBody;
  }

  if (!event || !event.type) {
    throw new Error('Invalid webhook event payload');
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      await confirmPaymentSuccess(paymentIntent.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      await prisma.transaction.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: 'PENDING' },
      });
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      const piId = charge.payment_intent;
      if (piId) {
        const tx = await prisma.transaction.findFirst({ where: { stripePaymentIntentId: piId } });
        if (tx) {
          await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'REFUNDED' } });
          if (tx.dossierId) {
            await prisma.dossier.update({ where: { id: tx.dossierId }, data: { paymentStatus: 'REFUNDED' } });
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return { received: true, eventType: event.type };
}

/**
 * Creates Local Bank Order (Azericard / Kapital Pay)
 */
async function createLocalBankOrder(dossierId, userId, returnUrl) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const orderReference = `ORD-AZ-${dossier.dossierNumber}-${Date.now().toString().slice(-4)}`;
  const orderData = localBankAdapter.createOrder({
    orderReference,
    amount: dossier.totalAmount,
    currency: 'AZN',
    description: `EuroTech Viza Rüsumu (${dossier.dossierNumber})`,
    returnUrl: returnUrl || 'https://eurotech.services/payment/callback',
  });

  await prisma.transaction.create({
    data: {
      dossierId: dossier.id,
      userId,
      amount: dossier.totalAmount,
      currency: 'AZN',
      paymentProvider: 'LOCAL_BANK',
      orderReference,
      status: 'PENDING',
      metadataJson: orderData.params,
    },
  });

  return orderData;
}

/**
 * Confirms Local Bank Payment Callback
 */
async function confirmLocalBankPayment(callbackData) {
  const verification = localBankAdapter.verifyCallback(callbackData);

  if (!verification.isValid) {
    const error = new Error('Local bank callback signature mismatch');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await prisma.transaction.findFirst({
    where: { orderReference: verification.orderReference },
  });

  if (!transaction) {
    throw new Error(`Transaction with orderReference ${verification.orderReference} not found`);
  }

  if (verification.isSuccessful) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'PAID' },
    });
    return fulfillDossierPayment(transaction);
  } else {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'PENDING' },
    });
    return { status: 'FAILED', message: 'Bank payment was not approved' };
  }
}

/**
 * Submits Bank Wire / Slip Receipt for Manual Reconciliation (Dossier, GroupBatch, Corporate Invoice, or Wallet Top-Up)
 */
async function submitBankPaymentSlip({
  dossierId,
  groupBatchId,
  invoiceId,
  userId,
  amount,
  currency,
  referenceCode,
  fileUrl,
  fileName,
  bankName,
  depositDate,
  senderName,
  purpose,
}) {
  let resolvedGroupBatchId = groupBatchId || null;
  if (invoiceId && !resolvedGroupBatchId) {
    const inv = await prisma.corporateInvoice.findUnique({ where: { id: invoiceId } });
    if (inv && inv.groupBatchId) {
      resolvedGroupBatchId = inv.groupBatchId;
    }
  }

  let dossier = null;
  if (dossierId) {
    dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      throw new Error('Dossier not found');
    }
  }

  const resolvedPurpose =
    purpose ||
    (resolvedGroupBatchId ? 'GROUP_BATCH_PAYMENT' : dossierId ? 'DOSSIER_PAYMENT' : 'WALLET_TOPUP');

  const receipt = await prisma.bankPaymentReceipt.create({
    data: {
      dossierId: dossierId || null,
      groupBatchId: resolvedGroupBatchId,
      userId,
      amount: Number(amount) || (dossier ? dossier.totalAmount : 0),
      currency: currency || 'EUR',
      referenceCode: referenceCode || `REF-EUR-${Date.now()}`,
      fileUrl: fileUrl || '/uploads/bank-slip-placeholder.pdf',
      fileName: fileName || 'bank-slip.pdf',
      purpose: resolvedPurpose,
      metadataJson: {
        bankName: bankName || null,
        depositDate: depositDate ? new Date(depositDate).toISOString() : null,
        senderName: senderName || null,
        invoiceId: invoiceId || null,
      },
      status: 'PENDING',
    },
  });

  if (dossierId && dossier) {
    await prisma.dossierStatusHistory.create({
      data: {
        dossierId,
        fromStatus: dossier.status,
        toStatus: dossier.status,
        changedByUserId: userId,
        notes: `Bank köçürmə qəbzi yükləndi (${receipt.referenceCode}). Mühasibatlıq təsdiqi gözlənilir.`,
      },
    });
  }

  return receipt;
}

async function getBankPaymentSlips(status = null) {
  const where = {};
  if (status) where.status = status;

  return prisma.bankPaymentReceipt.findMany({
    where,
    include: {
      user: {
        select: { id: true, fullName: true, email: true, phone: true, companyName: true, role: true },
      },
      dossier: {
        select: { id: true, dossierNumber: true, totalAmount: true, status: true },
      },
      groupBatch: {
        select: { id: true, code: true, name: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Unified Admin / Finance Reconciliation of Bank Payment Slips:
 * Supports WALLET_TOPUP, GROUP_BATCH_PAYMENT (Agent & Corporate), and DOSSIER_PAYMENT (Individual)
 */
async function reviewBankPaymentSlip({ receiptId, adminUserId, action, adminNotes }) {
  const receipt = await prisma.bankPaymentReceipt.findUnique({
    where: { id: receiptId },
    include: { dossier: true, groupBatch: true },
  });

  if (!receipt) {
    const err = new Error('Bank payment receipt not found');
    err.statusCode = 404;
    throw err;
  }

  const normalizedAction = String(action || '').toUpperCase();
  const isApproved = ['APPROVE', 'APPROVED', 'PAID'].includes(normalizedAction);

  if (isApproved && receipt.status === 'PAID') {
    const err = new Error('This bank payment slip has already been approved and reconciled.');
    err.statusCode = 400;
    throw err;
  }

  const eurToAznRate = await walletService.getEurToAznRate();
  const amountEur = convertToEur(receipt.amount, receipt.currency || 'EUR', eurToAznRate);
  const purposeUpper = String(receipt.purpose || '').toUpperCase();
  const isWalletTopup = purposeUpper.includes('TOPUP') || (!receipt.dossierId && !receipt.groupBatchId);

  let dossierTxForArchive = null;

  const updatedReceipt = await prisma.$transaction(async (tx) => {
    const updated = await tx.bankPaymentReceipt.update({
      where: { id: receiptId },
      data: {
        status: isApproved ? 'PAID' : 'REFUNDED',
        adminNotes: adminNotes || (isApproved ? 'Verified and approved by Finance' : 'Bank transfer rejected'),
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
    });

    if (isApproved) {
      if (isWalletTopup) {
        const wallet = await walletService.getOrCreateWallet(receipt.userId, tx);
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: amountEur,
            type: 'CREDIT',
            referenceType: 'TOPUP',
            referenceId: receipt.referenceCode,
            description:
              String(receipt.currency || 'EUR').toUpperCase() === 'AZN'
                ? `Bank Wire Top-Up Approved (${Number(receipt.amount).toFixed(2)} AZN ≈ €${amountEur.toFixed(2)})`
                : `Bank Wire Top-Up Approved (€${amountEur.toFixed(2)} • ${receipt.referenceCode})`,
            status: 'PAID',
          },
        });

        await tx.transaction.create({
          data: {
            userId: receipt.userId,
            amount: amountEur,
            currency: 'EUR',
            paymentProvider: 'BANK_TRANSFER',
            orderReference: receipt.referenceCode,
            receiptUrl: receipt.fileUrl,
            status: 'PAID',
            metadataJson: {
              purpose: 'WALLET_TOPUP',
              bankSlipId: receipt.id,
              approvedBy: adminUserId,
              adminNotes,
            },
          },
        });

        await walletService.recalculateWalletBalances(wallet.id, tx);
      } else if (receipt.groupBatchId) {
        await walletService.settleGroupBatchInTx(tx, {
          groupBatchId: receipt.groupBatchId,
          payerUserId: receipt.userId,
          paymentProvider: 'BANK_TRANSFER',
          referenceCode: receipt.referenceCode,
          receiptUrl: receipt.fileUrl,
          explicitAmountEur: amountEur,
        });
      } else if (receipt.dossierId) {
        const settled = await walletService.settleDossierInTx(tx, {
          dossierId: receipt.dossierId,
          payerUserId: receipt.userId,
          paymentProvider: 'BANK_TRANSFER',
          referenceCode: receipt.referenceCode,
          receiptUrl: receipt.fileUrl,
          explicitAmountEur: amountEur,
        });
        dossierTxForArchive = settled.transaction;
      }
    } else if (receipt.dossierId) {
      // Only revert dossier to PENDING if no other PAID transaction exists for it
      const otherPaid = await tx.transaction.count({
        where: { dossierId: receipt.dossierId, status: 'PAID' },
      });
      if (otherPaid === 0) {
        await tx.dossier.update({
          where: { id: receipt.dossierId },
          data: { paymentStatus: 'PENDING' },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'BANK_SLIP_REVIEWED',
        details: {
          receiptId: receipt.id,
          purpose: receipt.purpose,
          dossierId: receipt.dossierId,
          groupBatchId: receipt.groupBatchId,
          amountEur,
          decision: isApproved ? 'APPROVED' : 'REJECTED',
          notes: adminNotes || null,
        },
      },
    });

    return updated;
  });

  // Non-blocking Schengen PDF & ZIP generation for individual dossiers
  if (isApproved && dossierTxForArchive && dossierTxForArchive.dossierId) {
    try {
      await fulfillDossierPayment(dossierTxForArchive);
    } catch (err) {
      console.warn('Post-approval PDF/ZIP fulfillment notice:', err.message);
    }
  }

  return updatedReceipt;
}

/**
 * Creates SaaS Corporate Subscription
 */
async function createSaaSSubscription(userId, planTier) {
  const tiers = {
    BASIC_199: 199.0,
    PRO_499: 499.0,
    ENTERPRISE_999: 999.0,
  };

  const monthlyFee = tiers[planTier] || 199.0;

  const subscription = await prisma.corporateSubscription.create({
    data: {
      userId,
      planTier,
      monthlyFee,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return subscription;
}

module.exports = {
  createPaymentIntent,
  confirmPaymentSuccess,
  handleStripeWebhook,
  createLocalBankOrder,
  confirmLocalBankPayment,
  submitBankPaymentSlip,
  getBankPaymentSlips,
  reviewBankPaymentSlip,
  createSaaSSubscription,
  fulfillDossierPayment,
};
