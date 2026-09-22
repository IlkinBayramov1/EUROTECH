const express = require('express');
const router = express.Router();
const serviceController = require('./service.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public/authenticated catalog inquiry
router.get('/catalog', serviceController.getServiceCatalog);

// Protected actions
router.use(authMiddleware);

router.post('/add', serviceController.addService);
router.post('/checkout', serviceController.checkoutServices);
router.delete('/:serviceId', serviceController.removeService);

module.exports = router;
