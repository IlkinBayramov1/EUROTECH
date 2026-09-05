const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const {
  registerValidation,
  loginValidation,
  sendOtpValidation,
  verifyOtpValidation,
} = require('./auth.validation');

router.post('/register', registerValidation, validateRequest, authController.register);
router.post('/login', loginValidation, validateRequest, authController.login);
router.post('/send-otp', sendOtpValidation, validateRequest, authController.sendOtp);
router.post('/verify-otp', verifyOtpValidation, validateRequest, authController.verifyOtp);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
