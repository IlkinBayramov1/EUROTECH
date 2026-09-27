const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const env = require('../config/env');

/**
 * Storage Service supporting both Local Disk and S3/MinIO compatible object stores
 */
class StorageService {
  constructor() {
    this.driver = env.STORAGE_DRIVER || 'local';
    this.bucketName = env.S3_BUCKET_NAME || 'eurotech-documents';
    this.localUploadDir = path.resolve(env.UPLOAD_DIR || './uploads');

    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  /**
   * Generates a unique secure object key
   */
  generateKey(dossierId, originalFileName) {
    const ext = path.extname(originalFileName).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `dossiers/${dossierId}/${timestamp}_${hash}${ext}`;
  }

  /**
   * Generates a 15-minute expiring presigned upload URL
   */
  async generatePresignedUploadUrl({ dossierId, fileName, contentType, maxSizeBytes = 50 * 1024 * 1024 }) {
    const key = this.generateKey(dossierId, fileName);
    const expiresInSeconds = 900; // 15 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    if (this.driver === 's3') {
      // In production S3 mode, use AWS S3 SDK Presigned URL
      // (Using signed query parameters format)
      const s3Url = `${env.S3_ENDPOINT}/${this.bucketName}/${key}?X-Amz-Expires=${expiresInSeconds}&X-Amz-SignedHeaders=host`;
      return {
        driver: 's3',
        uploadUrl: s3Url,
        fileKey: key,
        expiresAt,
        maxSizeBytes,
        headers: {
          'Content-Type': contentType,
          'x-amz-server-side-encryption': 'AES256',
        },
      };
    } else {
      // Local development driver with signed HMAC token
      const signaturePayload = `${key}:${expiresAt}:${maxSizeBytes}`;
      const token = crypto.createHmac('sha256', env.JWT_SECRET).update(signaturePayload).digest('hex');

      const localUploadUrl = `/api/v1/documents/direct-upload?key=${encodeURIComponent(key)}&expires=${encodeURIComponent(expiresAt)}&token=${token}`;
      return {
        driver: 'local',
        uploadUrl: localUploadUrl,
        fileKey: key,
        expiresAt,
        maxSizeBytes,
        headers: {
          'Content-Type': contentType,
        },
      };
    }
  }

  /**
   * Generates a 15-minute expiring presigned download URL
   */
  async generatePresignedDownloadUrl(fileKey, expiresInSeconds = 900) {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    if (this.driver === 's3') {
      return {
        downloadUrl: `${env.S3_ENDPOINT}/${this.bucketName}/${fileKey}?X-Amz-Expires=${expiresInSeconds}`,
        expiresAt,
      };
    } else {
      // Local signed token
      const token = crypto.createHmac('sha256', env.JWT_SECRET).update(`${fileKey}:${expiresAt}`).digest('hex');
      return {
        downloadUrl: `/api/v1/documents/secure-view?key=${encodeURIComponent(fileKey)}&expires=${encodeURIComponent(expiresAt)}&token=${token}`,
        expiresAt,
      };
    }
  }

  /**
   * Verifies the authenticity of a local direct upload signature
   */
  verifyUploadSignature(key, expiresAt, maxSizeBytes, token) {
    if (new Date() > new Date(expiresAt)) {
      return false; // Expired
    }
    const signaturePayload = `${key}:${expiresAt}:${maxSizeBytes}`;
    const expectedToken = crypto.createHmac('sha256', env.JWT_SECRET).update(signaturePayload).digest('hex');
    return token === expectedToken;
  }
}

module.exports = new StorageService();
