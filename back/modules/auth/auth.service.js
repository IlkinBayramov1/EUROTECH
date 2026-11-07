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
      role: normalizeRole(role),
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

function normalizeRole(role) {
  if (role === 'AGENT') return 'AGENT_TUR_OPERATOR';
  if (role === 'CORPORATE') return 'CORPORATE_HR';
  return role || 'INDIVIDUAL';
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
      role: normalizeRole(role),
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

async function login({ email, username, passportNumber, loginIdentifier, password, ip, userAgent, expectedRole, portalRole }) {
  const rawId = (loginIdentifier || email || username || passportNumber || '').trim();
  if (!rawId) {
    throw new Error('Invalid email/username or password.');
  }

  const passportHash = hashHMACSHA256(rawId.toUpperCase());

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: rawId },
        { username: rawId },
        { passportNumber: rawId },
        { passportNumberHash: passportHash },
      ],
    },
  });

  if (!user) {
    throw new Error('Invalid email/username or password.');
  }

  // Validate that user role matches target portal if expectedRole or portalRole is specified
  const targetRole = expectedRole || (
    portalRole === 'agent' ? 'AGENT_TUR_OPERATOR' :
    portalRole === 'corporate' ? 'CORPORATE_HR' :
    portalRole === 'individual' ? 'INDIVIDUAL' :
    portalRole === 'admin' ? 'ADMIN' : null
  );

  const isStaffUser = ['ADMIN', 'OPERATOR', 'MANAGER'].includes(user.role);

  if (targetRole) {
    if (targetRole === 'ADMIN') {
      if (!isStaffUser) {
        throw new Error('İcazə xətası: Bu portala yalnız admin və konsulluq əməkdaşları daxil ola bilər.');
      }
    } else if (!isStaffUser) {
      const isMatching =
        (targetRole === 'AGENT_TUR_OPERATOR' && (user.role === 'AGENT_TUR_OPERATOR' || user.role === 'AGENT')) ||
        (targetRole === 'CORPORATE_HR' && (user.role === 'CORPORATE_HR' || user.role === 'CORPORATE')) ||
        (targetRole === 'INDIVIDUAL' && user.role === 'INDIVIDUAL');

      if (!isMatching) {
        throw new Error('İstifadəçi rolu seçilmiş portala uyğun gəlmir.');
      }
    }
  }

  if (user.accountStatus === 'PENDING_PASSWORD') {
    throw new Error('Security Error: Please set your password first using the link sent to your email.');
  }

  if (user.accountStatus === 'SUSPENDED') {
    throw new Error('Hesabınız dayandırılıb. Dəstək xidməti ilə əlaqə saxlayın.');
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

async function forgotPassword({ email }) {
  const neutralResponse = {
    success: true,
    message: 'Əgər daxil etdiyiniz e-poçt üzrə hesab mövcuddursa, şifrə sıfırlama təlimatı göndərildi.',
  };

  if (!email || typeof email !== 'string') return neutralResponse;
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.accountStatus !== 'ACTIVE') return neutralResponse;

  const rawToken = generateSecureToken();
  const tokenHash = sha256HashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    await notificationService.sendPasswordResetNotification(user.email, user.fullName, rawToken);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        details: { email: user.email },
      },
    });
  } catch (err) {
    console.warn('Password reset email dispatch warning:', err.message);
  }

  return neutralResponse;
}

async function resetPassword({ token, newPassword }) {
  if (!token || typeof token !== 'string') {
    throw new Error('Etibarsız və ya vaxtı bitmiş şifrə sıfırlama keçidi.');
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new Error('Şifrə ən azı 8 simvol olmalı, böyük hərf, kiçik hərf, rəqəm və xüsusi simvol (@$!%*?&) ehtiva etməlidir.');
  }

  const tokenHash = sha256HashToken(token);
  const resetTokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
      usedAt: null,
    },
    include: { user: true },
  });

  if (!resetTokenRecord || !resetTokenRecord.user) {
    throw new Error('Etibarsız və ya vaxtı bitmiş şifrə sıfırlama keçidi.');
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: resetTokenRecord.id },
      data: { usedAt: new Date() },
    });

    await tx.user.update({
      where: { id: resetTokenRecord.userId },
      data: {
        passwordHash: newPasswordHash,
        accountStatus: 'ACTIVE',
        isVerified: true,
      },
    });

    // Invalidate existing sessions on password reset
    await tx.refreshTokenSession.updateMany({
      where: { userId: resetTokenRecord.userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
    });

    await tx.auditLog.create({
      data: {
        userId: resetTokenRecord.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        details: { email: resetTokenRecord.user.email },
      },
    });
  });

  return {
    success: true,
    message: 'Şifrəniz uğurla yeniləndi. Yeni şifrənizlə daxil ola bilərsiniz.',
  };
}

async function logout(userId, rawRefreshToken = null) {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshTokenSession.updateMany({
      where: { tokenHash },
      data: { isRevoked: true, revokedAt: new Date(), revokedReason: 'USER_LOGOUT' },
    });
  } else if (userId) {
    await prisma.refreshTokenSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedReason: 'USER_LOGOUT' },
    });
  }
  return { success: true, message: 'Uğurla çıxış edildi' };
}

async function updateProfile(userId, data) {
  const allowed = {};
  if (data.fullName !== undefined) allowed.fullName = String(data.fullName).trim();
  if (data.phone !== undefined) allowed.phone = String(data.phone).trim();
  if (data.companyName !== undefined) allowed.companyName = String(data.companyName).trim();
  if (data.preferredLanguage !== undefined) allowed.preferredLanguage = String(data.preferredLanguage).trim();
  if (data.taxId !== undefined) allowed.taxId = String(data.taxId).trim();
  if (data.address !== undefined) allowed.address = String(data.address).trim();

  const user = await prisma.user.update({
    where: { id: userId },
    data: allowed,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      fullName: true,
      phone: true,
      companyName: true,
      taxId: true,
      address: true,
      preferredLanguage: true,
      agentTier: true,
      accountStatus: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return user;
}

async function changePassword(userId, { oldPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new Error('İstifadəçi tapılmadı');
  }

  const isMatch = await comparePassword(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw new Error('Cari şifrə yanlışdır');
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new Error('Yeni şifrə ən azı 8 simvol olmalı, böyük hərf, kiçik hərf, rəqəm və xüsusi simvol (@$!%*?&) ehtiva etməlidir.');
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PASSWORD_CHANGED',
      details: { timestamp: new Date() },
    },
  });

  return { success: true, message: 'Şifrəniz uğurla dəyişdirildi' };
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
  forgotPassword,
  resetPassword,
  logout,
  updateProfile,
  changePassword,
};
