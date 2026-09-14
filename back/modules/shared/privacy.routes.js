const express = require('express');
const router = express.Router();
const privacyController = require('./privacy.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/anonymize', privacyController.anonymizeMe);
router.get('/export-data', privacyController.exportMyData);

module.exports = router;
