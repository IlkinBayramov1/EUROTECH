const ApiResponse = require('../core/api.response');
const prisma = require('../config/db');

const failedAttemptsStore = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Clean up expired lockout entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedAttemptsStore.entries()) {
    if (record.lockoutUntil && record.lockoutUntil < now) {
      failedAttemptsStore.delete(key);
    } else if (record.lastAttempt && now - record.lastAttempt > LOCKOUT_DURATION_MS) {
      failedAttemptsStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getKey(identifier, ip) {
  const cleanId = (identifier || 'anonymous').toLowerCase().trim();
  const cleanIp = ip || '127.0.0.1';
  return `${cleanId}:${cleanIp}`;
}

function checkLockout(req, res, next) {
  const identifier = req.body?.email || req.body?.username || req.body?.loginIdentifier;
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

  if (!identifier) {
    return next();
  }

  const key = getKey(identifier, ip);
  const record = failedAttemptsStore.get(key);
  const now = Date.now();

  if (record && record.lockoutUntil && record.lockoutUntil > now) {
    const remainingMinutes = Math.ceil((record.lockoutUntil - now) / (60 * 1000));
    console.warn(`[BRUTEFORCE LOCKOUT] Blocked request for ${identifier} (${remainingMinutes} mins remaining)`);
    return ApiResponse.error(
      res,
      `Təhlükəsizlik xəbərdarlığı: Çoxsaylı uğursuz şifrə cəhdi səbəbilə hesabınız müvəqqəti donduruldu. Zəhmət olmasa ${remainingMinutes} dəqiqə sonra yenidən cəhd edin.`,
      429
    );
  }

  next();
}

async function recordFailedAttempt(identifier, ip) {
  if (!identifier) return;
  const key = getKey(identifier, ip);
  const now = Date.now();
  let record = failedAttemptsStore.get(key) || { count: 0 };

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= LOCKOUT_THRESHOLD) {
    record.lockoutUntil = now + LOCKOUT_DURATION_MS;
    console.warn(`[BRUTEFORCE LOCKOUT TRIGGERED] Account/IP locked for 15 mins: ${identifier} (${ip})`);

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'ACCOUNT_LOCKED_BRUTEFORCE',
          ipAddress: String(ip),
          userAgent: 'Security System',
          details: {
            identifier,
            attempts: record.count,
            lockoutUntil: new Date(record.lockoutUntil),
          },
        },
      });
    } catch (err) {}
  }

  failedAttemptsStore.set(key, record);
}

function recordSuccessfulLogin(identifier, ip) {
  if (!identifier) return;
  const key = getKey(identifier, ip);
  failedAttemptsStore.delete(key);
}

function isLocked(identifier, ip) {
  const key = getKey(identifier, ip);
  const record = failedAttemptsStore.get(key);
  if (!record || !record.lockoutUntil) return false;
  return record.lockoutUntil > Date.now();
}

module.exports = {
  checkLockout,
  recordFailedAttempt,
  recordSuccessfulLogin,
  isLocked,
};
