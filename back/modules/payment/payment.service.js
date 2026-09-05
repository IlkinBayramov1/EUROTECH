const stripe = require('stripe')(require('../../config/env').STRIPE_SECRET_KEY);
const prisma = require('../../config/db');
const env = require('../../config/env');
const { generateApplicationPdf } = require('../../utils/pdf.util');
const { archiveDossierFiles } = require('../../utils/zip.util');
const notificationService = require('../notification/notification.service');

async function createPaymentIntent(dossierId, userId) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true },
  });

  if (!dossier) {
    throw new Error('Dossier not found');
  }

  const amountInCents = Math.round(dossier.totalAmount * 100);

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'eur',
      metadata: {
        dossierId: dossier.id,
        dossierNumber: dossier.dossierNumber,
        userId,
      },
    });
  } catch (err) {
    const mockId = `pi_mock_${Date.now()}`;
    paymentIntent = {
      id: mockId,
      client_secret: `${mockId}_secret`,
      amount: amountInCents,
    };
  }

  await prisma.transaction.create({
    data: {
      dossierId: dossier.id,
      userId,
      amount: dossier.totalAmount,
      currency: 'EUR',
      paymentProvider: 'STRIPE',
      stripePaymentIntentId: paymentIntent.id,
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
  };
}

async function confirmPaymentSuccess(paymentIntentId) {
  const transaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { dossier: { include: { applicants: true, documents: true, user: true } } },
  });

  if (!transaction || !transaction.dossier) {
    throw new Error('Transaction or Dossier not found');
  }

  const dossier = transaction.dossier;

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: 'PAID' },
  });

  const generatedPdfs = [];
  for (const applicant of dossier.applicants) {
    const pdf = await generateApplicationPdf(dossier, applicant);
    generatedPdfs.push(pdf.filePath);
  }

  const userDocPaths = dossier.documents.map((d) => d.fileUrl.replace('/uploads/', './uploads/'));
  const allFilesToArchive = [...generatedPdfs, ...userDocPaths];

  const archiveResult = await archiveDossierFiles(dossier.dossierNumber, allFilesToArchive);

  const updatedDossier = await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      paymentStatus: 'PAID',
      status: 'UNDER_REVIEW',
      currentStep: 8,
      archivedZipUrl: archiveResult.fileUrl,
      statusHistory: {
        create: {
          fromStatus: dossier.status,
          toStatus: 'UNDER_REVIEW',
          changedByUserId: dossier.userId,
          notes: 'Payment confirmed via Stripe. Dossier submitted to review queue.',
        },
      },
    },
  });

  await notificationService.sendDossierSubmittedNotification(
    dossier.user.email,
    dossier.user.fullName,
    dossier.dossierNumber
  );

  return updatedDossier;
}

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
  createSaaSSubscription,
};
