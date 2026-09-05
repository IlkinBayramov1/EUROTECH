const authService = require('./auth.service');
const ApiResponse = require('../../core/api.response');
const { getText } = require('../../i18n');

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
    const result = await authService.login(req.body);
    return ApiResponse.success(res, result, getText('LOGIN_SUCCESS', req.lang));
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
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
    const result = await authService.verifyOtp(req.body);
    return ApiResponse.success(res, result, 'OTP verified successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message, 400);
  }
}

async function getProfile(req, res, next) {
  return ApiResponse.success(res, { user: req.user });
}

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  getProfile,
};
