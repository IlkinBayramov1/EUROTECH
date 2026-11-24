const prisma = require('../../config/db');
const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn, convertToEur } = require('../../config/constants');
const { calculatePortalFees } = require('../../utils/finance.util');
const { getPricingCatalog } = require('../service/pricingConfig.service');

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR'];
const VALID_PORTALS = ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'];
const VALID_SCOPES = ['ALL', 'DOSSIER_PAYMENT', 'GROUP_BATCH_PAYMENT', 'ADDITIONAL_SERVICES'];
const VALID_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_EUR'];
const VALID_APPLY_TARGETS = ['TOTAL_AMOUNT', 'SERVICE_AND_EXTRAS_ONLY'];

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeCode(raw) {
  const cleaned = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) {
    throw httpError(400, 'Promo code is required.');
  }
  if (!/^[A-Z0-9_-]{3,32}$/.test(cleaned)) {
    throw httpError(400, 'Promo code must be 3 to 32 characters (letters, numbers, hyphens, or underscores).');
  }
  return cleaned;
}

function resolveUserPortalType(userRole, fallback = 'INDIVIDUAL') {
  const r = String(userRole || '').toUpperCase();
  if (r === 'AGENT_TUR_OPERATOR' || r === 'AGENT') return 'GROUP_AGENT';
  if (r === 'CORPORATE_HR' || r === 'CORPORATE') return 'CORPORATE';
  if (r === 'INDIVIDUAL') return 'INDIVIDUAL';
  return fallback || 'INDIVIDUAL';
}

function computeDisplayStatus(promo, now = new Date()) {
  if (!promo) return 'INACTIVE';
  if (promo.status === 'ARCHIVED') return 'ARCHIVED';
  if (promo.status === 'INACTIVE') return 'INACTIVE';
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return 'EXPIRED';
  if (promo.startsAt && new Date(promo.startsAt) > now) return 'SCHEDULED';
  if (promo.maxUses !== null && promo.maxUses !== undefined && Number(promo.currentUses || 0) >= Number(promo.maxUses)) {
    return 'EXHAUSTED';
  }
  return 'ACTIVE';
}

async function getEurToAznRate(tx = prisma) {
  try {
    const setting = await tx.systemSetting.findUnique({ where: { key: 'EUR_TO_AZN_RATE' } });
    return Number(setting?.value || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
  } catch {
    return DEFAULT_EUR_TO_AZN_RATE || 1.85;
  }
}

async function getDossierConfirmedDiscountEur(dossierId, tx = prisma) {
  if (!dossierId) return 0.0;
  const agg = await tx.promoCodeRedemption.aggregate({
    _sum: { discountAmountEur: true },
    where: { dossierId, status: 'APPLIED' },
  });
  return Number(Number(agg._sum?.discountAmountEur || 0).toFixed(2));
}

async function getGroupBatchConfirmedDiscountEur(groupBatchId, tx = prisma) {
  if (!groupBatchId) return 0.0;
  const agg = await tx.promoCodeRedemption.aggregate({
    _sum: { discountAmountEur: true },
    where: { groupBatchId, status: 'APPLIED' },
  });
  return Number(Number(agg._sum?.discountAmountEur || 0).toFixed(2));
}

async function computeDossierNetPaidEurLocal(dossierId, tx = prisma, eurToAznRate = DEFAULT_EUR_TO_AZN_RATE) {
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

function computeConsularFeeForDossier(dossier) {
  const pax = Math.max(1, (dossier.applicants || []).length);
  const rawGov = Number(dossier.governmentFee || 0);
  // Corporate batches created via corporateBatch.service store total governmentFee (* batchSize)
  if (dossier.portalType === 'CORPORATE' && pax > 1 && rawGov >= 80 * pax - 1) {
    return Number(rawGov.toFixed(2));
  }
  return Number((rawGov * pax).toFixed(2));
}

/**
 * Authoritatively resolves order subtotal, eligible service-fee base, portal, country, and scope from DB.
 * Never trusts client-provided prices or totals.
 */
async function resolveTargetContext(
  tx,
  {
    userId,
    userRole,
    dossierId = null,
    groupBatchId = null,
    invoiceId = null,
    scope = null,
    purpose = null,
    cartItems = null,
    eurToAznRate = null,
  }
) {
  const purposeUpper = String(purpose || scope || '').toUpperCase();
  if (purposeUpper.includes('TOPUP')) {
    throw httpError(400, 'Promo codes cannot be applied to wallet top-up deposits.');
  }

  const rate = eurToAznRate || (await getEurToAznRate(tx));
  const isStaff = STAFF_ROLES.includes(String(userRole || '').toUpperCase());

  let resolvedGroupBatchId = groupBatchId || null;
  let resolvedInvoiceId = invoiceId || null;
  let targetInvoice = null;

  if (invoiceId) {
    targetInvoice = await tx.corporateInvoice.findUnique({ where: { id: invoiceId } });
    if (!targetInvoice) {
      throw httpError(404, 'Corporate invoice not found.');
    }
    if (!isStaff && targetInvoice.corporateUserId !== userId) {
      throw httpError(403, 'Access denied to this corporate invoice.');
    }
    if (targetInvoice.status === 'PAID') {
      throw httpError(400, 'This invoice is already paid.');
    }
    resolvedGroupBatchId = targetInvoice.groupBatchId || resolvedGroupBatchId;
  }

  // Branch 1: Group Batch or Corporate Invoice
  if (resolvedGroupBatchId || targetInvoice) {
    let batch = null;
    if (resolvedGroupBatchId) {
      batch = await tx.groupBatch.findUnique({
        where: { id: resolvedGroupBatchId },
        include: {
          dossiers: { include: { applicants: true, country: true } },
          invoices: true,
        },
      });
      if (!batch) {
        throw httpError(404, 'Group or corporate batch not found.');
      }
      if (!isStaff && batch.userId !== userId) {
        throw httpError(403, 'Access denied to this group or batch.');
      }
    }

    const inv = targetInvoice || batch?.invoices?.find((i) => i.status !== 'PAID') || null;
    if (inv && !resolvedInvoiceId) {
      resolvedInvoiceId = inv.id;
    }

    const dossiers = batch?.dossiers || [];
    const totalAppsCount = dossiers.reduce((sum, d) => sum + (d.applicants ? d.applicants.length : 0), 0);

    let grossEur = inv
      ? Number(Number(inv.amount || 0).toFixed(2))
      : Number(dossiers.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0).toFixed(2));

    if (grossEur <= 0 && batch) {
      const catalog = await getPricingCatalog(tx);
      const dynamicFees = calculatePortalFees({
        portalType: batch.portalType || 'GROUP_AGENT',
        paxCount: Math.max(1, totalAppsCount),
        activePackage: batch.packageTier || 'standard',
        duration: batch.duration || 'short',
        catalog,
      });
      grossEur = Number(dynamicFees.grandTotalEur || 0);
    }

    const alreadyDiscountedEur = batch ? await getGroupBatchConfirmedDiscountEur(batch.id, tx) : 0.0;
    const originalAmountEur = Math.max(0, Number((grossEur - alreadyDiscountedEur).toFixed(2)));
    if (originalAmountEur <= 0) {
      throw httpError(400, 'No unpaid balance remains for this group or invoice.');
    }

    let consularFeeTotalEur = dossiers.reduce((sum, d) => sum + computeConsularFeeForDossier(d), 0);
    consularFeeTotalEur = Math.min(originalAmountEur, Number(consularFeeTotalEur.toFixed(2)));
    const serviceAndExtrasEligibleEur = Math.max(0, Number((originalAmountEur - consularFeeTotalEur).toFixed(2)));

    let countryId = dossiers[0]?.countryId || null;
    if (!countryId && batch?.destination) {
      const dest = String(batch.destination).trim();
      const matchedCountry = await tx.country.findFirst({
        where: {
          OR: [
            { code: dest.toUpperCase() },
            { nameEn: { equals: dest } },
            { nameAz: { equals: dest } },
            { nameEn: { contains: dest } },
          ],
        },
        select: { id: true },
      });
      countryId = matchedCountry?.id || null;
    }

    const portalType = batch?.portalType || (targetInvoice ? 'CORPORATE' : resolveUserPortalType(userRole));
    return {
      portalType,
      effectiveScope: 'GROUP_BATCH_PAYMENT',
      countryId,
      resolvedDossierId: dossiers[0]?.id || dossierId || null,
      resolvedGroupBatchId: batch?.id || null,
      resolvedInvoiceId,
      originalAmountEur,
      consularFeeTotalEur,
      serviceAndExtrasEligibleEur,
      existingDueEur: originalAmountEur,
      pendingCartEur: 0,
      eurToAznRate: rate,
    };
  }

  // Branch 2: Individual Dossier (including Additional Services checkout)
  if (dossierId) {
    const dossier = await tx.dossier.findUnique({
      where: { id: dossierId },
      include: {
        applicants: true,
        services: { where: { status: 'ACTIVE' } },
        country: true,
      },
    });

    if (!dossier) {
      throw httpError(404, 'Dossier not found.');
    }
    if (!isStaff && dossier.userId !== userId) {
      throw httpError(403, 'Access denied to this dossier.');
    }

    // If dossier belongs to a B2B group/batch, delegate context resolution to groupBatch
    if (dossier.groupBatchId && dossier.portalType !== 'INDIVIDUAL' && scope !== 'ADDITIONAL_SERVICES') {
      return resolveTargetContext(tx, {
        userId,
        userRole,
        groupBatchId: dossier.groupBatchId,
        invoiceId,
        scope,
        purpose,
        eurToAznRate: rate,
      });
    }

    const netPaidEur = await computeDossierNetPaidEurLocal(dossier.id, tx, rate);
    const confirmedDiscountEur = await getDossierConfirmedDiscountEur(dossier.id, tx);
    const settledCreditEur = Number((netPaidEur + confirmedDiscountEur).toFixed(2));
    const existingDueEur = Math.max(0, Number((Number(dossier.totalAmount || 0) - settledCreditEur).toFixed(2)));

    // Optional dry-run cart preview for ClientServices before /services/checkout runs
    let pendingCartEur = 0.0;
    if (Array.isArray(cartItems) && cartItems.length > 0) {
      const catalog = await getPricingCatalog(tx);
      const priceMap = {};
      for (const s of catalog.services || []) {
        if (s && s.id) priceMap[String(s.id).toUpperCase()] = Number(s.priceEur ?? s.price ?? 0);
      }
      const { SERVICE_PRICES } = require('../../config/constants');
      const seenKeys = new Set();
      for (const item of cartItems) {
        const svcType = String(item.serviceType || item.serviceId || '').trim().toUpperCase();
        if (!svcType) continue;
        const appId = item.applicantId && item.applicantId !== 'primary-applicant' ? item.applicantId : null;
        const dedupeKey = `${svcType}::${appId || 'ALL'}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const alreadyActive = (dossier.services || []).some(
          (s) => String(s.serviceType).toUpperCase() === svcType && (s.applicantId || null) === appId
        );
        if (alreadyActive) continue;

        const price = priceMap[svcType] ?? SERVICE_PRICES[svcType] ?? 30.0;
        pendingCartEur += Number(price);
      }
      pendingCartEur = Number(pendingCartEur.toFixed(2));
    }

    const originalAmountEur = Number((existingDueEur + pendingCartEur).toFixed(2));
    if (originalAmountEur <= 0) {
      throw httpError(400, 'No payable balance remains for this dossier.');
    }

    const totalGovFee = computeConsularFeeForDossier(dossier);
    const unpaidGovPortion = Math.max(0, Number((totalGovFee - settledCreditEur).toFixed(2)));
    const consularFeeTotalEur = Math.min(originalAmountEur, unpaidGovPortion);
    const serviceAndExtrasEligibleEur = Math.max(0, Number((originalAmountEur - consularFeeTotalEur).toFixed(2)));

    const isAdditionalServices =
      String(scope || '').toUpperCase() === 'ADDITIONAL_SERVICES' ||
      purposeUpper.includes('VALUE-ADDED') ||
      purposeUpper.includes('ADDITIONAL_SERVICES') ||
      (Array.isArray(cartItems) && cartItems.length > 0);

    return {
      portalType: dossier.portalType || resolveUserPortalType(userRole),
      effectiveScope: isAdditionalServices ? 'ADDITIONAL_SERVICES' : 'DOSSIER_PAYMENT',
      countryId: dossier.countryId || null,
      resolvedDossierId: dossier.id,
      resolvedGroupBatchId: dossier.groupBatchId || null,
      resolvedInvoiceId: null,
      originalAmountEur,
      consularFeeTotalEur,
      serviceAndExtrasEligibleEur,
      existingDueEur,
      pendingCartEur,
      eurToAznRate: rate,
    };
  }

  throw httpError(400, 'A dossierId, groupBatchId, or invoiceId is required to validate a promo code.');
}

function calculatePromoAmounts(promo, context) {
  const originalAmountEur = Number(Number(context.originalAmountEur || 0).toFixed(2));
  const eligibleAmountEur =
    promo.applyTarget === 'SERVICE_AND_EXTRAS_ONLY'
      ? Number(Number(context.serviceAndExtrasEligibleEur || 0).toFixed(2))
      : originalAmountEur;

  if (eligibleAmountEur <= 0) {
    throw httpError(
      400,
      'This promo code applies only to service and add-on fees. No eligible service fee balance remains.'
    );
  }

  let discountAmountEur = 0.0;
  if (promo.discountType === 'PERCENTAGE') {
    const pct = Math.min(100, Math.max(0, Number(promo.discountValue || 0)));
    let raw = (eligibleAmountEur * pct) / 100;
    if (promo.maxDiscountEur !== null && promo.maxDiscountEur !== undefined && Number(promo.maxDiscountEur) > 0) {
      raw = Math.min(raw, Number(promo.maxDiscountEur));
    }
    discountAmountEur = Math.min(eligibleAmountEur, Number(raw.toFixed(2)));
  } else {
    const fixed = Math.max(0, Number(promo.discountValue || 0));
    discountAmountEur = Math.min(eligibleAmountEur, Number(fixed.toFixed(2)));
  }

  discountAmountEur = Math.max(0, Number(discountAmountEur.toFixed(2)));
  const finalAmountEur = Math.max(0, Number((originalAmountEur - discountAmountEur).toFixed(2)));

  return {
    originalAmountEur,
    eligibleAmountEur,
    discountAmountEur,
    finalAmountEur,
  };
}

async function assertPromoEligibility(tx, promo, context, userId) {
  if (!promo) {
    throw httpError(404, 'Invalid promo code. Please verify the code and try again.');
  }
  if (promo.status === 'ARCHIVED' || promo.status === 'INACTIVE') {
    throw httpError(400, 'This promo code is currently inactive.');
  }

  const now = new Date();
  if (promo.startsAt && new Date(promo.startsAt) > now) {
    throw httpError(400, 'This promo code is not active yet.');
  }
  if (promo.expiresAt && new Date(promo.expiresAt) < now) {
    throw httpError(400, 'This promo code has expired.');
  }

  // Portal check
  if (Array.isArray(promo.allowedPortalsJson) && promo.allowedPortalsJson.length > 0) {
    const allowed = promo.allowedPortalsJson.map((p) => String(p).toUpperCase());
    if (!allowed.includes(String(context.portalType).toUpperCase())) {
      throw httpError(400, 'This promo code is not valid for your portal account type.');
    }
  }

  // Scope check
  if (promo.applicableScope && promo.applicableScope !== 'ALL') {
    if (promo.applicableScope !== context.effectiveScope) {
      const scopeLabels = {
        DOSSIER_PAYMENT: 'individual visa dossier payments',
        GROUP_BATCH_PAYMENT: 'group and corporate batch invoices',
        ADDITIONAL_SERVICES: 'value-added services checkouts',
      };
      throw httpError(
        400,
        `This promo code is only valid for ${scopeLabels[promo.applicableScope] || promo.applicableScope}.`
      );
    }
  }

  // Country restriction check
  if (promo.countryId && context.countryId && promo.countryId !== context.countryId) {
    throw httpError(400, 'This promo code is not valid for the selected destination country.');
  }
  if (promo.countryId && !context.countryId) {
    throw httpError(400, 'This promo code is restricted to a specific destination country.');
  }

  // Min order check
  if (
    promo.minOrderAmountEur !== null &&
    promo.minOrderAmountEur !== undefined &&
    Number(promo.minOrderAmountEur) > 0 &&
    context.originalAmountEur + 0.001 < Number(promo.minOrderAmountEur)
  ) {
    throw httpError(
      400,
      `Minimum order amount of €${Number(promo.minOrderAmountEur).toFixed(2)} is required to use this promo code.`
    );
  }

  // Global max uses check
  if (promo.maxUses !== null && promo.maxUses !== undefined && Number(promo.currentUses || 0) >= Number(promo.maxUses)) {
    throw httpError(400, 'This promo code has reached its maximum usage limit.');
  }

  // Per-user usage limit check
  if (promo.maxUsesPerUser !== null && promo.maxUsesPerUser !== undefined && Number(promo.maxUsesPerUser) > 0) {
    const userUsedCount = await tx.promoCodeRedemption.count({
      where: {
        promoCodeId: promo.id,
        userId,
        status: { in: ['RESERVED', 'APPLIED'] },
      },
    });
    if (userUsedCount >= Number(promo.maxUsesPerUser)) {
      throw httpError(400, 'You have already reached the usage limit for this promo code.');
    }
  }
}

/**
 * Releases stale RESERVED redemptions from unfinished/abandoned online card intents for the same target & user
 * so retries never lock the user out of their own promo code.
 */
async function releaseStalePendingCardRedemptionsInTx(tx, { userId, dossierId, groupBatchId, invoiceId }) {
  const targetOr = [];
  if (dossierId) targetOr.push({ dossierId });
  if (groupBatchId) targetOr.push({ groupBatchId });
  if (invoiceId) targetOr.push({ corporateInvoiceId: invoiceId });
  if (targetOr.length === 0) return 0;

  const staleList = await tx.promoCodeRedemption.findMany({
    where: {
      userId,
      status: 'RESERVED',
      bankPaymentReceiptId: null, // Never auto-release a pending bank wire slip waiting for Finance review!
      OR: targetOr,
    },
    include: {
      transaction: { select: { id: true, status: true } },
    },
  });

  let releasedCount = 0;
  for (const r of staleList) {
    if (r.transaction && r.transaction.status === 'PAID') continue;
    await tx.promoCodeRedemption.update({
      where: { id: r.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releaseReason: 'Superseded by a new checkout attempt',
      },
    });
    await tx.$executeRaw`UPDATE PromoCode SET currentUses = GREATEST(0, currentUses - 1) WHERE id = ${r.promoCodeId}`;
    releasedCount += 1;
  }
  return releasedCount;
}

/**
 * Non-mutating live preview & validation for portal checkout modals.
 */
async function validatePromoCode({
  code,
  userId,
  userRole,
  dossierId = null,
  groupBatchId = null,
  invoiceId = null,
  scope = null,
  purpose = null,
  source = null,
  cartItems = null,
}) {
  if (String(source || '').toUpperCase() === 'WIZARD_5_STEP') {
    throw httpError(400, 'Promo codes are not applicable in the 5-step application wizard.');
  }

  const normalized = normalizeCode(code);
  const promo = await prisma.promoCode.findUnique({
    where: { code: normalized },
    include: { country: { select: { id: true, code: true, nameEn: true } } },
  });

  const context = await resolveTargetContext(prisma, {
    userId,
    userRole,
    dossierId,
    groupBatchId,
    invoiceId,
    scope,
    purpose,
    cartItems,
  });

  // Note: ignore user's own stale pending-card RESERVED rows when previewing
  await assertPromoEligibility(prisma, promo, context, userId);

  const amounts = calculatePromoAmounts(promo, context);
  const rate = context.eurToAznRate;

  return {
    valid: true,
    promo: {
      id: promo.id,
      code: promo.code,
      title: promo.title,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxDiscountEur: promo.maxDiscountEur,
      applyTarget: promo.applyTarget,
      applicableScope: promo.applicableScope,
      allowAgentCommission: promo.allowAgentCommission,
      country: promo.country || null,
    },
    originalAmountEur: amounts.originalAmountEur,
    eligibleAmountEur: amounts.eligibleAmountEur,
    discountAmountEur: amounts.discountAmountEur,
    finalAmountEur: amounts.finalAmountEur,
    originalAmountAzn: convertEurToAzn(amounts.originalAmountEur, rate),
    discountAmountAzn: convertEurToAzn(amounts.discountAmountEur, rate),
    finalAmountAzn: convertEurToAzn(amounts.finalAmountEur, rate),
    existingDueEur: context.existingDueEur,
    pendingCartEur: context.pendingCartEur,
    eurToAznRate: rate,
    isFreeSettlement: amounts.finalAmountEur <= 0,
  };
}

/**
 * Helper to apply confirmed discount amounts onto Dossier / GroupBatch / CorporateInvoice inside a transaction.
 */
async function syncTargetDiscountSnapshotInTx(tx, { dossierId, groupBatchId, corporateInvoiceId, discountAmountEur, promoCode }) {
  const amt = Number(Number(discountAmountEur || 0).toFixed(2));
  if (amt <= 0) return;

  if (dossierId) {
    await tx.dossier.update({
      where: { id: dossierId },
      data: {
        discountAmount: { increment: amt },
        appliedPromoCode: promoCode,
      },
    }).catch(() => {});
  }
  if (groupBatchId) {
    await tx.groupBatch.update({
      where: { id: groupBatchId },
      data: {
        discountAmount: { increment: amt },
        appliedPromoCode: promoCode,
      },
    }).catch(() => {});
  }
  if (corporateInvoiceId) {
    await tx.corporateInvoice.update({
      where: { id: corporateInvoiceId },
      data: {
        discountAmount: { increment: amt },
        appliedPromoCode: promoCode,
      },
    }).catch(() => {});
  }
}

/**
 * Atomically validates, row-locks, reserves or applies a promo code inside an active Prisma $transaction.
 * mode: 'APPLY' (for immediate WALLET / PROMO_FULL_COVERAGE) | 'RESERVE' (for async CARD intent / BANK_SLIP)
 */
async function reserveOrApplyPromoInTx(
  tx,
  {
    code,
    userId,
    userRole,
    paymentMethod = 'WALLET',
    mode = 'APPLY',
    dossierId = null,
    groupBatchId = null,
    invoiceId = null,
    scope = null,
    purpose = null,
    source = null,
    transactionId = null,
    bankPaymentReceiptId = null,
    precomputedContext = null,
  }
) {
  if (String(source || '').toUpperCase() === 'WIZARD_5_STEP') {
    throw httpError(400, 'Promo codes are not applicable in the 5-step application wizard.');
  }

  const normalized = normalizeCode(code);

  // 1. Resolve authoritative target context
  const context =
    precomputedContext ||
    (await resolveTargetContext(tx, {
      userId,
      userRole,
      dossierId,
      groupBatchId,
      invoiceId,
      scope,
      purpose,
    }));

  // 2. Release any stale pending-card reservation on the exact same target by this user
  await releaseStalePendingCardRedemptionsInTx(tx, {
    userId,
    dossierId: context.resolvedDossierId,
    groupBatchId: context.resolvedGroupBatchId,
    invoiceId: context.resolvedInvoiceId,
  });

  // 3. Acquire InnoDB row lock on the PromoCode row to guarantee race-condition-free limit enforcement
  await tx.$queryRaw`SELECT id FROM PromoCode WHERE code = ${normalized} FOR UPDATE`;

  const promo = await tx.promoCode.findUnique({ where: { code: normalized } });
  await assertPromoEligibility(tx, promo, context, userId);

  // 4. Calculate discount amounts
  const amounts = calculatePromoAmounts(promo, context);

  // 5. Atomic conditional increment on PromoCode.currentUses
  if (promo.maxUses !== null && promo.maxUses !== undefined) {
    const updated = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        status: 'ACTIVE',
        currentUses: { lt: Number(promo.maxUses) },
      },
      data: {
        currentUses: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw httpError(400, 'This promo code has reached its maximum usage limit.');
    }
  } else {
    await tx.promoCode.update({
      where: { id: promo.id },
      data: { currentUses: { increment: 1 } },
    });
  }

  const isImmediateApply = mode === 'APPLY';
  const effectiveMethod = amounts.finalAmountEur <= 0 ? 'PROMO_FULL_COVERAGE' : paymentMethod;

  const redemption = await tx.promoCodeRedemption.create({
    data: {
      promoCodeId: promo.id,
      promoCodeSnapshot: promo.code,
      discountTypeSnapshot: promo.discountType,
      discountValueSnapshot: promo.discountValue,
      userId,
      portalType: context.portalType,
      scope: context.effectiveScope,
      paymentMethod: effectiveMethod,
      dossierId: context.resolvedDossierId || null,
      groupBatchId: context.resolvedGroupBatchId || null,
      corporateInvoiceId: context.resolvedInvoiceId || null,
      transactionId: transactionId || null,
      bankPaymentReceiptId: bankPaymentReceiptId || null,
      originalAmountEur: amounts.originalAmountEur,
      eligibleAmountEur: amounts.eligibleAmountEur,
      discountAmountEur: amounts.discountAmountEur,
      finalAmountEur: amounts.finalAmountEur,
      currency: 'EUR',
      status: isImmediateApply ? 'APPLIED' : 'RESERVED',
      confirmedAt: isImmediateApply ? new Date() : null,
      metadataJson: {
        applyTarget: promo.applyTarget,
        allowAgentCommission: promo.allowAgentCommission,
        consularFeeTotalEur: context.consularFeeTotalEur,
      },
    },
  });

  if (isImmediateApply) {
    await syncTargetDiscountSnapshotInTx(tx, {
      dossierId: context.resolvedDossierId,
      groupBatchId: context.resolvedGroupBatchId,
      corporateInvoiceId: context.resolvedInvoiceId,
      discountAmountEur: amounts.discountAmountEur,
      promoCode: promo.code,
    });
  }

  return {
    promo,
    redemption,
    context,
    ...amounts,
    allowAgentCommission: promo.allowAgentCommission,
    consularFeeTotalEur: context.consularFeeTotalEur,
  };
}

/**
 * Transitions a RESERVED redemption to APPLIED (called on Stripe confirm / Admin bank slip approve).
 */
async function confirmReservedRedemptionInTx(tx, { redemptionId = null, transactionId = null, bankPaymentReceiptId = null } = {}) {
  const whereOr = [];
  if (redemptionId) whereOr.push({ id: redemptionId });
  if (transactionId) whereOr.push({ transactionId });
  if (bankPaymentReceiptId) whereOr.push({ bankPaymentReceiptId });
  if (whereOr.length === 0) return null;

  const redemption = await tx.promoCodeRedemption.findFirst({
    where: { OR: whereOr },
    include: { promoCode: true },
  });

  if (!redemption) return null;
  if (redemption.status === 'APPLIED') {
    if (transactionId && !redemption.transactionId) {
      return tx.promoCodeRedemption.update({
        where: { id: redemption.id },
        data: { transactionId },
      });
    }
    return redemption;
  }
  if (redemption.status !== 'RESERVED') {
    return redemption;
  }

  const updated = await tx.promoCodeRedemption.update({
    where: { id: redemption.id },
    data: {
      status: 'APPLIED',
      confirmedAt: new Date(),
      ...(transactionId ? { transactionId } : {}),
    },
  });

  await syncTargetDiscountSnapshotInTx(tx, {
    dossierId: redemption.dossierId,
    groupBatchId: redemption.groupBatchId,
    corporateInvoiceId: redemption.corporateInvoiceId,
    discountAmountEur: redemption.discountAmountEur,
    promoCode: redemption.promoCodeSnapshot,
  });

  return {
    ...updated,
    allowAgentCommission: redemption.promoCode ? redemption.promoCode.allowAgentCommission : true,
  };
}

/**
 * Releases a RESERVED redemption back to available quota (called on bank slip reject / payment failure / expiry).
 */
async function releaseReservedRedemptionInTx(
  tx,
  { redemptionId = null, transactionId = null, bankPaymentReceiptId = null, reason = 'Payment cancelled or rejected' } = {}
) {
  const whereOr = [];
  if (redemptionId) whereOr.push({ id: redemptionId });
  if (transactionId) whereOr.push({ transactionId });
  if (bankPaymentReceiptId) whereOr.push({ bankPaymentReceiptId });
  if (whereOr.length === 0) return null;

  const redemption = await tx.promoCodeRedemption.findFirst({
    where: { OR: whereOr, status: 'RESERVED' },
  });

  if (!redemption) return null;

  const updated = await tx.promoCodeRedemption.update({
    where: { id: redemption.id },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releaseReason: reason,
    },
  });

  await tx.$executeRaw`UPDATE PromoCode SET currentUses = GREATEST(0, currentUses - 1) WHERE id = ${redemption.promoCodeId}`;
  return updated;
}

/**
 * Marks an APPLIED redemption as REFUNDED (called on Stripe charge.refunded webhook).
 */
async function refundAppliedRedemptionInTx(tx, { transactionId, reason = 'Payment refunded' }) {
  if (!transactionId) return null;
  const redemption = await tx.promoCodeRedemption.findFirst({
    where: { transactionId, status: 'APPLIED' },
  });
  if (!redemption) return null;

  const updated = await tx.promoCodeRedemption.update({
    where: { id: redemption.id },
    data: {
      status: 'REFUNDED',
      releasedAt: new Date(),
      releaseReason: reason,
    },
  });

  const amt = Number(redemption.discountAmountEur || 0);
  if (amt > 0) {
    if (redemption.dossierId) {
      await tx.$executeRaw`UPDATE Dossier SET discountAmount = GREATEST(0, discountAmount - ${amt}) WHERE id = ${redemption.dossierId}`;
    }
    if (redemption.groupBatchId) {
      await tx.$executeRaw`UPDATE GroupBatch SET discountAmount = GREATEST(0, discountAmount - ${amt}) WHERE id = ${redemption.groupBatchId}`;
    }
    if (redemption.corporateInvoiceId) {
      await tx.$executeRaw`UPDATE CorporateInvoice SET discountAmount = GREATEST(0, discountAmount - ${amt}) WHERE id = ${redemption.corporateInvoiceId}`;
    }
  }
  await tx.$executeRaw`UPDATE PromoCode SET currentUses = GREATEST(0, currentUses - 1) WHERE id = ${redemption.promoCodeId}`;
  return updated;
}

/**
 * Releases stale RESERVED card-intent redemptions older than N hours (used by cron scheduler).
 */
async function releaseExpiredReservedRedemptions(hoursOld = 24) {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  const stale = await prisma.promoCodeRedemption.findMany({
    where: {
      status: 'RESERVED',
      bankPaymentReceiptId: null,
      reservedAt: { lt: cutoff },
    },
    include: { transaction: { select: { status: true } } },
  });

  let released = 0;
  for (const r of stale) {
    if (r.transaction && r.transaction.status === 'PAID') continue;
    await prisma.$transaction(async (tx) => {
      await releaseReservedRedemptionInTx(tx, {
        redemptionId: r.id,
        reason: `Automatically released after ${hoursOld}h unpaid reservation expiry`,
      });
    });
    released += 1;
  }
  return released;
}

// ============================================================================
// ADMIN CRUD & ANALYTICS FUNCTIONS
// ============================================================================

function parseOptionalNumber(val, { allowZero = false } = {}) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (isNaN(num)) throw httpError(400, 'Invalid numeric value provided.');
  if (allowZero ? num < 0 : num <= 0) {
    throw httpError(400, allowZero ? 'Value must be 0 or greater.' : 'Value must be greater than 0.');
  }
  return Number(num.toFixed(2));
}

function parseOptionalInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = parseInt(String(val), 10);
  if (isNaN(num) || num <= 0) throw httpError(400, 'Usage limit must be a positive integer.');
  return num;
}

function parseOptionalDate(val) {
  if (val === null || val === undefined || val === '') return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) throw httpError(400, 'Invalid date value provided.');
  return d;
}

function normalizePortals(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cleaned = [...new Set(raw.map((p) => String(p).toUpperCase()).filter((p) => VALID_PORTALS.includes(p)))];
  return cleaned.length > 0 ? cleaned : null;
}

async function listPromoCodes({ status = null, portal = null, search = null } = {}) {
  const where = {};
  if (status && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(String(status).toUpperCase())) {
    where.status = String(status).toUpperCase();
  }
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { code: { contains: q } },
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const rows = await prisma.promoCode.findMany({
    where,
    include: {
      country: { select: { id: true, code: true, nameEn: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      redemptions: {
        where: { status: { in: ['RESERVED', 'APPLIED'] } },
        select: { id: true, status: true, discountAmountEur: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  let mapped = rows.map((p) => {
    const appliedList = p.redemptions.filter((r) => r.status === 'APPLIED');
    const reservedList = p.redemptions.filter((r) => r.status === 'RESERVED');
    const totalDiscountGrantedEur = Number(
      appliedList.reduce((sum, r) => sum + Number(r.discountAmountEur || 0), 0).toFixed(2)
    );
    const displayStatus = computeDisplayStatus(p, now);

    return {
      id: p.id,
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      maxDiscountEur: p.maxDiscountEur,
      minOrderAmountEur: p.minOrderAmountEur,
      applyTarget: p.applyTarget,
      allowAgentCommission: p.allowAgentCommission,
      applicableScope: p.applicableScope,
      allowedPortals: Array.isArray(p.allowedPortalsJson) ? p.allowedPortalsJson : VALID_PORTALS,
      allowedPortalsJson: p.allowedPortalsJson,
      countryId: p.countryId,
      country: p.country,
      maxUses: p.maxUses,
      maxUsesPerUser: p.maxUsesPerUser,
      currentUses: p.currentUses,
      appliedCount: appliedList.length,
      reservedCount: reservedList.length,
      totalDiscountGrantedEur,
      startsAt: p.startsAt,
      expiresAt: p.expiresAt,
      status: p.status,
      displayStatus,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  if (status && ['EXPIRED', 'EXHAUSTED', 'SCHEDULED'].includes(String(status).toUpperCase())) {
    const targetDisplay = String(status).toUpperCase();
    mapped = mapped.filter((p) => p.displayStatus === targetDisplay);
  }

  if (portal && portal !== 'ALL') {
    const pUpper = String(portal).toUpperCase();
    mapped = mapped.filter((p) => !p.allowedPortalsJson || p.allowedPortals.includes(pUpper));
  }

  return mapped;
}

async function getPromoAnalytics() {
  const [allCodes, appliedAgg, reservedCount] = await Promise.all([
    prisma.promoCode.findMany({
      select: { id: true, status: true, maxUses: true, currentUses: true, startsAt: true, expiresAt: true },
    }),
    prisma.promoCodeRedemption.aggregate({
      _sum: { discountAmountEur: true, originalAmountEur: true, finalAmountEur: true },
      _count: { id: true },
      where: { status: 'APPLIED' },
    }),
    prisma.promoCodeRedemption.count({ where: { status: 'RESERVED' } }),
  ]);

  const now = new Date();
  let activeCount = 0;
  let expiredOrExhaustedCount = 0;
  let inactiveCount = 0;

  for (const c of allCodes) {
    const ds = computeDisplayStatus(c, now);
    if (ds === 'ACTIVE') activeCount += 1;
    else if (ds === 'EXPIRED' || ds === 'EXHAUSTED') expiredOrExhaustedCount += 1;
    else inactiveCount += 1;
  }

  return {
    totalCodes: allCodes.length,
    activeCodes: activeCount,
    expiredOrExhaustedCodes: expiredOrExhaustedCount,
    inactiveCodes: inactiveCount,
    confirmedRedemptions: appliedAgg._count?.id || 0,
    reservedRedemptions: reservedCount,
    totalRedemptions: (appliedAgg._count?.id || 0) + reservedCount,
    totalDiscountGrantedEur: Number(Number(appliedAgg._sum?.discountAmountEur || 0).toFixed(2)),
    totalGrossVolumeEur: Number(Number(appliedAgg._sum?.originalAmountEur || 0).toFixed(2)),
    totalNetCollectedEur: Number(Number(appliedAgg._sum?.finalAmountEur || 0).toFixed(2)),
  };
}

async function getPromoCodeDetail(promoId) {
  const promo = await prisma.promoCode.findUnique({
    where: { id: promoId },
    include: {
      country: { select: { id: true, code: true, nameEn: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      redemptions: {
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true, companyName: true } },
          dossier: { select: { id: true, dossierNumber: true } },
          groupBatch: { select: { id: true, code: true, name: true } },
          corporateInvoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { reservedAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!promo) {
    throw httpError(404, 'Promo code not found.');
  }

  return {
    ...promo,
    allowedPortals: Array.isArray(promo.allowedPortalsJson) ? promo.allowedPortalsJson : VALID_PORTALS,
    displayStatus: computeDisplayStatus(promo),
  };
}

async function getPromoRedemptions(promoId) {
  const exists = await prisma.promoCode.findUnique({ where: { id: promoId }, select: { id: true, code: true } });
  if (!exists) throw httpError(404, 'Promo code not found.');

  const redemptions = await prisma.promoCodeRedemption.findMany({
    where: { promoCodeId: promoId },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true, companyName: true } },
      dossier: { select: { id: true, dossierNumber: true } },
      groupBatch: { select: { id: true, code: true, name: true } },
      corporateInvoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { reservedAt: 'desc' },
    take: 200,
  });

  return { promo: exists, redemptions };
}

async function createPromoCode(payload, adminUserId) {
  const code = normalizeCode(payload.code);
  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    throw httpError(409, `Promo code "${code}" already exists.`);
  }

  const discountType = String(payload.discountType || 'PERCENTAGE').toUpperCase();
  if (!VALID_DISCOUNT_TYPES.includes(discountType)) {
    throw httpError(400, 'Invalid discountType. Expected PERCENTAGE or FIXED_EUR.');
  }

  const discountValue = parseOptionalNumber(payload.discountValue);
  if (discountValue === null || discountValue <= 0) {
    throw httpError(400, 'Discount value must be greater than 0.');
  }
  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    throw httpError(400, 'Percentage discount cannot exceed 100%.');
  }

  const applyTarget = String(payload.applyTarget || 'TOTAL_AMOUNT').toUpperCase();
  if (!VALID_APPLY_TARGETS.includes(applyTarget)) {
    throw httpError(400, 'Invalid applyTarget.');
  }

  const applicableScope = String(payload.applicableScope || 'ALL').toUpperCase();
  if (!VALID_SCOPES.includes(applicableScope)) {
    throw httpError(400, 'Invalid applicableScope.');
  }

  const maxDiscountEur = discountType === 'PERCENTAGE' ? parseOptionalNumber(payload.maxDiscountEur) : null;
  const minOrderAmountEur = parseOptionalNumber(payload.minOrderAmountEur, { allowZero: true });
  const maxUses = parseOptionalInt(payload.maxUses);
  const maxUsesPerUser = payload.maxUsesPerUser === '' || payload.maxUsesPerUser === null ? null : parseOptionalInt(payload.maxUsesPerUser ?? 1);
  const startsAt = parseOptionalDate(payload.startsAt);
  const expiresAt = parseOptionalDate(payload.expiresAt);
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw httpError(400, 'Expiration date must be after start date.');
  }

  const allowedPortalsJson = normalizePortals(payload.allowedPortals || payload.allowedPortalsJson);
  const countryId = payload.countryId ? String(payload.countryId).trim() : null;
  if (countryId) {
    const c = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
    if (!c) throw httpError(400, 'Selected destination country does not exist.');
  }

  const created = await prisma.promoCode.create({
    data: {
      code,
      title: payload.title ? String(payload.title).trim() : null,
      description: payload.description ? String(payload.description).trim() : null,
      discountType,
      discountValue,
      maxDiscountEur,
      minOrderAmountEur: minOrderAmountEur && minOrderAmountEur > 0 ? minOrderAmountEur : null,
      applyTarget,
      allowAgentCommission: payload.allowAgentCommission !== undefined ? Boolean(payload.allowAgentCommission) : true,
      applicableScope,
      allowedPortalsJson,
      countryId,
      maxUses,
      maxUsesPerUser,
      startsAt,
      expiresAt,
      status: payload.status && ['ACTIVE', 'INACTIVE'].includes(String(payload.status).toUpperCase())
        ? String(payload.status).toUpperCase()
        : 'ACTIVE',
      createdByUserId: adminUserId || null,
    },
    include: {
      country: { select: { id: true, code: true, nameEn: true } },
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'PROMO_CODE_CREATED',
        details: {
          promoCodeId: created.id,
          code: created.code,
          discountType: created.discountType,
          discountValue: created.discountValue,
          applicableScope: created.applicableScope,
          allowedPortals: allowedPortalsJson || VALID_PORTALS,
        },
      },
    });
  } catch {}

  return {
    ...created,
    allowedPortals: Array.isArray(created.allowedPortalsJson) ? created.allowedPortalsJson : VALID_PORTALS,
    displayStatus: computeDisplayStatus(created),
  };
}

async function updatePromoCode(promoId, payload, adminUserId) {
  const existing = await prisma.promoCode.findUnique({ where: { id: promoId } });
  if (!existing) throw httpError(404, 'Promo code not found.');

  const data = {};

  if (payload.code !== undefined) {
    const nextCode = normalizeCode(payload.code);
    if (nextCode !== existing.code) {
      const clash = await prisma.promoCode.findUnique({ where: { code: nextCode } });
      if (clash) throw httpError(409, `Promo code "${nextCode}" already exists.`);
      data.code = nextCode;
    }
  }
  if (payload.title !== undefined) data.title = payload.title ? String(payload.title).trim() : null;
  if (payload.description !== undefined) data.description = payload.description ? String(payload.description).trim() : null;

  const nextDiscountType = payload.discountType ? String(payload.discountType).toUpperCase() : existing.discountType;
  if (!VALID_DISCOUNT_TYPES.includes(nextDiscountType)) throw httpError(400, 'Invalid discountType.');
  if (payload.discountType !== undefined) data.discountType = nextDiscountType;

  if (payload.discountValue !== undefined) {
    const val = parseOptionalNumber(payload.discountValue);
    if (val === null || val <= 0) throw httpError(400, 'Discount value must be greater than 0.');
    if (nextDiscountType === 'PERCENTAGE' && val > 100) throw httpError(400, 'Percentage discount cannot exceed 100%.');
    data.discountValue = val;
  }

  if (payload.maxDiscountEur !== undefined) {
    data.maxDiscountEur = nextDiscountType === 'PERCENTAGE' ? parseOptionalNumber(payload.maxDiscountEur) : null;
  } else if (nextDiscountType === 'FIXED_EUR') {
    data.maxDiscountEur = null;
  }

  if (payload.minOrderAmountEur !== undefined) {
    const minVal = parseOptionalNumber(payload.minOrderAmountEur, { allowZero: true });
    data.minOrderAmountEur = minVal && minVal > 0 ? minVal : null;
  }

  if (payload.applyTarget !== undefined) {
    const t = String(payload.applyTarget).toUpperCase();
    if (!VALID_APPLY_TARGETS.includes(t)) throw httpError(400, 'Invalid applyTarget.');
    data.applyTarget = t;
  }
  if (payload.allowAgentCommission !== undefined) {
    data.allowAgentCommission = Boolean(payload.allowAgentCommission);
  }
  if (payload.applicableScope !== undefined) {
    const sc = String(payload.applicableScope).toUpperCase();
    if (!VALID_SCOPES.includes(sc)) throw httpError(400, 'Invalid applicableScope.');
    data.applicableScope = sc;
  }
  if (payload.allowedPortals !== undefined || payload.allowedPortalsJson !== undefined) {
    data.allowedPortalsJson = normalizePortals(payload.allowedPortals ?? payload.allowedPortalsJson);
  }
  if (payload.countryId !== undefined) {
    const cid = payload.countryId ? String(payload.countryId).trim() : null;
    if (cid) {
      const c = await prisma.country.findUnique({ where: { id: cid }, select: { id: true } });
      if (!c) throw httpError(400, 'Selected destination country does not exist.');
    }
    data.countryId = cid;
  }
  if (payload.maxUses !== undefined) data.maxUses = parseOptionalInt(payload.maxUses);
  if (payload.maxUsesPerUser !== undefined) data.maxUsesPerUser = parseOptionalInt(payload.maxUsesPerUser);

  const nextStartsAt = payload.startsAt !== undefined ? parseOptionalDate(payload.startsAt) : existing.startsAt;
  const nextExpiresAt = payload.expiresAt !== undefined ? parseOptionalDate(payload.expiresAt) : existing.expiresAt;
  if (nextStartsAt && nextExpiresAt && nextExpiresAt <= nextStartsAt) {
    throw httpError(400, 'Expiration date must be after start date.');
  }
  if (payload.startsAt !== undefined) data.startsAt = nextStartsAt;
  if (payload.expiresAt !== undefined) data.expiresAt = nextExpiresAt;

  if (payload.status !== undefined && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(String(payload.status).toUpperCase())) {
    data.status = String(payload.status).toUpperCase();
  }

  const updated = await prisma.promoCode.update({
    where: { id: promoId },
    data,
    include: { country: { select: { id: true, code: true, nameEn: true } } },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'PROMO_CODE_UPDATED',
        details: { promoCodeId: updated.id, code: updated.code, changedFields: Object.keys(data) },
      },
    });
  } catch {}

  return {
    ...updated,
    allowedPortals: Array.isArray(updated.allowedPortalsJson) ? updated.allowedPortalsJson : VALID_PORTALS,
    displayStatus: computeDisplayStatus(updated),
  };
}

async function togglePromoCodeStatus(promoId, status, adminUserId) {
  const existing = await prisma.promoCode.findUnique({ where: { id: promoId } });
  if (!existing) throw httpError(404, 'Promo code not found.');

  const nextStatus = status
    ? String(status).toUpperCase()
    : existing.status === 'ACTIVE'
      ? 'INACTIVE'
      : 'ACTIVE';
  if (!['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(nextStatus)) {
    throw httpError(400, 'Invalid promo code status.');
  }

  const updated = await prisma.promoCode.update({
    where: { id: promoId },
    data: { status: nextStatus },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'PROMO_CODE_STATUS_CHANGED',
        details: { promoCodeId: updated.id, code: updated.code, from: existing.status, to: nextStatus },
      },
    });
  } catch {}

  return {
    ...updated,
    displayStatus: computeDisplayStatus(updated),
  };
}

async function deleteOrArchivePromoCode(promoId, adminUserId) {
  const existing = await prisma.promoCode.findUnique({
    where: { id: promoId },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!existing) throw httpError(404, 'Promo code not found.');

  // Preserve financial audit trail if any redemptions exist
  if ((existing._count?.redemptions || 0) > 0) {
    const archived = await prisma.promoCode.update({
      where: { id: promoId },
      data: { status: 'ARCHIVED' },
    });
    try {
      await prisma.auditLog.create({
        data: {
          userId: adminUserId || null,
          action: 'PROMO_CODE_ARCHIVED',
          details: { promoCodeId: existing.id, code: existing.code, redemptionsCount: existing._count.redemptions },
        },
      });
    } catch {}
    return { action: 'ARCHIVED', promo: archived };
  }

  await prisma.promoCode.delete({ where: { id: promoId } });
  try {
    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'PROMO_CODE_DELETED',
        details: { promoCodeId: existing.id, code: existing.code },
      },
    });
  } catch {}
  return { action: 'DELETED', id: promoId, code: existing.code };
}

module.exports = {
  normalizeCode,
  computeDisplayStatus,
  getDossierConfirmedDiscountEur,
  getGroupBatchConfirmedDiscountEur,
  resolveTargetContext,
  calculatePromoAmounts,
  validatePromoCode,
  reserveOrApplyPromoInTx,
  confirmReservedRedemptionInTx,
  releaseReservedRedemptionInTx,
  refundAppliedRedemptionInTx,
  releaseExpiredReservedRedemptions,
  listPromoCodes,
  getPromoAnalytics,
  getPromoCodeDetail,
  getPromoRedemptions,
  createPromoCode,
  updatePromoCode,
  togglePromoCodeStatus,
  deleteOrArchivePromoCode,
};
