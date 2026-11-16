const prisma = require('../../config/db');
const { SERVICE_PRICES, DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn } = require('../../config/constants');
const { getPricingCatalog } = require('./pricingConfig.service');
const { calculatePortalFees } = require('../../utils/finance.util');

const CANONICAL_ALIASES = {
  LOUNGE: 'PREMIUM_LOUNGE',
  PREMIUM_LOUNGE: 'PREMIUM_LOUNGE',
  VIP_LOUNGE: 'PREMIUM_LOUNGE',
  FILEPREP: 'FILE_PREPARATION',
  FILE_PREPARATION: 'FILE_PREPARATION',
  INSURANCE: 'TRAVEL_INSURANCE',
  TRAVEL_INSURANCE: 'TRAVEL_INSURANCE',
  HOTEL: 'HOTEL_BOOKING',
  HOTEL_BOOKING: 'HOTEL_BOOKING',
  FLIGHT: 'FLIGHT_BOOKING',
  FLIGHT_BOOKING: 'FLIGHT_BOOKING',
  FORMASSIST: 'FORM_ASSIST',
  FORM_ASSIST: 'FORM_ASSIST',
  FORM_FILLING: 'FORM_ASSIST',
  COURIER: 'COURIER',
  PHOTO: 'BIOMETRIC_PHOTO',
  PHOTO_PRINT: 'BIOMETRIC_PHOTO',
  BIOMETRIC_PHOTO: 'BIOMETRIC_PHOTO',
  EXPRESS: 'EXPRESS_PROCESSING',
  EXPRESS_PROCESSING: 'EXPRESS_PROCESSING',
  TRANSLATION: 'TRANSLATION_APOSTILLE',
  TRANSLATION_APOSTILLE: 'TRANSLATION_APOSTILLE',
  SMS: 'SMS_TRACKING',
  SMS_TRACKING: 'SMS_TRACKING',
};

const STAFF_ROLES = ['ADMIN', 'OPERATOR', 'MANAGER'];

function assertDossierAccess(dossier, user) {
  if (!user) return;
  if (STAFF_ROLES.includes(user.role)) return;
  if (dossier.userId !== user.id) {
    const err = new Error('Bu dosyaya müdaxilə icazəniz yoxdur.');
    err.statusCode = 403;
    throw err;
  }
}

function resolveServiceType(rawType) {
  if (!rawType) return 'FILE_PREPARATION';
  const clean = String(rawType).trim().toUpperCase().replace(/[\s-]/g, '_');
  return CANONICAL_ALIASES[clean] || clean;
}

async function getDynamicPricingSettings(tx = prisma) {
  const fullCatalog = await getPricingCatalog(tx);
  const eurToAznRate = Number(fullCatalog.baseFees?.eurToAznRate || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
  const prices = { ...SERVICE_PRICES };

  for (const s of fullCatalog.services || []) {
    if (s && s.id) {
      prices[s.id] = Number(s.priceEur ?? s.price ?? 0.0);
    }
  }

  return {
    eurToAznRate,
    prices,
    fullCatalog,
  };
}

async function getServiceCatalog() {
  const fullCatalog = await getPricingCatalog();
  const activeServices = (fullCatalog.services || []).filter((s) => s.isActive !== false);
  const activePackages = (fullCatalog.packages || []).filter((p) => p.isActive !== false);

  return {
    catalog: activeServices,
    services: activeServices,
    packages: activePackages,
    baseFees: fullCatalog.baseFees,
    exchangeRate: fullCatalog.exchangeRate,
    currency: 'EUR',
  };
}

function computeDossierTotals(dossier, allServices) {
  const totalExtraFee = Number(allServices.reduce((sum, s) => sum + Number(s.price || 0), 0).toFixed(2));
  const passengerMultiplier = Math.max(1, (dossier.applicants || []).length);
  const baseTotal = Number(((Number(dossier.governmentFee || 0) + Number(dossier.serviceFee || 0)) * passengerMultiplier).toFixed(2));
  const updatedTotal = Number((baseTotal + totalExtraFee).toFixed(2));
  return { totalExtraFee, passengerMultiplier, baseTotal, updatedTotal };
}

async function addServiceToDossier(arg1, arg2, arg3) {
  let dossierId, applicantId, rawType, metadataJson, user;
  if (typeof arg1 === 'object') {
    dossierId = arg1.dossierId;
    applicantId = arg1.applicantId;
    rawType = arg1.serviceType;
    metadataJson = arg1.metadataJson || {};
    user = arg1.user || null;
  } else {
    dossierId = arg1;
    rawType = arg2;
    metadataJson = arg3 || {};
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { services: true, applicants: true },
  });

  if (!dossier) {
    const err = new Error('Dossier not found');
    err.statusCode = 404;
    throw err;
  }
  assertDossierAccess(dossier, user);

  const { prices } = await getDynamicPricingSettings();
  const serviceType = resolveServiceType(rawType);
  const price = prices[serviceType] ?? 30.0;

  const existing = await prisma.additionalService.findFirst({
    where: {
      dossierId,
      applicantId: applicantId || null,
      serviceType,
      status: 'ACTIVE',
    },
  });
  if (existing) {
    return existing;
  }

  const newService = await prisma.additionalService.create({
    data: {
      dossierId,
      applicantId: applicantId || null,
      serviceType,
      price,
      metadataJson,
    },
  });

  const allServices = await prisma.additionalService.findMany({
    where: { dossierId, status: 'ACTIVE' },
  });

  const { totalExtraFee, updatedTotal } = computeDossierTotals(dossier, allServices);

  const updateData = {
    extraServicesFee: totalExtraFee,
    totalAmount: updatedTotal,
  };
  if (dossier.currentStep < 6) {
    updateData.currentStep = 6;
  }

  // If dossier was already paid, adding a new unpaid add-on sets paymentStatus back to PENDING until settled
  if (dossier.paymentStatus === 'PAID' && price > 0) {
    updateData.paymentStatus = 'PENDING';
  }

  await prisma.dossier.update({
    where: { id: dossierId },
    data: updateData,
  });

  return newService;
}

async function checkoutServices({ dossierId, user, items }) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one service must be selected for checkout');
  }

  return await prisma.$transaction(async (tx) => {
    const dossier = await tx.dossier.findUnique({
      where: { id: dossierId },
      include: { services: true, applicants: true },
    });

    if (!dossier) {
      const err = new Error('Dossier not found');
      err.statusCode = 404;
      throw err;
    }
    assertDossierAccess(dossier, user);

    const { prices, eurToAznRate } = await getDynamicPricingSettings(tx);
    const createdServices = [];
    let addedSubtotalEur = 0;

    for (const item of items) {
      const canonicalType = resolveServiceType(item.serviceType);
      const price = prices[canonicalType] ?? 30.0;
      const applicantId = item.applicantId || null;

      const alreadyActive = dossier.services.some(
        (s) => s.serviceType === canonicalType && s.applicantId === applicantId && s.status === 'ACTIVE'
      );
      if (alreadyActive) {
        continue;
      }

      const newService = await tx.additionalService.create({
        data: {
          dossierId,
          applicantId,
          serviceType: canonicalType,
          price,
          status: 'ACTIVE',
          metadataJson: item.metadataJson || {},
        },
      });

      createdServices.push(newService);
      addedSubtotalEur += price;
    }

    const allServices = await tx.additionalService.findMany({
      where: { dossierId, status: 'ACTIVE' },
    });

    const { totalExtraFee, updatedTotal } = computeDossierTotals(dossier, allServices);

    const paidTransactions = await tx.transaction.aggregate({
      _sum: { amount: true },
      where: { dossierId, status: 'PAID', currency: 'EUR' },
    });
    const alreadyPaidEur = Number(paidTransactions._sum.amount || 0);
    const remainingBalanceEur = Math.max(0, Number((updatedTotal - alreadyPaidEur).toFixed(2)));

    const updateDossierData = {
      extraServicesFee: totalExtraFee,
      totalAmount: updatedTotal,
      paymentStatus: remainingBalanceEur > 0 ? 'PENDING' : dossier.paymentStatus,
    };
    if (dossier.currentStep < 6) {
      updateDossierData.currentStep = 6;
    }

    await tx.dossier.update({
      where: { id: dossierId },
      data: updateDossierData,
    });

    return {
      message: `${createdServices.length} xidmət müraciətə əlavə edildi. Yekun ödənişi tamamlayın.`,
      services: createdServices,
      addedSubtotalEur: Number(addedSubtotalEur.toFixed(2)),
      addedSubtotalAzn: convertEurToAzn(addedSubtotalEur, eurToAznRate),
      remainingBalanceEur,
      remainingBalanceAzn: convertEurToAzn(remainingBalanceEur, eurToAznRate),
      currency: 'EUR',
      exchangeRate: eurToAznRate,
      updatedTotalAmount: updatedTotal,
      extraServicesFee: totalExtraFee,
      requiresPayment: remainingBalanceEur > 0,
    };
  });
}

async function removeServiceFromDossier(serviceId, user = null) {
  const service = await prisma.additionalService.findUnique({
    where: { id: serviceId },
    include: { dossier: { include: { applicants: true } } },
  });
  if (!service) {
    const err = new Error('Service not found');
    err.statusCode = 404;
    throw err;
  }
  assertDossierAccess(service.dossier, user);

  await prisma.additionalService.delete({ where: { id: serviceId } });

  const dossierId = service.dossierId;
  const allServices = await prisma.additionalService.findMany({ where: { dossierId, status: 'ACTIVE' } });
  const { totalExtraFee, updatedTotal } = computeDossierTotals(service.dossier, allServices);

  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      extraServicesFee: totalExtraFee,
      totalAmount: updatedTotal,
    },
  });

  let refundedToWallet = false;
  let refundedAmountEur = 0;
  if (service.dossier.paymentStatus === 'PAID' && Number(service.price) > 0) {
    try {
      const { refundToWallet } = require('../payment/wallet.service');
      await refundToWallet({
        userId: service.dossier.userId,
        amountEur: Number(service.price),
        reason: `Refund for cancelled service: ${service.serviceType}`,
        dossierId: service.dossierId,
      });
      refundedToWallet = true;
      refundedAmountEur = Number(service.price);
    } catch (refundErr) {
      console.error('Failed to issue wallet refund for removed service:', refundErr);
    }
  }

  return {
    message: refundedToWallet
      ? `Service removed. €${refundedAmountEur.toFixed(2)} refunded to your EuroTech Wallet.`
      : 'Service removed successfully',
    removedServiceId: serviceId,
    serviceType: service.serviceType,
    updatedTotalAmount: updatedTotal,
    extraServicesFee: totalExtraFee,
    refundedToWallet,
    refundedAmountEur,
  };
}

async function updateDossierPackage({ dossierId, groupBatchId, packageId, user }) {
  const fullCatalog = await getPricingCatalog();
  const normalizedPkgId = String(packageId || 'standard').trim().toLowerCase();
  const matchedPkg =
    (fullCatalog.packages || []).find(
      (p) => String(p.id).toLowerCase() === normalizedPkgId || String(p.code).toLowerCase() === normalizedPkgId
    ) || fullCatalog.packages[0];

  if (!matchedPkg) {
    const err = new Error('Selected payment package not found in catalog');
    err.statusCode = 404;
    throw err;
  }

  let targetDossier = null;
  if (dossierId) {
    targetDossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { applicants: true, services: true, visaCategory: true, groupBatch: true },
    });
  } else if (groupBatchId) {
    const batch = await prisma.groupBatch.findUnique({
      where: { id: groupBatchId },
      include: { dossiers: { include: { applicants: true, services: true, visaCategory: true } } },
    });
    if (batch) {
      targetDossier = batch.dossiers?.[0] || null;
      if (targetDossier) targetDossier.groupBatch = batch;
    }
  }

  if (!targetDossier) {
    const err = new Error('Target dossier or batch not found');
    err.statusCode = 404;
    throw err;
  }

  assertDossierAccess(targetDossier, user);

  const paxCount = Math.max(1, (targetDossier.applicants || []).length);
  const portalType = targetDossier.portalType || 'INDIVIDUAL';
  const duration = targetDossier.groupBatch?.duration || 'short';
  const baseConsularFee =
    targetDossier.visaCategory?.baseFee !== undefined && targetDossier.visaCategory?.baseFee !== null
      ? Number(targetDossier.visaCategory.baseFee)
      : null;

  const fees = calculatePortalFees({
    portalType,
    paxCount,
    activePackage: matchedPkg.id,
    baseConsularFee,
    duration,
    catalog: fullCatalog,
  });

  // Update GroupBatch packageTier if linked
  const resolvedBatchId = groupBatchId || targetDossier.groupBatchId;
  if (resolvedBatchId) {
    await prisma.groupBatch.update({
      where: { id: resolvedBatchId },
      data: { packageTier: matchedPkg.id },
    });
    // Also update any pending CorporateInvoice
    if ( prisma.corporateInvoice && typeof prisma.corporateInvoice.updateMany === 'function' ) {
      await prisma.corporateInvoice.updateMany({
        where: { groupBatchId: resolvedBatchId, status: 'PENDING' },
        data: { amount: fees.grandTotalEur },
      });
    }
  }

  // Update each applicant's formDataJson.package
  for (const app of targetDossier.applicants || []) {
    const existingJson = app.formDataJson && typeof app.formDataJson === 'object' ? app.formDataJson : {};
    await prisma.applicant.update({
      where: { id: app.id },
      data: {
        formDataJson: {
          ...existingJson,
          package: matchedPkg.id,
          packageName: matchedPkg.name,
        },
      },
    });
  }

  // Synchronize AdditionalService rows for INDIVIDUAL dossiers
  if (portalType === 'INDIVIDUAL') {
    await prisma.additionalService.deleteMany({
      where: { dossierId: targetDossier.id },
    });

    const includedIds = Array.isArray(matchedPkg.includedServiceIds) ? matchedPkg.includedServiceIds : [];
    for (const srvId of includedIds) {
      const srvDef = (fullCatalog.services || []).find((s) => s.id === srvId);
      const srvPrice = Number(srvDef?.priceEur ?? 0);
      await prisma.additionalService.create({
        data: {
          dossierId: targetDossier.id,
          serviceType: srvId,
          price: srvPrice,
          status: 'ACTIVE',
          metadataJson: { bundledInPackage: matchedPkg.id, packageName: matchedPkg.name },
        },
      });
    }
  }

  const updatedDossier = await prisma.dossier.update({
    where: { id: targetDossier.id },
    data: {
      governmentFee: fees.govFeePerPax,
      serviceFee: fees.serviceFeePerPaxForDossier,
      extraServicesFee: fees.extraServicesTotalForDossier,
      totalAmount: fees.grandTotalEur,
    },
    include: { services: true, applicants: true },
  });

  return {
    dossier: updatedDossier,
    package: matchedPkg,
    fees,
  };
}

module.exports = {
  resolveServiceType,
  getDynamicPricingSettings,
  computeDossierTotals,
  getServiceCatalog,
  addServiceToDossier,
  checkoutServices,
  removeServiceFromDossier,
  updateDossierPackage,
};
