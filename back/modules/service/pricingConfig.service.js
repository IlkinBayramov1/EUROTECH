const prisma = require('../../config/db');
const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn } = require('../../config/constants');

const PRICING_CATALOG_SETTING_KEY = 'PRICING_CATALOG_JSON';

const DEFAULT_PRICING_CATALOG = {
  baseFees: {
    schengenShortStayFeeEur: 80.0,
    nationalLongStayFeeEur: 90.0,
    individualBaseServiceFeeEur: 0.0,
    agentBaseServiceFeeEur: 65.0,
    corporateBaseServiceFeeEur: 65.0,
    eurToAznRate: DEFAULT_EUR_TO_AZN_RATE || 1.85,
    agentCommissionRates: {
      BRONZE: 20.0,
      SILVER: 25.0,
      GOLD: 28.0,
      PLATINUM: 32.0,
    },
  },
  packages: [
    {
      id: 'standard',
      code: 'STANDARD',
      name: 'Standard',
      badge: 'Essential',
      description: 'Essential consular file review, standard appointment scheduling & biometrics processing.',
      priceEur: 0.0,
      features: [
        'Standard appointment scheduling',
        'Consular file completeness check',
        'General visa center hall access',
      ],
      includedServiceIds: [],
      wizardFlags: {
        filePrep: false,
        insurance: false,
        formAssist: false,
        photo: false,
        lounge: false,
        courier: false,
        hotelFlight: false,
      },
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    },
    {
      id: 'premium',
      code: 'PREMIUM',
      name: 'Premium Bundle',
      badge: 'Recommended',
      description: 'Full file preparation, questionnaire assistance, biometric photo & Schengen medical insurance.',
      priceEur: 126.0,
      features: [
        'File Preparation & Verification',
        '€30,000 Schengen Medical Insurance',
        '37-Point Form Completion Assistance',
        'On-site ICAO Biometric Photos',
      ],
      includedServiceIds: ['FILE_PREPARATION', 'TRAVEL_INSURANCE', 'FORM_ASSIST', 'BIOMETRIC_PHOTO'],
      wizardFlags: {
        filePrep: true,
        insurance: true,
        formAssist: true,
        photo: true,
        lounge: false,
        courier: false,
        hotelFlight: false,
      },
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    },
    {
      id: 'vip',
      code: 'VIP',
      name: 'VIP Platinum',
      badge: 'VIP Service',
      description: 'All-inclusive diplomatic lounge access, verifiable hotel & flight itineraries, full concierge & courier return.',
      priceEur: 257.0,
      features: [
        'Everything in Premium Bundle',
        'VIP Consular Lounge Access',
        'Hotel & Flight Itinerary Bookings',
        'Secure Doorstep Passport Courier',
      ],
      includedServiceIds: [
        'FILE_PREPARATION',
        'TRAVEL_INSURANCE',
        'FORM_ASSIST',
        'BIOMETRIC_PHOTO',
        'PREMIUM_LOUNGE',
        'HOTEL_BOOKING',
        'FLIGHT_BOOKING',
        'COURIER',
      ],
      wizardFlags: {
        filePrep: true,
        insurance: true,
        formAssist: true,
        photo: true,
        lounge: true,
        courier: true,
        hotelFlight: true,
      },
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    },
  ],
  services: [
    {
      id: 'PREMIUM_LOUNGE',
      wizardKey: 'lounge',
      title: 'VIP Lounge & Priority Access',
      description: 'Dedicated quiet space, prime time slots, refreshments, and personal support throughout the center.',
      category: 'COMFORT',
      priceEur: 81.0,
      recommended: true,
      isActive: true,
    },
    {
      id: 'EXPRESS_PROCESSING',
      wizardKey: 'express',
      title: 'Express Processing',
      description: 'Expedited processing queue and priority document verification before consular submission.',
      category: 'SPEED',
      priceEur: 60.0,
      recommended: true,
      isActive: true,
    },
    {
      id: 'FILE_PREPARATION',
      wizardKey: 'filePrep',
      title: 'Full File Preparation',
      description: 'Verification of documents and consistency check to maximize consular acceptance chances.',
      category: 'ASSISTANCE',
      priceEur: 55.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'TRANSLATION_APOSTILLE',
      wizardKey: 'translation',
      title: 'Translation & Apostille',
      description: 'Certified legal translation and official notarization/apostille support for civil documents.',
      category: 'LEGAL',
      priceEur: 45.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'TRAVEL_INSURANCE',
      wizardKey: 'insurance',
      title: 'Travel Medical Insurance (€30,000)',
      description: 'Schengen-compliant health coverage up to €30,000 valid across all Member States.',
      category: 'REQUIRED_COVERAGE',
      priceEur: 35.0,
      recommended: true,
      isActive: true,
    },
    {
      id: 'FORM_ASSIST',
      wizardKey: 'formAssist',
      title: '37-Point Form Completion',
      description: 'Specialist assistance with filling out and reviewing the official Schengen application form.',
      category: 'ASSISTANCE',
      priceEur: 24.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'COURIER',
      wizardKey: 'courier',
      title: 'Secure Passport Courier',
      description: 'Tracked door-to-door delivery of your processed passport directly to your home or office.',
      category: 'DELIVERY',
      priceEur: 20.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'HOTEL_BOOKING',
      wizardKey: 'hotelFlight',
      title: 'Verifiable Hotel Reservation',
      description: 'Consulate-verifiable accommodation confirmation matching your intended itinerary.',
      category: 'DOCUMENTATION',
      priceEur: 15.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'FLIGHT_BOOKING',
      wizardKey: 'hotelFlight',
      title: 'Flight Itinerary Reservation',
      description: 'Verifiable round-trip flight reservation without upfront full-fare ticket purchase.',
      category: 'DOCUMENTATION',
      priceEur: 15.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'BIOMETRIC_PHOTO',
      wizardKey: 'photo',
      title: 'ICAO Biometric Photo',
      description: '100% Schengen and ICAO compliant biometric photos captured on-site.',
      category: 'BIOMETRICS',
      priceEur: 12.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'SMS_TRACKING',
      wizardKey: 'sms',
      title: 'SMS & WhatsApp Live Alerts',
      description: 'Instant automated SMS & WhatsApp alerts at every consular milestone.',
      category: 'DELIVERY',
      priceEur: 5.0,
      recommended: false,
      isActive: true,
    },
  ],
};

// Deep clone helper
function cloneCatalog(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Live in-memory cache so synchronous functions (like calculatePortalFees) always have the latest Admin config
let cachedCatalog = cloneCatalog(DEFAULT_PRICING_CATALOG);

function normalizeCatalog(raw = {}) {
  const def = cloneCatalog(DEFAULT_PRICING_CATALOG);

  const baseFees = {
    ...def.baseFees,
    ...(raw.baseFees && typeof raw.baseFees === 'object' ? raw.baseFees : {}),
    agentCommissionRates: {
      ...def.baseFees.agentCommissionRates,
      ...(raw.baseFees?.agentCommissionRates && typeof raw.baseFees.agentCommissionRates === 'object'
        ? raw.baseFees.agentCommissionRates
        : {}),
    },
  };

  baseFees.schengenShortStayFeeEur = Number(baseFees.schengenShortStayFeeEur ?? 80.0);
  baseFees.nationalLongStayFeeEur = Number(baseFees.nationalLongStayFeeEur ?? 90.0);
  baseFees.individualBaseServiceFeeEur = Number(baseFees.individualBaseServiceFeeEur ?? 0.0);
  baseFees.agentBaseServiceFeeEur = Number(baseFees.agentBaseServiceFeeEur ?? 65.0);
  baseFees.corporateBaseServiceFeeEur = Number(baseFees.corporateBaseServiceFeeEur ?? 65.0);
  baseFees.eurToAznRate = Number(baseFees.eurToAznRate || DEFAULT_EUR_TO_AZN_RATE) || 1.85;

  const rate = baseFees.eurToAznRate;

  const rawPackages = Array.isArray(raw.packages) && raw.packages.length > 0 ? raw.packages : def.packages;
  const packages = rawPackages.map((pkg) => {
    const id = String(pkg.id || pkg.code || 'standard').trim().toLowerCase();
    const priceEur = Number(pkg.priceEur ?? pkg.price ?? 0.0);
    const includedServiceIds = Array.isArray(pkg.includedServiceIds)
      ? pkg.includedServiceIds.map((s) => String(s).trim().toUpperCase())
      : [];
    const features = Array.isArray(pkg.features)
      ? pkg.features.map((f) => String(f).trim()).filter(Boolean)
      : [];
    return {
      id,
      code: String(pkg.code || id).trim().toUpperCase(),
      name: String(pkg.name || pkg.title || id).trim(),
      badge: String(pkg.badge || '').trim(),
      description: String(pkg.description || '').trim(),
      priceEur,
      priceAzn: convertEurToAzn(priceEur, rate),
      features,
      includedServiceIds,
      wizardFlags: pkg.wizardFlags || {
        filePrep: includedServiceIds.includes('FILE_PREPARATION'),
        insurance: includedServiceIds.includes('TRAVEL_INSURANCE'),
        formAssist: includedServiceIds.includes('FORM_ASSIST'),
        photo: includedServiceIds.includes('BIOMETRIC_PHOTO'),
        lounge: includedServiceIds.includes('PREMIUM_LOUNGE'),
        courier: includedServiceIds.includes('COURIER'),
        hotelFlight: includedServiceIds.includes('HOTEL_BOOKING') || includedServiceIds.includes('FLIGHT_BOOKING'),
      },
      applicablePortals: Array.isArray(pkg.applicablePortals)
        ? pkg.applicablePortals
        : ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: pkg.isActive !== false,
    };
  });

  const rawServices = Array.isArray(raw.services) && raw.services.length > 0 ? raw.services : def.services;
  const services = rawServices.map((srv) => {
    const id = String(srv.id || srv.code || 'SERVICE').trim().toUpperCase().replace(/[\s-]/g, '_');
    const priceEur = Number(srv.priceEur ?? srv.price ?? 0.0);
    return {
      id,
      code: id,
      wizardKey: srv.wizardKey || null,
      title: String(srv.title || srv.name || id).trim(),
      name: String(srv.title || srv.name || id).trim(),
      description: String(srv.description || '').trim(),
      category: String(srv.category || 'ASSISTANCE').trim().toUpperCase(),
      price: priceEur,
      priceEur,
      priceAzn: convertEurToAzn(priceEur, rate),
      currency: 'EUR',
      exchangeRate: rate,
      recommended: Boolean(srv.recommended),
      isActive: srv.isActive !== false,
    };
  });

  return {
    baseFees,
    packages,
    services,
    exchangeRate: rate,
    currency: 'EUR',
  };
}

function getCachedPricingCatalog() {
  return cachedCatalog;
}

async function getPricingCatalog(tx = prisma) {
  try {
    const dbClient = tx && tx.systemSetting ? tx : prisma;
    let rows = [];
    if (typeof dbClient.systemSetting.findMany === 'function') {
      rows = await dbClient.systemSetting.findMany({
        where: {
          key: {
            in: [
              PRICING_CATALOG_SETTING_KEY,
              'EUR_TO_AZN_RATE',
              'eurToAznRate',
              'EXPRESS_PROCESSING_FEE',
              'urgentProcessingFee',
              'premiumLoungeFee',
              'baseSchengenFee',
            ],
          },
        },
      });
    } else if (typeof dbClient.systemSetting.findUnique === 'function') {
      const single = await dbClient.systemSetting.findUnique({
        where: { key: PRICING_CATALOG_SETTING_KEY },
      });
      if (single) rows = [single];
    }

    const rowMap = {};
    for (const r of rows || []) {
      if (r && r.key) rowMap[r.key] = r.value;
    }

    let parsed = null;
    if (rowMap[PRICING_CATALOG_SETTING_KEY]) {
      try {
        parsed = JSON.parse(rowMap[PRICING_CATALOG_SETTING_KEY]);
      } catch {}
    }

    const mergedRaw = parsed ? cloneCatalog(parsed) : cloneCatalog(cachedCatalog);

    // Apply legacy scalar settings if present and not overridden in JSON
    if (!parsed) {
      if (rowMap.EUR_TO_AZN_RATE || rowMap.eurToAznRate) {
        mergedRaw.baseFees.eurToAznRate = Number(rowMap.EUR_TO_AZN_RATE || rowMap.eurToAznRate) || 1.85;
      }
      if (rowMap.baseSchengenFee) {
        mergedRaw.baseFees.schengenShortStayFeeEur = Number(rowMap.baseSchengenFee) || 80.0;
      }
      const expFee = rowMap.urgentProcessingFee || rowMap.EXPRESS_PROCESSING_FEE;
      if (expFee) {
        const idx = mergedRaw.services.findIndex((s) => s.id === 'EXPRESS_PROCESSING');
        if (idx >= 0) mergedRaw.services[idx].priceEur = Number(expFee) || 60.0;
      }
      if (rowMap.premiumLoungeFee) {
        const idx = mergedRaw.services.findIndex((s) => s.id === 'PREMIUM_LOUNGE');
        if (idx >= 0) mergedRaw.services[idx].priceEur = Number(rowMap.premiumLoungeFee) || 81.0;
      }
    }

    const normalized = normalizeCatalog(mergedRaw);
    cachedCatalog = normalized;
    return normalized;
  } catch (err) {
    return cachedCatalog;
  }
}

async function savePricingCatalog(newCatalogInput, adminUserId = null) {
  const normalized = normalizeCatalog(newCatalogInput);
  cachedCatalog = normalized;

  const jsonString = JSON.stringify({
    baseFees: normalized.baseFees,
    packages: normalized.packages,
    services: normalized.services,
  });

  if (prisma.systemSetting && typeof prisma.systemSetting.upsert === 'function') {
    await prisma.systemSetting.upsert({
      where: { key: PRICING_CATALOG_SETTING_KEY },
      update: {
        value: jsonString,
        valueType: 'JSON',
        updatedBy: adminUserId || null,
      },
      create: {
        key: PRICING_CATALOG_SETTING_KEY,
        value: jsonString,
        valueType: 'JSON',
        description: 'Unified Admin-managed Payment Packages, Add-On Services, and Consular Fee Catalog',
        updatedBy: adminUserId || null,
      },
    });

    // Keep EUR_TO_AZN_RATE setting in sync for wallet conversions
    await prisma.systemSetting.upsert({
      where: { key: 'EUR_TO_AZN_RATE' },
      update: { value: String(normalized.baseFees.eurToAznRate) },
      create: {
        key: 'EUR_TO_AZN_RATE',
        value: String(normalized.baseFees.eurToAznRate),
        valueType: 'NUMBER',
      },
    });
  }

  return normalized;
}

module.exports = {
  PRICING_CATALOG_SETTING_KEY,
  DEFAULT_PRICING_CATALOG,
  normalizeCatalog,
  getCachedPricingCatalog,
  getPricingCatalog,
  savePricingCatalog,
};
