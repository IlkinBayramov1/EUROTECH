const crypto = require('crypto');
const prisma = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/hash.util');
const { generateToken } = require('../../utils/jwt.util');
const notificationService = require('../notification/notification.service');
const { encryptAES256GCM, hashHMACSHA256 } = require('../../utils/crypto.util');

function generateOtp() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL
  return { code, expiresAt };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId, ip = '127.0.0.1', userAgent = 'Unknown') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  const accessToken = generateToken({ userId: user.id, role: user.role });
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await prisma.refreshTokenSession.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
      ip,
      userAgent,
    },
  });

  return {
    user,
    accessToken,
    refreshToken: rawRefreshToken,
    sessionId: session.id,
    expiresAt,
  };
}

async function register({ email, password, fullName, phone, companyName, role, preferredLanguage, passportNumber }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User with this email already exists.');
  }

  const passwordHash = await hashPassword(password);
  
  let passportNumberEncrypted = null;
  let passportNumberHash = null;
  if (passportNumber) {
    passportNumberEncrypted = encryptAES256GCM(passportNumber);
    passportNumberHash = hashHMACSHA256(passportNumber);
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      companyName,
      role: role || 'INDIVIDUAL',
      preferredLanguage: preferredLanguage || 'az',
      passportNumber: passportNumber || null,
      passportNumberEncrypted,
      passportNumberHash,
      isVerified: false,
    },
  });

  const { code, expiresAt } = generateOtp();
  await prisma.otpToken.create({
    data: { email, code, expiresAt, purpose: 'REGISTER' },
  });

  await notificationService.sendOtpNotification(email, code);

  return user;
}

async function login({ email, password, ip, userAgent }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  return await createSession(user.id, ip, userAgent);
}

async function rotateRefreshToken(rawRefreshToken, ip = '127.0.0.1', userAgent = 'Unknown') {
  const tokenHash = hashToken(rawRefreshToken);

  return await prisma.$transaction(async (tx) => {
    // Pessimistic Row Locking for concurrency protection
    const session = await tx.refreshTokenSession.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new Error('Invalid refresh token.');
    }

    // Reuse Detection & Account Takeover Protection
    if (session.isRevoked) {
      console.warn(`CRITICAL: TOKEN REUSE DETECTED for user ${session.userId}, family ${session.familyId}`);
      
      // Revoke ALL sessions for user to protect against account takeover
      await tx.refreshTokenSession.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true, revokedAt: new Date(), revokedReason: 'TOKEN_REUSE_DETECTED' },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: 'SECURITY_ALERT_TOKEN_REUSE',
          ipAddress: ip,
          userAgent: userAgent,
          details: { familyId: session.familyId, reusedTokenId: session.id },
        },
      });

      throw new Error('Security Alert: Token reuse detected. All sessions revoked.');
    }

    if (session.expiresAt < new Date()) {
      throw new Error('Refresh token expired.');
    }

    // Generate new token pair
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newSession = await tx.refreshTokenSession.create({
      data: {
        userId: session.userId,
        tokenHash: newTokenHash,
        familyId: session.familyId,
        expiresAt: newExpiresAt,
        ip,
        userAgent,
      },
    });

    // Mark old token as revoked and linked to new token in lineage chain
    await tx.refreshTokenSession.update({
      where: { id: session.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'ROTATED',
        replacedByTokenId: newSession.id,
        lastUsedAt: new Date(),
      },
    });

    const accessToken = generateToken({ userId: session.user.id, role: session.user.role });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      userId: session.userId,
    };
  });
}

async function sendOtp(email) {
  const { code, expiresAt } = generateOtp();
  await prisma.otpToken.create({
    data: { email, code, expiresAt, purpose: 'LOGIN' },
  });

  await notificationService.sendOtpNotification(email, code);

  return { message: 'OTP sent' };
}

async function verifyOtp({ email, code, ip, userAgent }) {
  const otpRecord = await prisma.otpToken.findFirst({
    where: {
      email,
      code,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    throw new Error('Invalid or expired OTP code.');
  }

  await prisma.otpToken.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  let user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.isVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
  }

  if (user) {
    return await createSession(user.id, ip, userAgent);
  }

  return { verified: true };
}

module.exports = {
  register,
  login,
  rotateRefreshToken,
  sendOtp,
  verifyOtp,
  createSession,
};
