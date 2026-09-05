const prisma = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/hash.util');
const { generateToken } = require('../../utils/jwt.util');
const notificationService = require('../notification/notification.service');

function generateOtp() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { code, expiresAt };
}

async function register({ email, password, fullName, phone, companyName, role, preferredLanguage }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User with this email already exists.');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      companyName,
      role: role || 'INDIVIDUAL',
      preferredLanguage: preferredLanguage || 'az',
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

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  const token = generateToken({ userId: user.id, role: user.role });

  return { user, token };
}

async function sendOtp(email) {
  const { code, expiresAt } = generateOtp();
  await prisma.otpToken.create({
    data: { email, code, expiresAt, purpose: 'LOGIN' },
  });

  await notificationService.sendOtpNotification(email, code);

  return { message: 'OTP sent' };
}

async function verifyOtp({ email, code }) {
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
    const token = generateToken({ userId: user.id, role: user.role });
    return { user, token };
  }

  return { verified: true };
}

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
};
