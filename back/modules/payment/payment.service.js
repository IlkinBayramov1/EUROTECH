const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
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
const promoService = require('../promo/promo.service');

function sanitizePdfText(text) {
  if (!text) return '';
  const charMap = {
    'ə': 'a', 'Ə': 'A',
    'ı': 'i', 'İ': 'I',
    'ş': 's', 'Ş': 'S',
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U',
    '₼': 'AZN ', '€': 'EUR ',
  };
  return String(text)
    .replace(/[əƏıİşŞçÇğĞöÖüÜ₼€]/g, (m) => charMap[m] || m)
    .replace(/[^\x20-\x7E]/g, ' ');
}

/**
 * Generates an official A4 Bank Wire Transfer Receipt Voucher PDF when a receipt was submitted
 * without a physical scan or when the physical file is missing on local storage.
 */
async function generateBankSlipVoucherPdf(receipt) {
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const meta = receipt.metadataJson && typeof receipt.metadataJson === 'object' ? receipt.metadataJson : {};
  const refCode = sanitizePdfText(receipt.referenceCode || receipt.id || 'REF-WIRE');
  const amountStr = `${Number(receipt.amount || 0).toFixed(2)} ${sanitizePdfText(receipt.currency || 'EUR')}`;
  const targetStr = sanitizePdfText(
    receipt.dossier?.dossierNumber
      ? `Dossier ${receipt.dossier.dossierNumber}`
      : receipt.groupBatch?.code
        ? `Group Batch ${receipt.groupBatch.code}`
        : (receipt.purpose || 'WALLET_TOPUP').replace(/_/g, ' ')
  );
  const senderStr = sanitizePdfText(
    meta.senderName || receipt.user?.companyName || receipt.user?.fullName || 'Authorized Payer'
  );
  const emailStr = sanitizePdfText(receipt.user?.email || '—');
  const bankStr = sanitizePdfText(meta.bankName || 'Local / International Wire Transfer');
  const statusStr = sanitizePdfText(
    receipt.status === 'PAID' ? 'APPROVED (RECONCILED)' : receipt.status === 'REFUNDED' ? 'REJECTED' : receipt.status || 'PENDING REVIEW'
  );
  const dateStr = receipt.createdAt
    ? new Date(receipt.createdAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    : new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  // Header Banner
  page.drawRectangle({
    x: 40,
    y: 735,
    width: 515.28,
    height: 68,
    color: rgb(0.06, 0.12, 0.22),
  });

  page.drawText('EUROTECH CONSULAR & FINANCIAL CLEARING HOUSE', {
    x: 56,
    y: 774,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('OFFICIAL BANK WIRE TRANSFER RECEIPT VOUCHER', {
    x: 56,
    y: 752,
    size: 10,
    font: fontReg,
    color: rgb(0.75, 0.85, 0.98),
  });

  // Main Voucher Frame
  page.drawRectangle({
    x: 40,
    y: 350,
    width: 515.28,
    height: 365,
    borderColor: rgb(0.8, 0.84, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  const rows = [
    ['Voucher / Reference Code', refCode],
    ['Transfer Amount & Currency', amountStr],
    ...(meta.promoCode
      ? [
          [
            'Promo Code Applied',
            `${meta.promoCode} (-${Number(meta.discountAmountEur || 0).toFixed(2)} EUR | Gross: ${Number(meta.originalAmountEur || 0).toFixed(2)} EUR)`,
          ],
        ]
      : []),
    ['Payment Purpose / Target', targetStr],
    ['Payer / Sender Name', senderStr],
    ['Account Email', emailStr],
    ['Originating Bank', bankStr],
    ['Submission Timestamp', dateStr],
    ['Clearing Status', statusStr],
  ];

  let yPos = 685;
  const rowStep = rows.length > 8 ? 33 : 38;
  for (const [label, value] of rows) {
    page.drawText(sanitizePdfText(label.toUpperCase()), {
      x: 58,
      y: yPos,
      size: 9,
      font: fontBold,
      color: rgb(0.38, 0.45, 0.55),
    });
    page.drawText(sanitizePdfText(value || '—'), {
      x: 240,
      y: yPos,
      size: 10.5,
      font: fontBold,
      color: rgb(0.06, 0.12, 0.22),
    });
    page.drawLine({
      start: { x: 56, y: yPos - 11 },
      end: { x: 538, y: yPos - 11 },
      thickness: 0.6,
      color: rgb(0.88, 0.91, 0.95),
    });
    yPos -= rowStep;
  }

  if (receipt.adminNotes) {
    page.drawText('TREASURY / OFFICER REMARKS:', {
      x: 58,
      y: yPos - 4,
      size: 9,
      font: fontBold,
      color: rgb(0.38, 0.45, 0.55),
    });
    page.drawText(sanitizePdfText(receipt.adminNotes).substring(0, 95), {
      x: 58,
      y: yPos - 20,
      size: 9.5,
      font: fontReg,
      color: rgb(0.15, 0.2, 0.3),
    });
  }

  page.drawText(
    'This electronic voucher is generated by the EuroTech Financial Ledger for audit and consular verification.',
    {
      x: 42,
      y: 325,
      size: 8.5,
      font: fontReg,
      color: rgb(0.45, 0.5, 0.58),
    }
  );

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const safeRef = String(receipt.referenceCode || receipt.id || 'slip').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `bank_voucher_${safeRef}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    fileName,
    fileUrl: `/uploads/${fileName}`,
    buffer,
    contentType: 'application/pdf',
  };
}

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
 * Supports optional promoCode (blocked on WALLET_TOPUP and WIZARD_5_STEP).
 */
async function createPaymentIntent(input, userId, idempotencyKey = null, userRole = 'INDIVIDUAL') {
  let dossierId = null;
  let groupBatchId = null;
  let invoiceId = null;
  let explicitAmount = null;
  let currency = 'EUR';
  let purpose = 'DOSSIER_PAYMENT';
  let promoCode = null;
  let scope = null;
  let source = null;

  if (typeof input === 'string') {
    dossierId = input;
  } else if (input && typeof input === 'object') {
    dossierId = input.dossierId || null;
    groupBatchId = input.groupBatchId || null;
    invoiceId = input.invoiceId || null;
    explicitAmount = input.amount;
    currency = input.currency || 'EUR';
    purpose = input.purpose || (groupBatchId || invoiceId ? 'GROUP_BATCH_PAYMENT' : 'DOSSIER_PAYMENT');
    promoCode = input.promoCode ? String(input.promoCode).trim() : null;
    scope = input.scope || null;
    source = input.source || null;
    if (input.idempotencyKey && !idempotencyKey) {
      idempotencyKey = input.idempotencyKey;
    }
  }

  if (promoCode && String(source || '').toUpperCase() === 'WIZARD_5_STEP') {
    const err = new Error('Promo codes are not applicable in the 5-step application wizard.');
    err.statusCode = 400;
    throw err;
  }

  if (promoCode && String(purpose || '').toUpperCase().includes('TOPUP')) {
    const err = new Error('Promo codes cannot be applied to wallet top-up deposits.');
    err.statusCode = 400;
    throw err;
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
    const priorDiscount = await promoService.getGroupBatchConfirmedDiscountEur(batch.id, prisma);
    const netDue = Math.max(0, Number((computedBatchTotal - priorDiscount).toFixed(2)));
    targetAmountEur =
      netDue > 0
        ? netDue
        : computedBatchTotal > 0
          ? 0
          : convertToEur(explicitAmount || 145, currency, eurToAznRate);
    if (targetAmountEur <= 0) {
      const err = new Error('This group or invoice is already settled.');
      err.statusCode = 400;
      throw err;
    }
    refTag = batch.code;
  } else if (resolvedDossierId) {
    const dossier = await prisma.dossier.findUnique({
      where: { id: resolvedDossierId },
      include: { applicants: true },
    });
    if (!dossier) {
      throw new Error('Dossier not found');
    }
    const { settledCreditEur } = await walletService.getDossierSettledCreditEur(dossier.id, prisma, eurToAznRate);
    const dueEur = Math.max(0, Number((Number(dossier.totalAmount || 0) - settledCreditEur).toFixed(2)));
    if (dueEur <= 0) {
      const err = new Error('This dossier is already fully paid.');
      err.statusCode = 400;
      throw err;
    }
    targetAmountEur = dueEur;
    refTag = dossier.dossierNumber;

    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { currentStep: Math.max(dossier.currentStep || 1, 5) },
    });
  } else {
    throw new Error('Dossier ID, Group Batch ID, or Wallet Top-Up purpose is required');
  }

  let promoRes = null;
  if (promoCode) {
    // Atomically validate & reserve promo code (or settle immediately if 100% free!)
    const promoOutcome = await prisma.$transaction(async (tx) => {
      const res = await promoService.reserveOrApplyPromoInTx(tx, {
        code: promoCode,
        userId,
        userRole,
        paymentMethod: 'CARD',
        mode: 'RESERVE',
        dossierId: resolvedDossierId,
        groupBatchId: resolvedGroupBatchId,
        invoiceId,
        scope,
        purpose,
        source,
      });

      // Special 100% Free Promo Settlement (Stripe rejects 0.00 / < 0.50 EUR intents)
      if (res.finalAmountEur <= 0) {
        await promoService.confirmReservedRedemptionInTx(tx, { redemptionId: res.redemption.id });
        const freeRef = `PRM-${refTag}-${Date.now().toString().slice(-5)}`;
        const promoMeta = {
          promoCode: res.promo.code,
          redemptionId: res.redemption.id,
          originalAmountEur: res.originalAmountEur,
          discountAmountEur: res.discountAmountEur,
          allowAgentCommission: res.allowAgentCommission,
          consularFeeTotalEur: res.consularFeeTotalEur,
        };

        let settledTx = null;
        if (resolvedGroupBatchId) {
          const s = await walletService.settleGroupBatchInTx(tx, {
            groupBatchId: resolvedGroupBatchId,
            payerUserId: userId,
            paymentProvider: 'PROMO_FULL_COVERAGE',
            referenceCode: freeRef,
            explicitAmountEur: 0,
            promoMeta,
          });
          settledTx = s.transaction;
        } else if (resolvedDossierId) {
          const s = await walletService.settleDossierInTx(tx, {
            dossierId: resolvedDossierId,
            payerUserId: userId,
            paymentProvider: 'PROMO_FULL_COVERAGE',
            referenceCode: freeRef,
            explicitAmountEur: 0,
            promoMeta,
          });
          settledTx = s.transaction;
        }

        if (settledTx?.id) {
          await tx.promoCodeRedemption.update({
            where: { id: res.redemption.id },
            data: { transactionId: settledTx.id },
          });
        }

        return { zeroDueSettled: true, res, settledTx, freeRef };
      }

      if (res.finalAmountEur > 0 && res.finalAmountEur < 0.5) {
        const err = new Error(
          'Online card payments require at least €0.50 remaining after promo discount. Please pay via EuroTech Wallet.'
        );
        err.statusCode = 400;
        throw err;
      }

      return { zeroDueSettled: false, res };
    });

    if (promoOutcome.zeroDueSettled) {
      if (promoOutcome.settledTx?.dossierId && !resolvedGroupBatchId) {
        setImmediate(async () => {
          try {
            await fulfillDossierPayment(promoOutcome.settledTx);
          } catch {}
        });
      }
      return {
        zeroDueSettled: true,
        paymentIntentId: null,
        clientSecret: null,
        amount: 0,
        originalAmountEur: promoOutcome.res.originalAmountEur,
        discountAmountEur: promoOutcome.res.discountAmountEur,
        appliedPromoCode: promoOutcome.res.promo.code,
        currency: 'EUR',
        reference: promoOutcome.freeRef,
      };
    }

    promoRes = promoOutcome.res;
    targetAmountEur = promoRes.finalAmountEur;
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
            promoCode: promoRes ? promoRes.promo.code : '',
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

  const createdTx = await prisma.transaction.create({
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
        ...(promoRes
          ? {
              promoCode: promoRes.promo.code,
              promoRedemptionId: promoRes.redemption.id,
              originalAmountEur: promoRes.originalAmountEur,
              discountAmountEur: promoRes.discountAmountEur,
              allowAgentCommission: promoRes.allowAgentCommission,
              consularFeeTotalEur: promoRes.consularFeeTotalEur,
            }
          : {}),
      },
    },
  });

  if (promoRes) {
    await prisma.promoCodeRedemption.update({
      where: { id: promoRes.redemption.id },
      data: { transactionId: createdTx.id },
    });
  }

  return {
    zeroDueSettled: false,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: targetAmountEur,
    originalAmountEur: promoRes ? promoRes.originalAmountEur : targetAmountEur,
    discountAmountEur: promoRes ? promoRes.discountAmountEur : 0,
    appliedPromoCode: promoRes ? promoRes.promo.code : null,
    currency: 'EUR',
    idempotencyKey: generatedIdempotencyKey,
  };
}

/**
 * Confirms payment success via Stripe PaymentIntent ID (Dossier, GroupBatch, or Wallet Top-Up)
 * Atomically transitions PENDING -> PAID and confirms any RESERVED promo code redemption.
 */
async function confirmPaymentSuccess(paymentIntentId) {
  const existingTx = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!existingTx) {
    throw new Error(`Transaction with paymentIntentId ${paymentIntentId} not found`);
  }

  if (existingTx.status === 'PAID') {
    if (existingTx.dossierId) {
      return prisma.dossier.findUnique({ where: { id: existingTx.dossierId } });
    }
    return { alreadyConfirmed: true, transaction: existingTx };
  }

  const meta = existingTx.metadataJson && typeof existingTx.metadataJson === 'object' ? existingTx.metadataJson : {};

  // Case 1: Wallet Top-Up via Card
  if (String(meta.purpose || '').toUpperCase() === 'WALLET_TOPUP') {
    const result = await prisma.$transaction(async (tx) => {
      const guarded = await tx.transaction.updateMany({
        where: { id: existingTx.id, status: 'PENDING' },
        data: { status: 'PAID' },
      });
      if (guarded.count === 0) return { alreadyConfirmed: true };

      const wallet = await walletService.getOrCreateWallet(existingTx.userId, tx);
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: Number(existingTx.amount),
          type: 'CREDIT',
          referenceType: 'TOPUP',
          referenceId: paymentIntentId,
          description: `Wallet Top-Up via Online Card (€${Number(existingTx.amount).toFixed(2)})`,
          status: 'PAID',
        },
      });
      await walletService.recalculateWalletBalances(wallet.id, tx);
      return { purpose: 'WALLET_TOPUP', creditedEur: existingTx.amount };
    });
    return result;
  }

  // Case 2: GroupBatch / Corporate Invoice Card Settlement
  if (meta.groupBatchId) {
    const settlement = await prisma.$transaction(async (tx) => {
      const guarded = await tx.transaction.updateMany({
        where: { id: existingTx.id, status: 'PENDING' },
        data: { status: 'PAID' },
      });
      if (guarded.count === 0) return { alreadyConfirmed: true };

      let promoMeta = null;
      if (meta.promoRedemptionId || meta.promoCode) {
        const confirmed = await promoService.confirmReservedRedemptionInTx(tx, {
          redemptionId: meta.promoRedemptionId || null,
          transactionId: existingTx.id,
        });
        if (confirmed) {
          promoMeta = {
            promoCode: confirmed.promoCodeSnapshot,
            redemptionId: confirmed.id,
            originalAmountEur: confirmed.originalAmountEur,
            discountAmountEur: confirmed.discountAmountEur,
            allowAgentCommission: confirmed.allowAgentCommission ?? meta.allowAgentCommission ?? true,
            consularFeeTotalEur: meta.consularFeeTotalEur ?? confirmed.metadataJson?.consularFeeTotalEur,
          };
        }
      }

      return walletService.settleGroupBatchInTx(tx, {
        groupBatchId: meta.groupBatchId,
        payerUserId: existingTx.userId,
        paymentProvider: 'STRIPE',
        referenceCode: paymentIntentId,
        explicitAmountEur: Number(existingTx.amount),
        existingTransactionId: existingTx.id,
        promoMeta,
      });
    });
    if (existingTx.dossierId) {
      return prisma.dossier.findUnique({ where: { id: existingTx.dossierId } });
    }
    return settlement;
  }

  // Case 3: Individual Dossier Settlement
  const txOutcome = await prisma.$transaction(async (tx) => {
    const guarded = await tx.transaction.updateMany({
      where: { id: existingTx.id, status: 'PENDING' },
      data: { status: 'PAID' },
    });
    if (guarded.count === 0) return { alreadyConfirmed: true };

    if (meta.promoRedemptionId || meta.promoCode) {
      await promoService.confirmReservedRedemptionInTx(tx, {
        redemptionId: meta.promoRedemptionId || null,
        transactionId: existingTx.id,
      });
    }
    return { alreadyConfirmed: false };
  });

  if (txOutcome.alreadyConfirmed) {
    return existingTx.dossierId ? prisma.dossier.findUnique({ where: { id: existingTx.dossierId } }) : { alreadyConfirmed: true };
  }

  const paidTx = await prisma.transaction.findUnique({ where: { id: existingTx.id } });
  return fulfillDossierPayment(paidTx);
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
      const failedTx = await prisma.transaction.findFirst({
        where: { stripePaymentIntentId: paymentIntent.id },
      });
      if (failedTx) {
        await prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: failedTx.id },
            data: { status: 'PENDING' },
          });
          await promoService.releaseReservedRedemptionInTx(tx, {
            transactionId: failedTx.id,
            reason: 'Stripe payment intent failed',
          });
        });
      }
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      const piId = charge.payment_intent;
      if (piId) {
        const refundedTx = await prisma.transaction.findFirst({ where: { stripePaymentIntentId: piId } });
        if (refundedTx) {
          await prisma.$transaction(async (tx) => {
            await tx.transaction.update({ where: { id: refundedTx.id }, data: { status: 'REFUNDED' } });
            if (refundedTx.dossierId) {
              await tx.dossier.update({ where: { id: refundedTx.dossierId }, data: { paymentStatus: 'REFUNDED' } });
            }
            await promoService.refundAppliedRedemptionInTx(tx, {
              transactionId: refundedTx.id,
              reason: 'Stripe charge refunded',
            });
          });
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
 * Supports optional promoCode (RESERVED until Admin approves or rejects the slip).
 */
async function submitBankPaymentSlip({
  dossierId,
  groupBatchId,
  invoiceId,
  userId,
  userRole = 'INDIVIDUAL',
  amount,
  currency,
  referenceCode,
  fileUrl,
  fileName,
  bankName,
  depositDate,
  senderName,
  purpose,
  promoCode = null,
  scope = null,
  source = null,
}) {
  const cleanPromoCode = promoCode ? String(promoCode).trim() : null;
  if (cleanPromoCode && String(source || '').toUpperCase() === 'WIZARD_5_STEP') {
    const err = new Error('Promo codes are not applicable in the 5-step application wizard.');
    err.statusCode = 400;
    throw err;
  }

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

  const isTopup = String(resolvedPurpose).toUpperCase().includes('TOPUP') || (!dossierId && !resolvedGroupBatchId && !invoiceId);
  if (cleanPromoCode && isTopup) {
    const err = new Error('Promo codes cannot be applied to wallet top-up deposits.');
    err.statusCode = 400;
    throw err;
  }

  const resolvedRefCode = referenceCode || `REF-EUR-${Date.now()}`;
  const resolvedCurrency = currency || 'EUR';

  const { receipt, promoRes } = await prisma.$transaction(async (tx) => {
    let pRes = null;
    if (cleanPromoCode) {
      pRes = await promoService.reserveOrApplyPromoInTx(tx, {
        code: cleanPromoCode,
        userId,
        userRole,
        paymentMethod: 'BANK_SLIP',
        mode: 'RESERVE',
        dossierId: dossierId || null,
        groupBatchId: resolvedGroupBatchId,
        invoiceId: invoiceId || null,
        scope: scope || null,
        purpose: resolvedPurpose,
        source,
      });
    }

    const eurToAznRate = await walletService.getEurToAznRate(tx);
    let resolvedAmount = Number(amount);
    if (!resolvedAmount || isNaN(resolvedAmount) || resolvedAmount <= 0) {
      if (pRes) {
        resolvedAmount =
          String(resolvedCurrency).toUpperCase() === 'AZN'
            ? Number((pRes.finalAmountEur * eurToAznRate).toFixed(2))
            : pRes.finalAmountEur;
      } else {
        resolvedAmount = dossier ? Number(dossier.totalAmount || 0) : 0;
      }
    }

    const metadataJson = {
      bankName: bankName || null,
      depositDate: depositDate ? new Date(depositDate).toISOString() : null,
      senderName: senderName || null,
      invoiceId: invoiceId || null,
      ...(pRes
        ? {
            promoCode: pRes.promo.code,
            promoRedemptionId: pRes.redemption.id,
            originalAmountEur: pRes.originalAmountEur,
            discountAmountEur: pRes.discountAmountEur,
            expectedNetAmountEur: pRes.finalAmountEur,
            allowAgentCommission: pRes.allowAgentCommission,
            consularFeeTotalEur: pRes.consularFeeTotalEur,
          }
        : {}),
    };

    let finalFileUrl = fileUrl;
    let finalFileName = fileName;

    if (!finalFileUrl || finalFileUrl.includes('bank-slip-placeholder')) {
      try {
        const voucher = await generateBankSlipVoucherPdf({
          referenceCode: resolvedRefCode,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          purpose: resolvedPurpose,
          status: 'PENDING',
          createdAt: new Date(),
          metadataJson,
          dossier,
        });
        finalFileUrl = voucher.fileUrl;
        finalFileName = voucher.fileName;
      } catch (err) {
        finalFileUrl = '/uploads/bank-slip-placeholder.pdf';
        finalFileName = 'bank-slip.pdf';
      }
    }

    const createdReceipt = await tx.bankPaymentReceipt.create({
      data: {
        dossierId: dossierId || null,
        groupBatchId: resolvedGroupBatchId,
        userId,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        referenceCode: resolvedRefCode,
        fileUrl: finalFileUrl,
        fileName: finalFileName || 'bank-slip.pdf',
        purpose: resolvedPurpose,
        metadataJson,
        status: 'PENDING',
      },
    });

    if (pRes) {
      await tx.promoCodeRedemption.update({
        where: { id: pRes.redemption.id },
        data: { bankPaymentReceiptId: createdReceipt.id },
      });
    }

    if (dossierId && dossier) {
      const promoNote = pRes ? ` (Promo ${pRes.promo.code}: -€${pRes.discountAmountEur.toFixed(2)})` : '';
      await tx.dossierStatusHistory.create({
        data: {
          dossierId,
          fromStatus: dossier.status,
          toStatus: dossier.status,
          changedByUserId: userId,
          notes: `Bank köçürmə qəbzi yükləndi (${createdReceipt.referenceCode})${promoNote}. Mühasibatlıq təsdiqi gözlənilir.`,
        },
      });
    }

    return { receipt: createdReceipt, promoRes: pRes };
  });

  return {
    ...receipt,
    promoApplied: promoRes
      ? {
          code: promoRes.promo.code,
          originalAmountEur: promoRes.originalAmountEur,
          discountAmountEur: promoRes.discountAmountEur,
          finalAmountEur: promoRes.finalAmountEur,
        }
      : null,
  };
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
      promoRedemptions: {
        select: {
          id: true,
          promoCodeSnapshot: true,
          originalAmountEur: true,
          discountAmountEur: true,
          finalAmountEur: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Unified Admin / Finance Reconciliation of Bank Payment Slips:
 * Supports WALLET_TOPUP, GROUP_BATCH_PAYMENT (Agent & Corporate), and DOSSIER_PAYMENT (Individual)
 * Atomically transitions RESERVED promo code redemptions to APPLIED on Approve or RELEASED on Reject.
 */
async function reviewBankPaymentSlip({ receiptId, adminUserId, action, adminNotes }) {
  const normalizedAction = String(action || '').toUpperCase();
  const isApproved = ['APPROVE', 'APPROVED', 'PAID'].includes(normalizedAction);

  let dossierTxForArchive = null;

  const updatedReceipt = await prisma.$transaction(async (tx) => {
    const receipt = await tx.bankPaymentReceipt.findUnique({
      where: { id: receiptId },
      include: { dossier: true, groupBatch: true },
    });

    if (!receipt) {
      const err = new Error('Bank payment receipt not found');
      err.statusCode = 404;
      throw err;
    }

    if (isApproved && receipt.status === 'PAID') {
      const err = new Error('This bank payment slip has already been approved and reconciled.');
      err.statusCode = 400;
      throw err;
    }

    if (!isApproved && receipt.status === 'PAID') {
      const err = new Error('This bank payment slip has already been approved and settled. It cannot be rejected.');
      err.statusCode = 400;
      throw err;
    }

    if (!isApproved && receipt.status === 'REFUNDED') {
      const err = new Error('This bank payment slip has already been rejected.');
      err.statusCode = 400;
      throw err;
    }

    // Atomic conditional update to prevent concurrent double-approval race conditions
    const guarded = await tx.bankPaymentReceipt.updateMany({
      where: { id: receiptId, status: 'PENDING' },
      data: {
        status: isApproved ? 'PAID' : 'REFUNDED',
        adminNotes: adminNotes || (isApproved ? 'Verified and approved by Finance' : 'Bank transfer rejected'),
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
    });

    if (guarded.count === 0) {
      const err = new Error('This bank payment slip has already been reviewed by another officer.');
      err.statusCode = 400;
      throw err;
    }

    const updated = await tx.bankPaymentReceipt.findUnique({ where: { id: receiptId } });

    const eurToAznRate = await walletService.getEurToAznRate(tx);
    const amountEur = convertToEur(receipt.amount, receipt.currency || 'EUR', eurToAznRate);
    const purposeUpper = String(receipt.purpose || '').toUpperCase();
    const isWalletTopup = purposeUpper.includes('TOPUP') || (!receipt.dossierId && !receipt.groupBatchId);
    const meta = receipt.metadataJson && typeof receipt.metadataJson === 'object' ? receipt.metadataJson : {};

    if (isApproved) {
      // Confirm any RESERVED promo code redemption linked to this bank slip
      let confirmedRedemption = null;
      if (!isWalletTopup) {
        confirmedRedemption = await promoService.confirmReservedRedemptionInTx(tx, {
          bankPaymentReceiptId: receipt.id,
          redemptionId: meta.promoRedemptionId || null,
        });
      }

      const promoMeta = confirmedRedemption
        ? {
            promoCode: confirmedRedemption.promoCodeSnapshot,
            redemptionId: confirmedRedemption.id,
            originalAmountEur: confirmedRedemption.originalAmountEur,
            discountAmountEur: confirmedRedemption.discountAmountEur,
            allowAgentCommission: confirmedRedemption.allowAgentCommission ?? meta.allowAgentCommission ?? true,
            consularFeeTotalEur: meta.consularFeeTotalEur ?? confirmedRedemption.metadataJson?.consularFeeTotalEur,
          }
        : null;

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
        const settlement = await walletService.settleGroupBatchInTx(tx, {
          groupBatchId: receipt.groupBatchId,
          payerUserId: receipt.userId,
          paymentProvider: 'BANK_TRANSFER',
          referenceCode: receipt.referenceCode,
          receiptUrl: receipt.fileUrl,
          explicitAmountEur: amountEur,
          promoMeta,
        });
        if (confirmedRedemption && settlement.transaction?.id) {
          await tx.promoCodeRedemption.update({
            where: { id: confirmedRedemption.id },
            data: { transactionId: settlement.transaction.id },
          });
        }
      } else if (receipt.dossierId) {
        const settled = await walletService.settleDossierInTx(tx, {
          dossierId: receipt.dossierId,
          payerUserId: receipt.userId,
          paymentProvider: 'BANK_TRANSFER',
          referenceCode: receipt.referenceCode,
          receiptUrl: receipt.fileUrl,
          explicitAmountEur: amountEur,
          promoMeta,
        });
        dossierTxForArchive = settled.transaction;
        if (confirmedRedemption && settled.transaction?.id) {
          await tx.promoCodeRedemption.update({
            where: { id: confirmedRedemption.id },
            data: { transactionId: settled.transaction.id },
          });
        }
      }
    } else {
      // REJECTED: Release any RESERVED promo code redemption so the user's quota is restored
      await promoService.releaseReservedRedemptionInTx(tx, {
        bankPaymentReceiptId: receipt.id,
        redemptionId: meta.promoRedemptionId || null,
        reason: adminNotes || 'Bank payment slip rejected by Finance',
      });

      if (receipt.dossierId) {
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
    }

    try {
      await tx.auditLog.create({
        data: {
          userId: adminUserId || null,
          action: 'BANK_SLIP_REVIEWED',
          details: {
            receiptId: receipt.id,
            purpose: receipt.purpose,
            dossierId: receipt.dossierId,
            groupBatchId: receipt.groupBatchId,
            amountEur,
            promoCode: meta.promoCode || null,
            discountAmountEur: meta.discountAmountEur || 0,
            status: isApproved ? 'APPROVED' : 'REJECTED',
            decision: isApproved ? 'APPROVED' : 'REJECTED',
            notes: adminNotes || null,
          },
        },
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for bank slip review:', auditErr.message);
    }

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
 * Resolves the physical receipt file for a BankPaymentReceipt or dynamically generates
 * an Official Bank Wire Transfer Receipt Voucher PDF if the file was submitted without an attachment
 * or is missing on local storage.
 */
async function getBankSlipFile(receiptId) {
  const receipt = await prisma.bankPaymentReceipt.findUnique({
    where: { id: receiptId },
    include: {
      user: { select: { id: true, fullName: true, email: true, companyName: true, role: true } },
      dossier: { select: { id: true, dossierNumber: true, totalAmount: true, status: true } },
      groupBatch: { select: { id: true, code: true, name: true, status: true } },
    },
  });

  if (!receipt) {
    const err = new Error('Bank payment receipt not found');
    err.statusCode = 404;
    throw err;
  }

  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const rawUrl = String(receipt.fileUrl || '');
  const baseName = rawUrl ? path.basename(rawUrl) : '';
  const diskPath = baseName ? path.join(uploadDir, baseName) : '';
  const isPlaceholder =
    !baseName ||
    baseName === 'bank-slip-placeholder.pdf' ||
    baseName === 'bank-slip.pdf';

  if (diskPath && !isPlaceholder && fs.existsSync(diskPath)) {
    const stat = fs.statSync(diskPath);
    const ext = (receipt.fileName || baseName).split('.').pop()?.toLowerCase();
    const isImage = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
    // Use existing physical file if it is an image or a real PDF (> 450 bytes)
    if (isImage || stat.size > 450) {
      const contentType =
        ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/pdf';
      const buffer = fs.readFileSync(diskPath);
      return {
        filePath: diskPath,
        fileName: receipt.fileName || baseName,
        buffer,
        contentType,
      };
    }
  }

  // Generate an official Bank Wire Transfer Voucher PDF with the receipt's full ledger details
  return generateBankSlipVoucherPdf(receipt);
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
  getBankSlipFile,
  generateBankSlipVoucherPdf,
  createSaaSSubscription,
  fulfillDossierPayment,
};
