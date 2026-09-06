const crypto = require('crypto');
const prisma = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/hash.util');
const { generateToken } = require('../../utils/jwt.util');
const notificationService = require('../notification/notification.service');
const { encryptAES256GCM, hashHMACSHA256 } = require('../../utils/crypto.util');
const { generateUniqueUsername } = require('../../utils/username.util');
const { generateSecureToken, hashToken: sha256HashToken } = require('../../utils/token.util');

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

async function preRegister({ email, fullName, phone, companyName, role, preferredLanguage, passportNumber }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    if (existingUser.accountStatus === 'PENDING_PASSWORD') {
      // Re-trigger set password link for pending accounts
      return await resendSetPasswordEmail(email);
    }
    throw new Error('User with this email already exists.');
  }

  const username = await generateUniqueUsername();
  const rawToken = generateSecureToken();
  const passwordSetTokenHash = sha256HashToken(rawToken);
  const passwordSetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours TTL

  let passportNumberEncrypted = null;
  let passportNumberHash = null;
  if (passportNumber) {
    passportNumberEncrypted = encryptAES256GCM(passportNumber);
    passportNumberHash = hashHMACSHA256(passportNumber);
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash: null, // Null for PENDING_PASSWORD state
      accountStatus: 'PENDING_PASSWORD',
      passwordSetTokenHash,
      passwordSetExpiresAt,
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

  // Attempt Email Delivery with Reliability Audit Logging
  try {
    await notificationService.sendSetPasswordNotification(email, fullName, username, rawToken);
    
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CUSTOMER_PRE_REGISTERED_EMAIL_SENT',
        details: { username }, // Raw token is NEVER logged
      },
    });
  } catch (emailErr) {
    console.error('Pre-register email delivery error:', emailErr.message);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CUSTOMER_PRE_REGISTERED_EMAIL_FAILED',
        details: { username, error: emailErr.message },
      },
    });
  }

  return {
    success: true,
    message: 'Registration email sent. Please check your email to set your password.',
  };
}

async function setPassword({ token, newPassword }) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid or expired password setup link.');
  }

  // Validate Password Policy (min 8 chars, upper, lower, number, special)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
  }

  const hashedToken = sha256HashToken(token);
  const newPasswordHash = await hashPassword(newPassword);

  // Single Atomic SQL Update Query (Concurrency Race Window Protection)
  const updated = await prisma.user.updateMany({
    where: {
      passwordSetTokenHash: hashedToken,
      passwordSetExpiresAt: { gt: new Date() },
      accountStatus: 'PENDING_PASSWORD',
    },
    data: {
      accountStatus: 'ACTIVE',
      isVerified: true, // Set password implies Email Ownership Verification
      passwordHash: newPasswordHash,
      passwordSetAt: new Date(),
      passwordSetTokenHash: null,
      passwordSetExpiresAt: null,
    },
  });

  if (updated.count === 0) {
    // Generic security error message without leaking whether token was invalid, expired, or already used
    throw new Error('Invalid or expired password setup link.');
  }

  const updatedUser = await prisma.user.findFirst({
    where: { passwordSetAt: { not: null } },
    orderBy: { passwordSetAt: 'desc' },
  });

  if (updatedUser) {
    await prisma.auditLog.create({
      data: {
        userId: updatedUser.id,
        action: 'PASSWORD_SET',
        details: { username: updatedUser.username },
      },
    });
  }

  return {
    success: true,
    message: 'Password set successfully. Your account is now active.',
  };
}

async function resendSetPasswordEmail(email) {
  // Always return identical neutral message to protect against email enumeration attacks
  const neutralMessage = {
    success: true,
    message: 'If an eligible account exists, a password setup email has been sent.',
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.accountStatus !== 'PENDING_PASSWORD') {
    return neutralMessage;
  }

  // Generate new rawToken and invalidate old token
  const rawToken = generateSecureToken();
  const passwordSetTokenHash = sha256HashToken(rawToken);
  const passwordSetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordSetTokenHash,
      passwordSetExpiresAt,
    },
  });

  try {
    await notificationService.sendSetPasswordNotification(email, user.fullName, user.username, rawToken);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SET_PASSWORD_EMAIL_RESENT',
        details: { username: user.username },
      },
    });
  } catch (err) {
    console.error('Resend email failure:', err.message);
  }

  return neutralMessage;
}

async function register({ email, password, fullName, phone, companyName, role, preferredLanguage, passportNumber }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User with this email already exists.');
  }

  const username = await generateUniqueUsername();
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
      username,
      passwordHash,
      accountStatus: 'ACTIVE',
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

async function login({ email, username, password, ip, userAgent }) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email || '' },
        { username: username || (email ? email : '') },
      ],
    },
  });

  if (!user) {
    throw new Error('Invalid email/username or password.');
  }

  if (user.accountStatus === 'PENDING_PASSWORD') {
    throw new Error('Security Error: Please set your password first using the link sent to your email.');
  }

  if (!user.passwordHash) {
    throw new Error('Invalid email/username or password.');
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid email/username or password.');
  }

  return await createSession(user.id, ip, userAgent);
}

async function rotateRefreshToken(rawRefreshToken, ip = '127.0.0.1', userAgent = 'Unknown') {
  const tokenHash = hashToken(rawRefreshToken);

  return await prisma.$transaction(async (tx) => {
    const session = await tx.refreshTokenSession.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new Error('Invalid refresh token.');
    }

    if (session.isRevoked) {
      console.warn(`CRITICAL: TOKEN REUSE DETECTED for user ${session.userId}, family ${session.familyId}`);
      
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
      data: { isVerified: true, accountStatus: 'ACTIVE' },
    });
  }

  if (user) {
    return await createSession(user.id, ip, userAgent);
  }

  return { verified: true };
}

module.exports = {
  preRegister,
  setPassword,
  resendSetPasswordEmail,
  register,
  login,
  rotateRefreshToken,
  sendOtp,
  verifyOtp,
  createSession,
};
