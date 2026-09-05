const prisma = require('../config/db');

async function triggerSecurityIncident({ eventType, severity, actorId, details, ip, userAgent }) {
  const incidentId = `INC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  
  const incidentArtifact = {
    incidentId,
    eventType,
    severity: severity || 'HIGH', // LOW, MEDIUM, HIGH, CRITICAL
    actorId,
    detectedAt: new Date().toISOString(),
    owner: 'SOC_SECURITY_OFFICER',
    status: 'INVESTIGATING',
    ip,
    userAgent,
    details,
    evidenceArtifactUrl: `/audit/incidents/${incidentId}.json`,
  };

  console.error(`[SOC2 INCIDENT ALERT] [${incidentId}] ${eventType} (Severity: ${severity})`);

  try {
    await prisma.auditLog.create({
      data: {
        userId: actorId || null,
        action: `SOC2_INCIDENT_${eventType}`,
        ipAddress: ip || null,
        userAgent: userAgent || null,
        details: incidentArtifact,
      },
    });
  } catch (err) {
    console.error('Failed to persist incident audit log:', err.message);
  }

  return incidentArtifact;
}

module.exports = {
  triggerSecurityIncident,
};
