/**
 * PII Masking utility for GDPR & ISO 27001 Compliance
 */
function maskPII(data) {
  if (!data) return data;

  if (typeof data === 'string') {
    // Mask potential passport numbers (e.g. C12345678 -> C12****78)
    return data.replace(/([A-Z]\d{2})\d{4,6}(\d{2})/gi, '$1****$2');
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskPII(item));
  }

  const masked = {};
  const sensitiveKeys = [
    'password',
    'passwordhash',
    'token',
    'refreshtoken',
    'accesstoken',
    'clientsecret',
    'secret',
    'cvv',
    'cardnumber',
    'creditcard',
    'auth_token',
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.includes(lowerKey)) {
      masked[key] = '[MASKED]';
    } else if (lowerKey === 'passportnumber' && typeof value === 'string' && value.length >= 7) {
      masked[key] = `${value.slice(0, 3)}****${value.slice(-2)}`;
    } else if (lowerKey === 'phone' && typeof value === 'string' && value.length >= 8) {
      masked[key] = `${value.slice(0, 6)}****${value.slice(-2)}`;
    } else if (typeof value === 'object') {
      masked[key] = maskPII(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

function info(message, meta = {}) {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`, maskPII(meta));
}

function error(message, meta = {}) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, maskPII(meta));
}

function warn(message, meta = {}) {
  console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, maskPII(meta));
}

module.exports = {
  info,
  error,
  warn,
  maskPII,
};
