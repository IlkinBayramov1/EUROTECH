const prisma = require('../../config/db');
const { SERVICE_PRICES, DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn } = require('../../config/constants');

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
  const settings = await tx.systemSetting.findMany({
    where: {
      key: { in: ['EUR_TO_AZN_RATE', 'EXPRESS_PROCESSING_FEE'] },
    },
  });
  const map = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  const eurToAznRate = Number(map.EUR_TO_AZN_RATE || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
  const expressFee = Number(map.EXPRESS_PROCESSING_FEE || SERVICE_PRICES.EXPRESS_PROCESSING) || 60.0;
  return {
    eurToAznRate,
    prices: {
      ...SERVICE_PRICES,
      EXPRESS_PROCESSING: expressFee,
    },
  };
}

async function getServiceCatalog() {
  const { eurToAznRate, prices } = await getDynamicPricingSettings();

  const items = [
    {
      id: 'PREMIUM_LOUNGE',
      title: 'VIP Lounge & Priority Access',
      price: prices.PREMIUM_LOUNGE,
      description: 'Dedicated quiet space, prime time slots, refreshments, and personal support throughout the center.',
      category: 'COMFORT',
      recommended: true,
    },
    {
      id: 'EXPRESS_PROCESSING',
      title: 'Express Processing',
      price: prices.EXPRESS_PROCESSING,
      description: 'Expedited processing queue and priority document verification before consular submission.',
      category: 'SPEED',
      recommended: true,
    },
    {
      id: 'FILE_PREPARATION',
      title: 'Full File Preparation',
      price: prices.FILE_PREPARATION,
      description: 'Verification of documents and consistency check to maximize consular acceptance chances.',
      category: 'ASSISTANCE',
    },
    {
      id: 'TRANSLATION_APOSTILLE',
      title: 'Translation & Apostille',
      price: prices.TRANSLATION_APOSTILLE,
      description: 'Certified legal translation and official notarization/apostille support for civil documents.',
      category: 'LEGAL',
    },
    {
      id: 'TRAVEL_INSURANCE',
      title: 'Travel Medical Insurance (€30,000)',
      price: prices.TRAVEL_INSURANCE,
      description: 'Schengen-compliant health coverage up to €30,000 valid across all Member States.',
      category: 'REQUIRED_COVERAGE',
      recommended: true,
    },
    {
      id: 'FORM_ASSIST',
      title: '37-Point Form Completion',
      price: prices.FORM_ASSIST,
      description: 'Specialist assistance with filling out and reviewing the official Schengen application form.',
      category: 'ASSISTANCE',
    },
    {
      id: 'COURIER',
      title: 'Secure Passport Courier',
      price: prices.COURIER,
      description: 'Tracked door-to-door delivery of your processed passport directly to your home or office.',
      category: 'DELIVERY',
    },
    {
      id: 'HOTEL_BOOKING',
      title: 'Verifiable Hotel Reservation',
      price: prices.HOTEL_BOOKING,
      description: 'Consulate-verifiable accommodation confirmation matching your intended itinerary.',
      category: 'DOCUMENTATION',
    },
    {
      id: 'FLIGHT_BOOKING',
      title: 'Flight Itinerary Reservation',
      price: prices.FLIGHT_BOOKING,
      description: 'Verifiable round-trip flight reservation without upfront full-fare ticket purchase.',
      category: 'DOCUMENTATION',
    },
    {
      id: 'BIOMETRIC_PHOTO',
      title: 'ICAO Biometric Photo',
      price: prices.BIOMETRIC_PHOTO,
      description: '100% Schengen and ICAO compliant biometric photos captured on-site.',
      category: 'BIOMETRICS',
    },
    {
      id: 'SMS_TRACKING',
      title: 'SMS & WhatsApp Live Alerts',
      price: prices.SMS_TRACKING,
      description: 'Instant automated SMS & WhatsApp alerts at every consular milestone.',
      category: 'DELIVERY',
    },
  ];

  return items.map((item) => ({
    ...item,
    currency: 'EUR',
    priceAzn: convertEurToAzn(item.price, eurToAznRate),
    exchangeRate: eurToAznRate,
  }));
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

module.exports = {
  resolveServiceType,
  getDynamicPricingSettings,
  computeDossierTotals,
  getServiceCatalog,
  addServiceToDossier,
  checkoutServices,
  removeServiceFromDossier,
};
