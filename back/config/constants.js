const env = require('./env');

const DEFAULT_EUR_TO_AZN_RATE = env.EUR_TO_AZN_RATE || 1.85;

function convertEurToAzn(amountEur, rate = DEFAULT_EUR_TO_AZN_RATE) {
  return Number((Number(amountEur || 0) * Number(rate || DEFAULT_EUR_TO_AZN_RATE)).toFixed(2));
}

function convertToEur(amount, currency = 'EUR', rate = DEFAULT_EUR_TO_AZN_RATE) {
  const num = Number(amount || 0);
  if (!currency || String(currency).toUpperCase() === 'EUR') {
    return Number(num.toFixed(2));
  }
  if (String(currency).toUpperCase() === 'AZN') {
    const safeRate = Number(rate || DEFAULT_EUR_TO_AZN_RATE) || 1.85;
    return Number((num / safeRate).toFixed(2));
  }
  return Number(num.toFixed(2));
}

module.exports = {
  BASE_CURRENCY: 'EUR',
  DEFAULT_EUR_TO_AZN_RATE,
  DEFAULT_LANGUAGE: 'az',
  SUPPORTED_LANGUAGES: ['az', 'en', 'ru'],
  SERVICE_PRICES: {
    PREMIUM_LOUNGE: 81.0,
    FILE_PREPARATION: 55.0,
    TRAVEL_INSURANCE: 35.0,
    HOTEL_BOOKING: 15.0,
    FLIGHT_BOOKING: 15.0,
    FORM_ASSIST: 24.0,
    COURIER: 20.0,
    BIOMETRIC_PHOTO: 12.0,
    EXPRESS_PROCESSING: 60.0,
    TRANSLATION_APOSTILLE: 45.0,
    SMS_TRACKING: 5.0,
  },
  PORTAL_SERVICE_FEES: {
    INDIVIDUAL: 120.0,
    GROUP_AGENT: 90.0,
    CORPORATE: 150.0,
  },
  AGENT_PACKAGE_PRICES: {
    standard: 0.0,
    plus: 68.0,
    vip: 139.0,
  },
  CORPORATE_PACKAGE_PRICES: {
    standard: 0.0,
    executive: 85.0,
    vip: 150.0,
  },
  AGENT_COMMISSION_RATES: {
    BRONZE: 20.0,
    SILVER: 25.0,
    GOLD: 30.0,
    PLATINUM: 35.0,
  },
  VISA_CENTERS: [
    'EuroTech Main Center',
    'EuroTech Premium Lounge',
    'Ganja Regional Center',
  ],
  convertEurToAzn,
  convertToEur,
};
