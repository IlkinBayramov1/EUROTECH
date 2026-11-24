const express = require('express');
const promoController = require('./promo.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireRoles } = require('../../middlewares/role.middleware');

// Portal User Router: /api/v1/promocodes
const portalPromoRouter = express.Router();
portalPromoRouter.use(authMiddleware);
portalPromoRouter.post('/validate', promoController.validatePromo);

// Admin Router: /api/v1/admin/promocodes
const adminPromoRouter = express.Router();
adminPromoRouter.use(authMiddleware);
adminPromoRouter.use(requireRoles(['OPERATOR', 'MANAGER', 'ADMIN']));

adminPromoRouter.get('/', promoController.listAdminPromos);
adminPromoRouter.get('/analytics', promoController.getAdminPromoAnalytics);
adminPromoRouter.get('/:id', promoController.getAdminPromoDetail);
adminPromoRouter.get('/:id/redemptions', promoController.getAdminPromoRedemptions);

adminPromoRouter.post('/', requireRoles(['MANAGER', 'ADMIN']), promoController.createAdminPromo);
adminPromoRouter.patch('/:id', requireRoles(['MANAGER', 'ADMIN']), promoController.updateAdminPromo);
adminPromoRouter.patch('/:id/status', requireRoles(['MANAGER', 'ADMIN']), promoController.toggleAdminPromoStatus);
adminPromoRouter.delete('/:id', requireRoles(['MANAGER', 'ADMIN']), promoController.deleteAdminPromo);

module.exports = {
  portalPromoRouter,
  adminPromoRouter,
};
