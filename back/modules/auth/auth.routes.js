const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { authRateLimiter, otpRateLimiter } = require('../../middlewares/rateLimiter.middleware');
const {
  preRegisterValidation,
  setPasswordValidation,
  registerValidation,
  loginValidation,
  sendOtpValidation,
  verifyOtpValidation,
} = require('./auth.validation');

router.post('/pre-register', preRegisterValidation, validateRequest, authController.preRegister);
router.post('/set-password', setPasswordValidation, validateRequest, authController.setPassword);
router.post('/resend-set-password', otpRateLimiter, authController.resendSetPasswordEmail);
router.post('/register', registerValidation, validateRequest, authController.register);
router.post('/login', authRateLimiter, loginValidation, validateRequest, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/send-otp', otpRateLimiter, sendOtpValidation, validateRequest, authController.sendOtp);
router.post('/verify-otp', otpRateLimiter, verifyOtpValidation, validateRequest, authController.verifyOtp);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
