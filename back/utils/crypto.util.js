const crypto = require('crypto');
const env = require('../config/env');

const MASTER_ENCRYPTION_KEYS = {
  v1: env.ENCRYPTION_KEY_V1,
  v2: env.ENCRYPTION_KEY_V2,
};

const HMAC_KEYS = {
  v1: env.HMAC_KEY_V1,
  v2: env.HMAC_KEY_V2,
};

const CURRENT_KEY_VERSION = 'v1';

function encryptAES256GCM(plainText, keyVersion = CURRENT_KEY_VERSION) {
  if (!plainText) return null;
  const secretKey = MASTER_ENCRYPTION_KEYS[keyVersion] || MASTER_ENCRYPTION_KEYS.v1;
  const key = crypto.createHash('sha256').update(String(secretKey)).digest();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return JSON.stringify({
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag,
    keyVersion: keyVersion,
  });
}

function decryptAES256GCM(encryptedPayload) {
  if (!encryptedPayload) return null;
  try {
    const payload = typeof encryptedPayload === 'string' ? JSON.parse(encryptedPayload) : encryptedPayload;
    if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) return null;
    const { ciphertext, iv, authTag, keyVersion } = payload;

    const secretKey = MASTER_ENCRYPTION_KEYS[keyVersion] || MASTER_ENCRYPTION_KEYS.v1;
    const key = crypto.createHash('sha256').update(String(secretKey)).digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    return null;
  }
}

function hashHMACSHA256(plainText, hmacVersion = CURRENT_KEY_VERSION) {
  if (!plainText) return null;
  const secretKey = HMAC_KEYS[hmacVersion] || HMAC_KEYS.v1;
  const normalized = String(plainText).trim().toUpperCase();
  return crypto.createHmac('sha256', secretKey).update(normalized).digest('hex');
}

function resolvePlainPassport(recordOrString) {
  if (!recordOrString) return '';
  if (typeof recordOrString === 'string') {
    const trimmed = recordOrString.trim();
    if (trimmed.startsWith('{') && trimmed.includes('ciphertext')) {
      return decryptAES256GCM(trimmed) || '';
    }
    return trimmed;
  }
  if (recordOrString.passportNumberEncrypted) {
    const dec = decryptAES256GCM(recordOrString.passportNumberEncrypted);
    if (dec) return dec;
  }
  if (typeof recordOrString.passportNumber === 'string') {
    const raw = recordOrString.passportNumber.trim();
    if (raw.startsWith('{') && raw.includes('ciphertext')) {
      return decryptAES256GCM(raw) || '';
    }
    return raw;
  }
  return '';
}

module.exports = {
  encryptAES256GCM,
  decryptAES256GCM,
  hashHMACSHA256,
  resolvePlainPassport,
  CURRENT_KEY_VERSION,
};
