const { body } = require('express-validator');

const preRegisterValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('role')
    .optional()
    .isIn(['INDIVIDUAL', 'AGENT_TUR_OPERATOR', 'CORPORATE_HR'])
    .withMessage('Invalid profile role'),
];

const setPasswordValidation = [
  body('token').notEmpty().withMessage('Set password token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];

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
  body('email').optional().isEmail().withMessage('Valid email is required if provided'),
  body('username').optional().notEmpty().withMessage('Username must not be empty if provided'),
  body('password').notEmpty().withMessage('Password is required'),
];

const sendOtpValidation = [body('email').isEmail().withMessage('Valid email is required')];

const verifyOtpValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP code is required'),
];

module.exports = {
  preRegisterValidation,
  setPasswordValidation,
  registerValidation,
  loginValidation,
  sendOtpValidation,
  verifyOtpValidation,
};
