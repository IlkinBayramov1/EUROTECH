const crypto = require('crypto');
const prisma = require('../config/db');

/**
 * Generates a cryptographically secure random EUR username (e.g., EUR84920)
 * Uses DB uniqueness check & handles retry on potential collision.
 */
async function generateUniqueUsername() {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomDigits = crypto.randomInt(10000, 99999);
    const candidateUsername = `EUR${randomDigits}`;

    const existing = await prisma.user.findUnique({
      where: { username: candidateUsername },
      select: { id: true },
    });

    if (!existing) {
      return candidateUsername;
    }
  }

  // Fallback to timestamp suffix if extreme collision occurs
  return `EUR${Date.now().toString().slice(-5)}`;
}

module.exports = {
  generateUniqueUsername,
};
