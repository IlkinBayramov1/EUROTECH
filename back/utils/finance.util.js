const { DEFAULT_EUR_TO_AZN_RATE, convertEurToAzn, convertToEur } = require('../config/constants');

/**
 * Unified Per-Applicant Package Add-On Prices (EUR)
 * Matches Step 2 & Step 5 across Individual, Tour Agent, and Corporate portals:
 * - Standard: €0
 * - Premium: €126 (File Prep €55 + Insurance €35 + Form Assist €24 + Photo €12)
 * - VIP: €257 (Premium €126 + VIP Lounge €81 + Hotel/Flight €30 + Courier €20)
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

function getAgentCommissionRate(tier = 'BRONZE') {
  const key = String(tier || 'BRONZE').toUpperCase();
  return AGENT_TIER_COMMISSION_EUR[key] || 20.0;
}

/**
 * Calculates unified EUR & AZN fees for Individual, Tour Agent, and Corporate portals.
 * - INDIVIDUAL: €80 consular base per person + selected package/add-ons per person
 * - GROUP_AGENT: €80 consular + €65 B2B processing (€145 base) per person + package (€0 / €126 / €257) per person
 * - CORPORATE: €80 consular + €65 Corporate mobility (€145 base) per person + package (€0 / €126 / €257) per person
 */
function calculatePortalFees({
  portalType = 'INDIVIDUAL',
  paxCount = 1,
  activePackage = 'standard',
  services = null,
  baseConsularFee = 80.0,
  eurToAznRate = DEFAULT_EUR_TO_AZN_RATE,
} = {}) {
  const count = Math.max(1, Number(paxCount) || 1);
  const pkgKey = String(activePackage || (services && services.activePackage) || 'standard').toLowerCase();
  const govFeePerPax = Number(baseConsularFee || 80.0);

  let baseServiceFeePerPax = 0.0;
  if (portalType === 'GROUP_AGENT' || portalType === 'CORPORATE') {
    baseServiceFeePerPax = 65.0; // €80 gov + €65 B2B service = €145.00 base per person
  }

  let packageAddOnPerPax = 0.0;
  if (pkgKey === 'custom' && services && typeof services === 'object') {
    ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo'].forEach((k) => {
      if (services[k]) {
        packageAddOnPerPax += INDIVIDUAL_ADDON_PRICES_EUR[k] || 0;
      }
    });
  } else {
    packageAddOnPerPax = UNIFIED_PACKAGE_PRICES_EUR[pkgKey] ?? 0.0;
    // Also add standalone extras on Individual if selected outside the bundle
    if (portalType === 'INDIVIDUAL' && services && typeof services === 'object') {
      const includedInBundle =
        pkgKey === 'vip'
          ? ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo']
          : pkgKey === 'premium'
            ? ['filePrep', 'insurance', 'formAssist', 'photo']
            : [];
      ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo'].forEach((k) => {
        if (services[k] && !includedInBundle.includes(k)) {
          packageAddOnPerPax += INDIVIDUAL_ADDON_PRICES_EUR[k] || 0;
        }
      });
    }
  }

  const totalGovFee = Number((govFeePerPax * count).toFixed(2));
  const totalBaseServiceFee = Number((baseServiceFeePerPax * count).toFixed(2));
  const totalPackageAddOnFee = Number((packageAddOnPerPax * count).toFixed(2));

  // For Dossier model:
  // governmentFee & serviceFee are stored per-passenger on Dossier when computeDossierTotals multiplies by pax,
  // OR we store per-pax governmentFee & serviceFee and extraServicesFee for add-ons.
  const serviceFeePerPaxForDossier =
    portalType === 'INDIVIDUAL'
      ? baseServiceFeePerPax
      : Number((baseServiceFeePerPax + packageAddOnPerPax).toFixed(2));

  const extraServicesTotalForDossier = portalType === 'INDIVIDUAL' ? totalPackageAddOnFee : 0.0;
  const grandTotalEur = Number((totalGovFee + totalBaseServiceFee + totalPackageAddOnFee).toFixed(2));
  const grandTotalAzn = convertEurToAzn(grandTotalEur, eurToAznRate);

  return {
    paxCount: count,
    currency: 'EUR',
    eurToAznRate,
    govFeePerPax,
    baseServiceFeePerPax,
    packageAddOnPerPax,
    serviceFeePerPaxForDossier,
    extraServicesTotalForDossier,
    totalGovFee,
    totalBaseServiceFee,
    totalPackageAddOnFee,
    grandTotalEur,
    grandTotalAzn,
    totalAmountEur: grandTotalEur,
    totalAmountAzn: grandTotalAzn,
    convertToEur: (amt, curr) => convertToEur(amt, curr, eurToAznRate),
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
