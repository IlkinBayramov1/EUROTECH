const { body } = require('express-validator');

const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('role')
    .optional()
    .isIn(['INDIVIDUAL', 'AGENT_TUR_OPERATOR', 'CORPORATE_HR'])
    .withMessage('Invalid profile role'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const sendOtpValidation = [body('email').isEmail().withMessage('Valid email is required')];

const verifyOtpValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP code is required'),
];

module.exports = {
  registerValidation,
  loginValidation,
  sendOtpValidation,
  verifyOtpValidation,
};
