const authService = require('./auth.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');

async function preRegister(req, res, next) {
  try {
    const result = await authService.preRegister(req.body);
    return ApiResponse.success(res, result, 'Pre-registration successful. Email sent.', 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function setPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.setPassword({ token, newPassword });
    return ApiResponse.success(res, result, 'Password set successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function resendSetPasswordEmail(req, res, next) {
  try {
    const { email } = req.body;
    const result = await authService.resendSetPasswordEmail(email);
    return ApiResponse.success(res, result, 'If an eligible account exists, a password setup email has been sent.');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    return ApiResponse.success(res, { user }, getText('OTP_SENT', req.lang), 201);
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function login(req, res, next) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await authService.login({ ...req.body, ip, userAgent });
    return ApiResponse.success(res, result, getText('LOGIN_SUCCESS', req.lang));
  } catch (error) {
    const statusCode = error.message.includes('Security Error') ? 403 : 400;
    return ApiResponse.error(res, error.message, statusCode);
  }
}

async function refreshToken(req, res, next) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const { refreshToken: token } = req.body;
    if (!token) {
      return ApiResponse.error(res, 'Refresh token is required', 400);
    }
    const result = await authService.rotateRefreshToken(token, ip, userAgent);
    return ApiResponse.success(res, result, 'Token refreshed successfully');
  } catch (error) {
    const statusCode = error.message.includes('Security Alert') ? 403 : 401;
    return ApiResponse.error(res, error.message, statusCode);
  }
}

async function sendOtp(req, res, next) {
  try {
    const result = await authService.sendOtp(req.body.email);
    return ApiResponse.success(res, result, getText('OTP_SENT', req.lang));
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await authService.verifyOtp({ ...req.body, ip, userAgent });
    return ApiResponse.success(res, result, 'OTP verified successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getProfile(req, res, next) {
  return ApiResponse.success(res, { user: req.user });
}

module.exports = {
  preRegister,
  setPassword,
  resendSetPasswordEmail,
  register,
  login,
  refreshToken,
  sendOtp,
  verifyOtp,
  getProfile,
};
