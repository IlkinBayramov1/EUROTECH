require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/eurotech_db',
  JWT_SECRET: process.env.JWT_SECRET || 'eurotech_super_secret_jwt_key_2026_safe_and_secure',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_mock_eurotech_stripe_key',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_eurotech_webhook_secret',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: process.env.SMTP_PORT || 2525,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'EuroTech Services <noreply@eurotech.services>',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  ARCHIVE_DIR: process.env.ARCHIVE_DIR || './archives',
};
