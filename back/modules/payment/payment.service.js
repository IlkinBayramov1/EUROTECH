const stripe = require('stripe')(require('../../config/env').STRIPE_SECRET_KEY);
const prisma = require('../../config/db');
const env = require('../../config/env');
const { generateApplicationPdf } = require('../../utils/pdf.util');
const { archiveDossierFiles } = require('../../utils/zip.util');
const notificationService = require('../notification/notification.service');
const localBankAdapter = require('./adapters/localBankAdapter');

/**
 * Fulfills a dossier payment once confirmed via Stripe, Local Bank, or Bank Slip
 */
async function fulfillDossierPayment(transaction) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: transaction.dossierId },
    include: {
      applicants: true,
      documents: true,
      user: true,
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

  // 3. Update dossier status to UNDER_REVIEW
  const updatedDossier = await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      paymentStatus: 'PAID',
      status: 'UNDER_REVIEW',
      currentStep: 8,
      archivedZipUrl: zipUrl,
      statusHistory: {
        create: {
          fromStatus: dossier.status,
          toStatus: 'UNDER_REVIEW',
          changedByUserId: dossier.userId,
          notes: `Payment confirmed via ${transaction.paymentProvider} (${transaction.amount} ${transaction.currency}). Dossier queued for consular review.`,
        },
      },
    },
  });

  // 4. B2B Group Agent Commission Settlement
  if (dossier.portalType === 'GROUP_AGENT' || dossier.user.role === 'AGENT_TUR_OPERATOR') {
    try {
      const agentTierRates = {
        BRONZE: 20.0,
        SILVER: 25.0,
        GOLD: 28.0,
        PLATINUM: 32.0,
      };

      const tierRate = agentTierRates[dossier.user.agentTier] || 20.0;
      const applicantCount = Math.max(dossier.applicants.length, 1);
      const totalCommission = tierRate * applicantCount;

      let wallet = await prisma.wallet.findUnique({
        where: { userId: dossier.userId },
      });

      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: dossier.userId,
            balance: 0.0,
            pendingBalance: 0.0,
            currency: 'EUR',
          },
        });
      }

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: wallet.balance + totalCommission },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: totalCommission,
          type: 'CREDIT',
          referenceType: 'COMMISSION',
          referenceId: dossier.id,
          description: `Viza komissiyası (${applicantCount} ərizəçi x €${tierRate} - ${dossier.dossierNumber})`,
          status: 'PAID',
        },
      });
      console.log(`[PAYMENT] Agent ${dossier.userId} credited with €${totalCommission} commission`);
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
 * Creates Stripe PaymentIntent with idempotency protection
 */
async function createPaymentIntent(dossierId, userId, idempotencyKey = null) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  // If idempotencyKey is provided, check if a transaction with it already exists
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

  const generatedIdempotencyKey = idempotencyKey || `tx_idemp_${dossierId}_${Date.now()}`;
  const amountInCents = Math.round(dossier.totalAmount * 100);

  let paymentIntent;
  const isMockStripe = !env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.includes('mock');
  if (isMockStripe) {
    const mockId = `pi_mock_${Date.now()}`;
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
            dossierId: dossier.id,
            dossierNumber: dossier.dossierNumber,
            userId,
          },
        },
        {
          idempotencyKey: generatedIdempotencyKey,
        }
      );
    } catch (err) {
      console.warn('Stripe SDK live error (using sandbox fallback):', err.message);
      const mockId = `pi_mock_${Date.now()}`;
      paymentIntent = {
        id: mockId,
        client_secret: `${mockId}_secret`,
        amount: amountInCents,
      };
    }
  }

  await prisma.transaction.create({
    data: {
      dossierId: dossier.id,
      userId,
      amount: dossier.totalAmount,
      currency: 'EUR',
      paymentProvider: 'STRIPE',
      stripePaymentIntentId: paymentIntent.id,
      idempotencyKey: generatedIdempotencyKey,
      status: 'PENDING',
      metadataJson: { clientSecret: paymentIntent.client_secret },
    },
  });

  await prisma.dossier.update({
    where: { id: dossierId },
    data: { currentStep: 7 },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: dossier.totalAmount,
    currency: 'EUR',
    idempotencyKey: generatedIdempotencyKey,
  };
}

/**
 * Confirms payment success via Stripe PaymentIntent ID
 */
async function confirmPaymentSuccess(paymentIntentId) {
  const transaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!transaction) {
    throw new Error(`Transaction with paymentIntentId ${paymentIntentId} not found`);
  }

  if (transaction.status === 'PAID') {
    // Already confirmed (idempotent webhook replay)
    return prisma.dossier.findUnique({ where: { id: transaction.dossierId } });
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: 'PAID' },
  });

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
    // Development or test sandbox mode fallback
    event = eventBody;
  }

  if (!event || !event.type) {
    throw new Error('Invalid webhook event payload');
  }

  console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`);

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
      console.warn(`[STRIPE WEBHOOK] Payment failed for intent: ${paymentIntent.id}`);
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
      console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
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
 * Submits Bank Wire / Slip Receipt for Manual Reconciliation
 */
async function submitBankPaymentSlip({ dossierId, userId, amount, referenceCode, fileUrl, fileName }) {
  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const receipt = await prisma.bankPaymentReceipt.create({
    data: {
      dossierId,
      userId,
      amount: Number(amount) || dossier.totalAmount,
      currency: 'EUR',
      referenceCode: referenceCode || `REF-EUR-${dossier.dossierNumber}`,
      fileUrl,
      fileName,
      status: 'PENDING',
    },
  });

  await prisma.dossierStatusHistory.create({
    data: {
      dossierId,
      fromStatus: dossier.status,
      toStatus: dossier.status,
      changedByUserId: userId,
      notes: `Bank köçürmə qəbzi yükləndi (${receipt.referenceCode}). Mühasibatlıq təsdiqi gözlənilir.`,
    },
  });

  return receipt;
}

/**
 * Reviews and reconciles Bank Payment Slip by Admin / Finance
 */
async function reviewBankPaymentSlip({ receiptId, adminUserId, action, adminNotes }) {
  const receipt = await prisma.bankPaymentReceipt.findUnique({
    where: { id: receiptId },
    include: { dossier: true },
  });

  if (!receipt) {
    throw new Error('Bank payment receipt not found');
  }

  if (action === 'APPROVE') {
    const updatedReceipt = await prisma.bankPaymentReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'PAID',
        adminNotes,
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
    });

    const tx = await prisma.transaction.create({
      data: {
        dossierId: receipt.dossierId,
        userId: receipt.userId,
        amount: receipt.amount,
        currency: receipt.currency,
        paymentProvider: 'BANK_TRANSFER',
        orderReference: receipt.referenceCode,
        receiptUrl: receipt.fileUrl,
        status: 'PAID',
        metadataJson: { adminNotes, approvedBy: adminUserId },
      },
    });

    await fulfillDossierPayment(tx);
    return updatedReceipt;
  } else {
    return prisma.bankPaymentReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'REFUNDED',
        adminNotes: adminNotes || 'Bank köçürməsi təsdiq edilmədi',
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
    });
  }
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
  reviewBankPaymentSlip,
  createSaaSSubscription,
  fulfillDossierPayment,
};
