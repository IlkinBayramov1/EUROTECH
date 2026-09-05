const express = require('express');
const router = express.Router();
const templateController = require('./template.controller');

router.get('/countries', templateController.getCountries);
router.get('/visa-categories/:countryId', templateController.getVisaCategories);
router.get('/wizard-schema/:visaCategoryId', templateController.getWizardSchema);

module.exports = router;
