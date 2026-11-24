const express = require('express');
const router = express.Router();

const authRoutes = require('../../modules/auth/auth.routes');
const templateRoutes = require('../../modules/template/template.routes');
const dossierRoutes = require('../../modules/dossier/dossier.routes');
const documentRoutes = require('../../modules/document/document.routes');
const serviceRoutes = require('../../modules/service/service.routes');
const paymentRoutes = require('../../modules/payment/payment.routes');
const adminRoutes = require('../../modules/admin/admin.routes');
const appointmentRoutes = require('../../modules/appointment/appointment.routes');
const agentRoutes = require('../../modules/agent/agent.routes');
const corporateRoutes = require('../../modules/corporate/corporate.routes');
const privacyRoutes = require('../../modules/shared/privacy.routes');
const notificationRoutes = require('../../modules/notification/notification.routes');
const webhookRoutes = require('../../webhooks/webhook.routes');
const cronRoutes = require('./cron.routes');
const { adminVcmsRouter, publicVcmsRouter } = require('../../modules/vcms/vcms.routes');
const { portalPromoRouter, adminPromoRouter } = require('../../modules/promo/promo.routes');

router.use('/auth', authRoutes);
router.use('/templates', templateRoutes);
router.use('/vcms', publicVcmsRouter);
router.use('/promocodes', portalPromoRouter);
router.use('/dossiers', dossierRoutes);
router.use('/documents', documentRoutes);
router.use('/services', serviceRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin/promocodes', adminPromoRouter);
router.use('/admin/vcms', adminVcmsRouter);
router.use('/admin', adminVcmsRouter);
router.use('/admin', adminRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/agent', agentRoutes);
router.use('/corporate', corporateRoutes);
router.use('/privacy', privacyRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/cron', cronRoutes);


module.exports = router;
