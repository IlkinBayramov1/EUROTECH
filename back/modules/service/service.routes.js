const express = require('express');
const router = express.Router();
const serviceController = require('./service.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/add', serviceController.addService);
router.delete('/:serviceId', serviceController.removeService);

module.exports = router;
