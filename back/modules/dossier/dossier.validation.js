const { body } = require('express-validator');

const createDossierValidation = [
  body('portalType').isIn(['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE']).withMessage('Valid portal type is required'),
  body('countryId').notEmpty().withMessage('Country ID is required'),
  body('visaCategoryId').notEmpty().withMessage('Visa Category ID is required'),
];

const addApplicantsValidation = [
  body('applicants').isArray({ min: 1 }).withMessage('At least one applicant is required'),
  body('applicants.*.firstName').notEmpty().withMessage('First name is required'),
  body('applicants.*.lastName').notEmpty().withMessage('Last name is required'),
  body('applicants.*.passportNumber').notEmpty().withMessage('Passport number is required'),
];

module.exports = {
  createDossierValidation,
  addApplicantsValidation,
};
