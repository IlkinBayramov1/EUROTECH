const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BACKEND_ROOT = path.resolve(__dirname, '..');

function resolveBackendDir(rawPath, fallbackFolder) {
  if (!rawPath) return path.join(BACKEND_ROOT, fallbackFolder);
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(BACKEND_ROOT, rawPath);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

if (IS_PROD) {
  const requiredInProd = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY_V1', 'HMAC_KEY_V1'];
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`[ENV FATAL] Missing required production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  BACKEND_ROOT,
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV,
  IS_PROD,
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/eurotech_db',
  CUSTOMER_APP_URL: process.env.CUSTOMER_APP_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'eurotech_super_secret_jwt_key_2026_safe_and_secure',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ENCRYPTION_KEY_V1: process.env.ENCRYPTION_KEY_V1 || 'default_32_byte_secret_key_v1_99',
  ENCRYPTION_KEY_V2: process.env.ENCRYPTION_KEY_V2 || 'default_32_byte_secret_key_v2_99',
  HMAC_KEY_V1: process.env.HMAC_KEY_V1 || 'default_hmac_secret_key_v1_99999',
  HMAC_KEY_V2: process.env.HMAC_KEY_V2 || 'default_hmac_secret_key_v2_99999',
  EUR_TO_AZN_RATE: Number(process.env.EUR_TO_AZN_RATE || 1.85),
  ENABLE_OTP_VERIFICATION: process.env.ENABLE_OTP_VERIFICATION === 'true',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_mock_eurotech_stripe_key',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_eurotech_webhook_secret',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_eurotech_key',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: Number(process.env.SMTP_PORT || 2525),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'EuroTech Services <noreply@eurotech.services>',
  UPLOAD_DIR: resolveBackendDir(process.env.UPLOAD_DIR, 'uploads'),
  ARCHIVE_DIR: resolveBackendDir(process.env.ARCHIVE_DIR, 'archives'),
  LOCAL_BANK_MERCHANT_ID: process.env.LOCAL_BANK_MERCHANT_ID || 'EUROTECH_MERCHANT_01',
  LOCAL_BANK_TERMINAL_ID: process.env.LOCAL_BANK_TERMINAL_ID || 'EUROTECH_TERM_01',
  LOCAL_BANK_SECRET_KEY: process.env.LOCAL_BANK_SECRET_KEY || 'local_bank_super_secret_mac_key_2026',
  LOCAL_BANK_GATEWAY_URL: process.env.LOCAL_BANK_GATEWAY_URL || 'https://bank-gateway.eurotech.services/pay',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  META_WHATSAPP_TOKEN: process.env.META_WHATSAPP_TOKEN || '',
  META_WHATSAPP_PHONE_ID: process.env.META_WHATSAPP_PHONE_ID || '108823928192831',
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || '992838192831023',
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'eurotech_wa_verify_token_2026',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '+15005550006',
  BULKSMS_AZ_API_KEY: process.env.BULKSMS_AZ_API_KEY || '',
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9000',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'eurotech-documents',
  S3_REGION: process.env.S3_REGION || 'eu-central-1',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
};
