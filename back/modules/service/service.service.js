const prisma = require('../../config/db');
const { SERVICE_PRICES } = require('../../config/constants');

const CANONICAL_ALIASES = {
  LOUNGE: 'PREMIUM_LOUNGE',
  PREMIUM_LOUNGE: 'PREMIUM_LOUNGE',
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
  COURIER: 'COURIER',
  PHOTO: 'BIOMETRIC_PHOTO',
  BIOMETRIC_PHOTO: 'BIOMETRIC_PHOTO',
  EXPRESS: 'EXPRESS_PROCESSING',
  EXPRESS_PROCESSING: 'EXPRESS_PROCESSING',
  TRANSLATION: 'TRANSLATION_APOSTILLE',
  TRANSLATION_APOSTILLE: 'TRANSLATION_APOSTILLE',
};

function resolveServiceType(rawType) {
  if (!rawType) return 'FILE_PREPARATION';
  const clean = String(rawType).trim().toUpperCase().replace(/[\s-]/g, '_');
  return CANONICAL_ALIASES[clean] || clean;
}

function getServiceCatalog() {
  return [
    {
      id: 'PREMIUM_LOUNGE',
      title: 'Premium Lounge Access',
      price: SERVICE_PRICES.PREMIUM_LOUNGE,
      description: 'Dedicated quiet space, prime time slots, and personal support throughout the center.',
      category: 'COMFORT',
    },
    {
      id: 'FILE_PREPARATION',
      title: 'File Preparation',
      price: SERVICE_PRICES.FILE_PREPARATION,
      description: 'Verification of documents and consistency check to maximize acceptance chances.',
      category: 'ASSISTANCE',
    },
    {
      id: 'TRAVEL_INSURANCE',
      title: 'Travel Medical Insurance',
      price: SERVICE_PRICES.TRAVEL_INSURANCE,
      description: 'Schengen-compliant health coverage up to €30,000 for your travel dates.',
      category: 'REQUIRED_COVERAGE',
    },
    {
      id: 'HOTEL_BOOKING',
      title: 'Hotel Reservation',
      price: SERVICE_PRICES.HOTEL_BOOKING,
      description: 'Verifiable dummy hotel booking required for your visa application.',
      category: 'DOCUMENTATION',
    },
    {
      id: 'FLIGHT_BOOKING',
      title: 'Flight Itinerary',
      price: SERVICE_PRICES.FLIGHT_BOOKING,
      description: 'Verifiable round-trip flight reservation without upfront ticket purchase.',
      category: 'DOCUMENTATION',
    },
    {
      id: 'FORM_ASSIST',
      title: 'Form Completion',
      price: SERVICE_PRICES.FORM_ASSIST,
      description: 'Assistance with filling out the official application form accurately.',
      category: 'ASSISTANCE',
    },
    {
      id: 'COURIER',
      title: 'Courier Delivery',
      price: SERVICE_PRICES.COURIER,
      description: 'Secure and tracked delivery of your passport directly to your address.',
      category: 'DELIVERY',
    },
    {
      id: 'BIOMETRIC_PHOTO',
      title: 'Compliant ID Photo',
      price: SERVICE_PRICES.BIOMETRIC_PHOTO,
      description: '100% Schengen and ICAO compliant biometric photos taken on-site.',
      category: 'BIOMETRICS',
    },
    {
      id: 'EXPRESS_PROCESSING',
      title: 'Express Processing',
      price: SERVICE_PRICES.EXPRESS_PROCESSING,
      description: 'Expedited processing queue and priority document verification.',
      category: 'SPEED',
    },
    {
      id: 'TRANSLATION_APOSTILLE',
      title: 'Translation & Apostille',
      price: SERVICE_PRICES.TRANSLATION_APOSTILLE,
      description: 'Certified legal translation and official apostille certification for documents.',
      category: 'LEGAL',
    },
  ];
}

async function addServiceToDossier(arg1, arg2, arg3) {
  let dossierId, applicantId, rawType, metadataJson;
  if (typeof arg1 === 'object') {
    dossierId = arg1.dossierId;
    applicantId = arg1.applicantId;
    rawType = arg1.serviceType;
    metadataJson = arg1.metadataJson || {};
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
    throw new Error('Dossier not found');
  }

  const serviceType = resolveServiceType(rawType);
  const price = SERVICE_PRICES[serviceType] || 30.0;

  // Check if service already exists and is active for this applicant
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

  const totalExtraFee = allServices.reduce((sum, s) => sum + s.price, 0.0);
  const passengerMultiplier = dossier.portalType === 'GROUP_AGENT' ? Math.max(1, dossier.applicants.length) : 1;

  const baseTotal = (dossier.governmentFee + dossier.serviceFee) * passengerMultiplier;
  const updatedTotal = baseTotal + totalExtraFee;

  const updateData = {
    extraServicesFee: totalExtraFee,
    totalAmount: updatedTotal,
  };
  if (dossier.currentStep < 6) {
    updateData.currentStep = 6;
  }

  await prisma.dossier.update({
    where: { id: dossierId },
    data: updateData,
  });

  return newService;
}

async function checkoutServices({ dossierId, userId, items }) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one service must be selected for checkout');
  }

  return await prisma.$transaction(async (tx) => {
    const dossier = await tx.dossier.findUnique({
      where: { id: dossierId },
      include: { services: true, applicants: true },
    });

    if (!dossier) {
      throw new Error('Dossier not found');
    }

    const createdServices = [];
    let checkoutTotal = 0;

    for (const item of items) {
      const canonicalType = resolveServiceType(item.serviceType);
      const price = SERVICE_PRICES[canonicalType] || 30.0;
      const applicantId = item.applicantId || null;

      // Prevent duplicate active service for the same applicant
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
      checkoutTotal += price;
    }

    // Recalculate total dossier fees
    const allServices = await tx.additionalService.findMany({
      where: { dossierId, status: 'ACTIVE' },
    });

    const totalExtraFee = allServices.reduce((sum, s) => sum + s.price, 0.0);
    const passengerMultiplier = dossier.portalType === 'GROUP_AGENT' ? Math.max(1, dossier.applicants.length) : 1;
    const baseTotal = (dossier.governmentFee + dossier.serviceFee) * passengerMultiplier;
    const updatedTotal = baseTotal + totalExtraFee;

    const updateDossierData = {
      extraServicesFee: totalExtraFee,
      totalAmount: updatedTotal,
    };
    if (dossier.currentStep < 6) {
      updateDossierData.currentStep = 6;
    }

    await tx.dossier.update({
      where: { id: dossierId },
      data: updateDossierData,
    });

    // Record Transaction in MySQL
    let transactionRecord = null;
    if (checkoutTotal > 0 && userId) {
      transactionRecord = await tx.transaction.create({
        data: {
          dossierId,
          userId,
          amount: checkoutTotal,
          currency: 'AZN',
          paymentProvider: 'EUROTECH_PORTAL',
          status: 'PAID',
          metadataJson: {
            type: 'VALUE_ADDED_SERVICES',
            itemsCount: createdServices.length,
            services: createdServices.map((s) => ({ id: s.id, type: s.serviceType, price: s.price })),
          },
        },
      });
    }

    return {
      message: `Successfully booked ${createdServices.length} service(s)`,
      services: createdServices,
      totalPaid: checkoutTotal,
      transactionId: transactionRecord?.id || null,
      updatedTotalAmount: updatedTotal,
      extraServicesFee: totalExtraFee,
    };
  });
}

async function removeServiceFromDossier(serviceId) {
  const service = await prisma.additionalService.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error('Service not found');
  }

  await prisma.additionalService.delete({ where: { id: serviceId } });

  const dossierId = service.dossierId;
  const allServices = await prisma.additionalService.findMany({ where: { dossierId, status: 'ACTIVE' } });

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { applicants: true },
  });

  const totalExtraFee = allServices.reduce((sum, s) => sum + s.price, 0.0);
  const passengerMultiplier = dossier.portalType === 'GROUP_AGENT' ? Math.max(1, dossier.applicants.length) : 1;

  const baseTotal = (dossier.governmentFee + dossier.serviceFee) * passengerMultiplier;
  const updatedTotal = baseTotal + totalExtraFee;

  await prisma.dossier.update({
    where: { id: dossierId },
    data: {
      extraServicesFee: totalExtraFee,
      totalAmount: updatedTotal,
    },
  });

  return {
    message: 'Service removed successfully',
    removedServiceId: serviceId,
    serviceType: service.serviceType,
    updatedTotalAmount: updatedTotal,
    extraServicesFee: totalExtraFee,
  };
}

module.exports = {
  getServiceCatalog,
  addServiceToDossier,
  checkoutServices,
  removeServiceFromDossier,
};
