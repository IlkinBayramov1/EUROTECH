const crypto = require('crypto');
const env = require('../config/env');

const MASTER_ENCRYPTION_KEYS = {
  v1: env.ENCRYPTION_KEY_V1 || 'default_32_byte_secret_key_v1_99',
  v2: env.ENCRYPTION_KEY_V2 || 'default_32_byte_secret_key_v2_99',
};

const HMAC_KEYS = {
  v1: env.HMAC_KEY_V1 || 'default_hmac_secret_key_v1_99999',
  v2: env.HMAC_KEY_V2 || 'default_hmac_secret_key_v2_99999',
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
    const { ciphertext, iv, authTag, keyVersion } = payload;

    const secretKey = MASTER_ENCRYPTION_KEYS[keyVersion] || MASTER_ENCRYPTION_KEYS.v1;
    const key = crypto.createHash('sha256').update(String(secretKey)).digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err.message);
    return null;
  }
}

function hashHMACSHA256(plainText, hmacVersion = CURRENT_KEY_VERSION) {
  if (!plainText) return null;
  const secretKey = HMAC_KEYS[hmacVersion] || HMAC_KEYS.v1;
  const normalized = String(plainText).trim().toUpperCase();
  return crypto.createHmac('sha256', secretKey).update(normalized).digest('hex');
}

module.exports = {
  encryptAES256GCM,
  decryptAES256GCM,
  hashHMACSHA256,
  CURRENT_KEY_VERSION,
};
