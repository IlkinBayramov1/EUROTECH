const prisma = require('../config/db');

async function logAudit({ userId, action, ipAddress, userAgent, details }) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId,
        action,
        ipAddress,
        userAgent,
        details,
      },
    });
  } catch (err) {
    console.error('Audit logging error:', err.message);
  }
}

module.exports = {
  logAudit,
};
