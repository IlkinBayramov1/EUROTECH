const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn, convertToEur } = require('../config/constants');
const { getCachedPricingCatalog } = require('../modules/service/pricingConfig.service');

/**
 * Fallback Per-Applicant Package Add-On Prices (EUR) — overridden dynamically by Admin Pricing Catalog
 */
const UNIFIED_PACKAGE_PRICES_EUR = {
  standard: 0.0,
  basic: 0.0,
  premium: 126.0,
  plus: 126.0,
  executive: 126.0,
  vip: 257.0,
};

const INDIVIDUAL_ADDON_PRICES_EUR = {
  lounge: 81.0,
  PREMIUM_LOUNGE: 81.0,
  filePrep: 55.0,
  FILE_PREPARATION: 55.0,
  insurance: 35.0,
  TRAVEL_INSURANCE: 35.0,
  hotelFlight: 30.0,
  HOTEL_BOOKING: 15.0,
  FLIGHT_BOOKING: 15.0,
  formAssist: 24.0,
  FORM_ASSIST: 24.0,
  courier: 20.0,
  COURIER: 20.0,
  photo: 12.0,
  BIOMETRIC_PHOTO: 12.0,
  EXPRESS_PROCESSING: 60.0,
  TRANSLATION_APOSTILLE: 45.0,
  SMS_TRACKING: 5.0,
};

const AGENT_TIER_COMMISSION_EUR = {
  BRONZE: 20.0,
  SILVER: 25.0,
  GOLD: 28.0,
  PLATINUM: 32.0,
};

function getDynamicPriceLookup(catalog) {
  const cat = catalog || getCachedPricingCatalog();
  const pkgPrices = { ...UNIFIED_PACKAGE_PRICES_EUR };
  if (cat && Array.isArray(cat.packages)) {
    for (const p of cat.packages) {
      if (p && p.id) {
        pkgPrices[String(p.id).toLowerCase()] = Number(p.priceEur ?? 0);
      }
      if (p && p.code) {
        pkgPrices[String(p.code).toLowerCase()] = Number(p.priceEur ?? 0);
      }
    }
  }

  const addonPrices = { ...INDIVIDUAL_ADDON_PRICES_EUR };
  if (cat && Array.isArray(cat.services)) {
    let hotelPrice = null;
    let flightPrice = null;
    for (const s of cat.services) {
      if (!s) continue;
      const p = Number(s.priceEur ?? s.price ?? 0);
      if (s.id) addonPrices[s.id] = p;
      if (s.wizardKey && s.wizardKey !== 'hotelFlight') {
        addonPrices[s.wizardKey] = p;
      }
      if (s.id === 'HOTEL_BOOKING') hotelPrice = p;
      if (s.id === 'FLIGHT_BOOKING') flightPrice = p;
    }
    if (hotelPrice !== null || flightPrice !== null) {
      addonPrices.hotelFlight = (hotelPrice ?? 15.0) + (flightPrice ?? 15.0);
    }
  }

  return { cat, pkgPrices, addonPrices };
}

/**
 * Safely parses date strings (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, ISO) into a valid Date object.
 * Never returns an Invalid Date object that could crash Prisma.
 */
function parseSafeDate(value, fieldLabel = 'date', { required = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') {
    if (required) {
      const err = new Error(`Missing required ${fieldLabel}. Please provide a valid date (YYYY-MM-DD).`);
      err.statusCode = 400;
      throw err;
    }
    return null;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      if (required) {
        const err = new Error(`Invalid ${fieldLabel} provided.`);
        err.statusCode = 400;
        throw err;
      }
      return null;
    }
    return value;
  }

  const raw = String(value).trim();

  // Support DD.MM.YYYY or DD/MM/YYYY formats commonly found in Excel/CSV exports
  let normalized = raw;
  const dmyMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    normalized = `${year}-${month}-${day}`;
  }

  // Reject strings that clearly aren't dates (e.g. passport numbers like "C10293847")
  if (!/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    const fallback = new Date(normalized);
    if (isNaN(fallback.getTime())) {
      if (required) {
        const err = new Error(`Invalid date format for ${fieldLabel}: "${raw}". Expected YYYY-MM-DD.`);
        err.statusCode = 400;
        throw err;
      }
      return null;
    }
    return fallback;
  }

  const parsed = new Date(normalized.length === 10 ? `${normalized}T00:00:00.000Z` : normalized);
  const year = parsed.getUTCFullYear();
  if (isNaN(parsed.getTime()) || year < 1900 || year > 2100) {
    if (required) {
      const err = new Error(`Invalid calendar date for ${fieldLabel}: "${raw}". Expected YYYY-MM-DD.`);
      err.statusCode = 400;
      throw err;
    }
    return null;
  }

  return parsed;
}

function getAgentCommissionRate(tier = 'BRONZE', catalog = null) {
  const key = String(tier || 'BRONZE').toUpperCase();
  const cat = catalog || getCachedPricingCatalog();
  const dynamicRates = cat?.baseFees?.agentCommissionRates || {};
  if (dynamicRates[key] !== undefined) {
    return Number(dynamicRates[key]);
  }
  return AGENT_TIER_COMMISSION_EUR[key] || 20.0;
}

/**
 * Calculates unified EUR & AZN fees for Individual, Tour Agent, and Corporate portals
 * using the live Admin-managed Pricing Catalog.
 */
function calculatePortalFees({
  portalType = 'INDIVIDUAL',
  paxCount = 1,
  activePackage = 'standard',
  services = null,
  baseConsularFee = null,
  duration = 'short',
  eurToAznRate = null,
  catalog = null,
} = {}) {
  const { cat, pkgPrices, addonPrices } = getDynamicPriceLookup(catalog);
  const bf = cat?.baseFees || {};
  const resolvedRate = Number(eurToAznRate || bf.eurToAznRate || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
  const count = Math.max(1, Number(paxCount) || 1);
  const pkgKey = String(activePackage || (services && services.activePackage) || 'standard').toLowerCase();

  const defaultGovFee =
    duration === 'long'
      ? Number(bf.nationalLongStayFeeEur ?? 90.0)
      : Number(bf.schengenShortStayFeeEur ?? 80.0);
  const govFeePerPax = baseConsularFee !== null && baseConsularFee !== undefined ? Number(baseConsularFee) : defaultGovFee;

  let baseServiceFeePerPax = Number(bf.individualBaseServiceFeeEur ?? 0.0);
  if (portalType === 'GROUP_AGENT') {
    baseServiceFeePerPax = Number(bf.agentBaseServiceFeeEur ?? 65.0);
  } else if (portalType === 'CORPORATE') {
    baseServiceFeePerPax = Number(bf.corporateBaseServiceFeeEur ?? 65.0);
  }

  let packageAddOnPerPax = 0.0;
  if (pkgKey === 'custom' && services && typeof services === 'object') {
    ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo', 'express', 'translation', 'sms'].forEach((k) => {
      if (services[k]) {
        packageAddOnPerPax += addonPrices[k] || 0;
      }
    });
  } else {
    packageAddOnPerPax = pkgPrices[pkgKey] ?? 0.0;
    const matchedPkg = cat?.packages?.find((p) => String(p.id).toLowerCase() === pkgKey);
    const includedFlags = matchedPkg?.wizardFlags || {};
    if (portalType === 'INDIVIDUAL' && services && typeof services === 'object') {
      ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo', 'express', 'translation', 'sms'].forEach((k) => {
        if (services[k] && !includedFlags[k]) {
          packageAddOnPerPax += addonPrices[k] || 0;
        }
      });
    }
  }

  const totalGovFee = Number((govFeePerPax * count).toFixed(2));
  const totalBaseServiceFee = Number((baseServiceFeePerPax * count).toFixed(2));
  const totalPackageAddOnFee = Number((packageAddOnPerPax * count).toFixed(2));

  const serviceFeePerPaxForDossier =
    portalType === 'INDIVIDUAL'
      ? baseServiceFeePerPax
      : Number((baseServiceFeePerPax + packageAddOnPerPax).toFixed(2));

  const extraServicesTotalForDossier = portalType === 'INDIVIDUAL' ? totalPackageAddOnFee : 0.0;
  const grandTotalEur = Number((totalGovFee + totalBaseServiceFee + totalPackageAddOnFee).toFixed(2));
  const grandTotalAzn = convertEurToAzn(grandTotalEur, resolvedRate);

  return {
    paxCount: count,
    currency: 'EUR',
    eurToAznRate: resolvedRate,
    govFeePerPax,
    baseServiceFeePerPax,
    packageAddOnPerPax,
    serviceFeePerPax: serviceFeePerPaxForDossier,
    serviceFeePerPaxForDossier,
    extraServicesTotalForDossier,
    totalGovFee,
    totalBaseServiceFee,
    totalPackageAddOnFee,
    grandTotalEur,
    grandTotalAzn,
    totalAmount: grandTotalEur,
    totalAmountEur: grandTotalEur,
    totalAmountAzn: grandTotalAzn,
    convertToEur: (amt, curr) => convertToEur(amt, curr, resolvedRate),
  };
}

module.exports = {
  UNIFIED_PACKAGE_PRICES_EUR,
  INDIVIDUAL_ADDON_PRICES_EUR,
  AGENT_TIER_COMMISSION_EUR,
  parseSafeDate,
  getAgentCommissionRate,
  calculatePortalFees,
};
