const crypto = require('crypto');

/**
 * Generates a cryptographically secure random token (64 hex characters)
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a raw token using SHA-256 for secure database storage
 * @param {string} token - Raw unhashed token
 * @returns {string} SHA-256 hash in hex format
 */
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateSecureToken,
  hashToken,
};
